// =====================================================
// AuroraMaps · layers.js — Layer manager
// =====================================================
'use strict';

// =====================================================
// LAYER MANAGER
// =====================================================
const LayerManager = {
  addLayer(name, geoJSON, color, meta) {
    const id = Utils.id();
    const c = color || Utils.nextColor();

    // Hitung pengukuran (luas/keliling) dulu agar popup & label langsung lengkap
    this._enrichFeaturesWithMeasurements(geoJSON, c);

    const leafletLayer = this._createLeafletLayer(geoJSON, c, id);
    leafletLayer.addTo(MapManager.map);

    leafletLayer.eachLayer(sub => {
      sub.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        const feat = sub.feature || { properties: {}, geometry: null };
        FeatureSelect.select(feat, sub, id);
      });
      sub.on('contextmenu', (e) => {
        L.DomEvent.stopPropagation(e);
        ContextMenuManager.showFeatureMenu(e, sub, id);
      });
    });

    const featureCount = geoJSON.features ? geoJSON.features.length : 1;
    const entry = {
      id, name, color: c, visible: true,
      leafletLayer, geoJSON,
      featureCount,
      opacity: 1,
      style: { fillColor: c, color: c, fillOpacity: 0.35, weight: 2, opacity: 1 },
      meta: meta || { source: 'import', format: 'GeoJSON', created: new Date().toISOString() },
       showLabels: false,
       labelSource: 'name',
       showEdgeLengths: true,
    };

    State.layers.push(entry);
    State.selectedLayer = id;
    if (featureCount > 1) State.expandedLayers[id] = true;
     this.refreshEdgeLabels(entry);
     this.refreshFeatureLabels(entry);

    UI.renderLayerList();
    UI.updateStats();
    UI.showMetadata(entry);
    AttrTable.load();

    History.push({ type: 'add_layer', layerId: id });
    AppConsole.log(`Layer "${name}" added (${featureCount} features)`, 'success');
    return id;
  },

  addDrawnLayer(leafletLayer, geoJSON, drawType, color) {
    const id = Utils.id();
    const c = color || Utils.nextColor();

    const feature = (geoJSON && geoJSON.type === 'Feature')
      ? geoJSON
      : { type: 'Feature', geometry: geoJSON?.geometry || null, properties: geoJSON?.properties || {} };

    leafletLayer.feature = feature;

    const featureCollection = { type: 'FeatureCollection', features: [feature] };

    const entry = {
      id,
      name: feature.properties?.name || (drawType + ' baru'),
      color: c, visible: true,
      leafletLayer, geoJSON: featureCollection,
      featureCount: 1, opacity: 1,
      isDrawn: true,
      style: { fillColor: c, color: c, fillOpacity: 0.3, weight: 2, opacity: 1 },
      meta: { source: 'draw', format: drawType, created: new Date().toISOString() },
       showLabels: false,
        labelSource: 'name',
       showEdgeLengths: true,
    };

    leafletLayer.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      FeatureSelect.select(leafletLayer.feature, leafletLayer, id);
    });
    leafletLayer.on('contextmenu', (e) => {
      L.DomEvent.stopPropagation(e);
      ContextMenuManager.showFeatureMenu(e, leafletLayer, id);
    });    LayerManager._bindDrawnPopup(leafletLayer, feature.properties);

    // Ensure leafletLayer is on the map (needed when called outside draw control)
    if (!leafletLayer._map && MapManager.map) {
      MapManager.map.addLayer(leafletLayer);
    }

    State.layers.push(entry);
    State.selectedLayer = id;
     this.refreshEdgeLabels(entry);
     this.refreshFeatureLabels(entry);
    UI.renderLayerList();
    UI.updateStats();
    AttrTable.load();
    return id;
  },

  _bindDrawnPopup(leafletLayer, props) {
    // Leaflet popup digantikan oleh MapPopup (kiri bawah)
  },

  _createLeafletLayer(geoJSON, color, layerId) {
    const options = {
      pane: 'dataPane', // layer import (GeoJSON/KMZ/KML) di bawah gambar manual
      style: (feature) => ({
        color: color,
        fillColor: color,
        fillOpacity: 0.35,
        weight: 2,
        opacity: 1
      }),
      pointToLayer: (feature, latlng) => {
        return L.circleMarker(latlng, {
          pane: 'dataPane',
          radius: 6, color: color, fillColor: color,
          fillOpacity: 0.8, weight: 2
        });
      },
      onEachFeature: (feature, layer) => {
        layer.on('click', (ev) => {
          if (window.MapManager) MapManager._onDrawnItemClick(ev);
        });
      }
    };
    return L.geoJSON(geoJSON, options);
  },

  _edgePointSets(feature) {
    const geometry = feature?.geometry;
    if (!geometry?.coordinates) return [];
    const toPoints = coords => (Array.isArray(coords) ? coords : [])
      .filter(c => Array.isArray(c) && c.length >= 2 && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1])))
      .map(c => L.latLng(Number(c[1]), Number(c[0])));
    // Ring poligon yang datanya belum tertutup (titik awal ≠ titik akhir)
    // ditutup dulu, supaya sisi penutup ikut dapat label panjang.
    const closeRing = points => {
      if (points.length > 1) {
        const first = points[0];
        const last = points[points.length - 1];
        if (Math.abs(first.lat - last.lat) > 1e-9 || Math.abs(first.lng - last.lng) > 1e-9) {
          points.push(L.latLng(first.lat, first.lng));
        }
      }
      return points;
    };
    switch (geometry.type) {
      case 'LineString':
        return [toPoints(geometry.coordinates)];
      case 'MultiLineString':
        return geometry.coordinates.map(toPoints);
      case 'Polygon':
        return geometry.coordinates.map(ring => closeRing(toPoints(ring)));
      case 'MultiPolygon':
        return geometry.coordinates.flatMap(polygon => polygon.map(ring => closeRing(toPoints(ring))));
      default:
        return [];
    }
  },

  _edgeLabelLayout(a, b) {
    const midpoint = L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2);
    const map = MapManager.map;
    if (!map?.latLngToLayerPoint || !map?.layerPointToLatLng) {
      return { position: midpoint, angle: 0 };
    }

    const start = map.latLngToLayerPoint(a);
    const end = map.latLngToLayerPoint(b);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
      return { position: midpoint, angle: 0 };
    }

    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;

    const radians = angle * Math.PI / 180;
    const aboveX = Math.sin(radians) * 8;
    const aboveY = -Math.cos(radians) * 8;
    const labelPoint = L.point(
      (start.x + end.x) / 2 + aboveX,
      (start.y + end.y) / 2 + aboveY
    );

    return {
      position: map.layerPointToLatLng(labelPoint),
      angle
    };
  },

  refreshEdgeLabels(entryOrId) {
    const entry = typeof entryOrId === 'string'
      ? State.layers.find(layer => layer.id === entryOrId)
      : entryOrId;
    if (!entry) return;

    if (!entry.edgeLabels) entry.edgeLabels = L.layerGroup();
    entry.edgeLabels.clearLayers();
    if (!entry.visible || entry.showEdgeLengths === false) {
      if (MapManager.map.hasLayer(entry.edgeLabels)) MapManager.map.removeLayer(entry.edgeLabels);
      return;
    }
    if (!MapManager.map.hasLayer(entry.edgeLabels)) entry.edgeLabels.addTo(MapManager.map);

    // Panel jendela peta (viewport) + ukuran layar dipakai sebagai saringan,
    // supaya label hanya dibuat untuk sisi yang sedang terlihat dan terbaca.
    // Tanpa saringan ini KMZ berisi ratusan poligon menghasilkan ribuan marker
    // label DOM yang dibangun + dibongkar ulang setiap peta di-pan/zoom —
    // itulah penyebab utama aplikasi terasa berat / hank di HP.
    const map = MapManager.map;
    const bounds = map.getBounds().pad(0.1);
    const MIN_EDGE_PX = 30;  // sisi < 30 px di layar: labelnya tak terbaca
    const MAX_LABELS = 500;  // batas keras jumlah label per layer
    let made = 0;

    const features = entry.geoJSON?.features || [];
    for (const feature of features) {
      for (const points of this._edgePointSets(feature)) {
        if (points.length < 2) continue;
        const limit = points.length - 1;
        for (let i = 0; i < limit; i++) {
          if (made >= MAX_LABELS) return;
          const a = points[i];
          const b = points[i + 1];
          const start = map.latLngToLayerPoint(a);
          const end = map.latLngToLayerPoint(b);
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          if (Math.sqrt(dx * dx + dy * dy) < MIN_EDGE_PX) continue;
          if (!bounds.contains(L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2))) continue;
          const length = Utils.haversine(a.lat, a.lng, b.lat, b.lng);
          if (!Number.isFinite(length) || length <= 0) continue;
          const labelLayout = this._edgeLabelLayout(a, b);
          const icon = L.divIcon({
            className: 'edge-length-icon',
            html: `<span class="edge-length-label" style="--edge-angle:${labelLayout.angle}deg">${Utils.formatEdgeMeters(length)}</span>`,
            iconSize: [1, 1],
            iconAnchor: [0.5, 0.5]
          });
          L.marker(labelLayout.position, {
            icon,
            interactive: false,
            keyboard: false,
            zIndexOffset: 700
          }).addTo(entry.edgeLabels);
          made++;
        }
      }
    }
  },

  _featureLabelPoint(feature) {
    const points = this._edgePointSets(feature).flat();
    if (points.length === 0) return null;
    const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
    const lng = points.reduce((sum, point) => sum + point.lng, 0) / points.length;
    return L.latLng(lat, lng);
  },

  refreshFeatureLabels(entryOrId) {
    const entry = typeof entryOrId === 'string'
      ? State.layers.find(layer => layer.id === entryOrId)
      : entryOrId;
    if (!entry) return;

    if (!entry.featureLabels) entry.featureLabels = L.layerGroup();
    entry.featureLabels.clearLayers();
    if (!entry.visible || entry.showLabels !== true) {
      if (MapManager.map.hasLayer(entry.featureLabels)) MapManager.map.removeLayer(entry.featureLabels);
      return;
    }
    if (!MapManager.map.hasLayer(entry.featureLabels)) entry.featureLabels.addTo(MapManager.map);

    const features = entry.geoJSON?.features || [];
    features.forEach(feature => {
      const properties = feature?.properties || {};
      const source = ['name', 'shm', 'luas', 'deskripsi', 'nib', 'keterangan', 'none'].includes(entry.labelSource)
        ? entry.labelSource
        : 'name';
      const sourceValues = {
        name: properties.name ?? properties.Name ?? entry.name,
        shm: properties.shm ?? properties.SHM,
        // SHM popup data historically used both `luas` and `luas`.
        // Keep the style label resilient to either representation.
        luas: properties.luas,
        deskripsi: properties.deskripsi ?? properties.description ?? properties.Description,
        nib: properties.nib ?? properties.NIB,
        keterangan: properties.keterangan ?? properties.Keterangan
      };
      const rawValue = source === 'none' ? '' : sourceValues[source];
      const value = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
      const point = this._featureLabelPoint(feature);
      if (!point || !value) return;
      const icon = L.divIcon({
        className: 'feature-name-icon',
        html: `<span class="feature-name-label">${Utils.escapeHtml(value)}</span>`,
        iconSize: [1, 1],
        iconAnchor: [0.5, 0.5]
      });
      L.marker(point, {
        icon,
        interactive: false,
        keyboard: false,
        zIndexOffset: 750
      }).addTo(entry.featureLabels);
    });
  },

  removeLayer(id) {
    const idx = State.layers.findIndex(l => l.id === id);
    if (idx === -1) return;
    const layer = State.layers[idx];
    MapManager.map.removeLayer(layer.leafletLayer);
    if (layer.edgeLabels) MapManager.map.removeLayer(layer.edgeLabels);
    if (layer.featureLabels) MapManager.map.removeLayer(layer.featureLabels);
    State.layers.splice(idx, 1);
    if (State.selectedLayer === id) State.selectedLayer = null;
    AttrTable.load();

    if (State.layers.length === 0) {
      State.selectedLayer        = null;
      State.selectedFeature      = null;
      State.selectedFeatureLayer = null;
      State.drawTargetLayerId    = null;
      State.expandedLayers       = {};
      State.colorIndex           = 0;
      State.history              = [];
      State.historyIndex         = -1;
      FeatureSelect.clear();
      document.getElementById('project-name-display').textContent = 'AuroraMaps001';
      const propsEl = document.getElementById('props-content');
      if (propsEl) propsEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">Pilih sebuah fitur<br>untuk melihat properti.</div></div>';
    }

    UI.renderLayerList();
    UI.updateStats();
    AppConsole.log(`Layer "${layer.name}" removed`, 'warn');
  },

  toggleVisibility(id) {
    const layer = State.layers.find(l => l.id === id);
    if (!layer) return;
    layer.visible = !layer.visible;
    if (layer.visible) MapManager.map.addLayer(layer.leafletLayer);
    else MapManager.map.removeLayer(layer.leafletLayer);
    this.refreshEdgeLabels(layer);
    this.refreshFeatureLabels(layer);
    UI.renderLayerList();
    UI.updateStats();
  },

  setOpacity(id, opacity) {
    const layer = State.layers.find(l => l.id === id);
    if (!layer) return;
    layer.opacity = opacity;
    if (layer.leafletLayer.setStyle) {
      layer.leafletLayer.setStyle({ fillOpacity: opacity * 0.35, opacity });
    }
  },

  applyStyle(id, style) {
    const layer = State.layers.find(l => l.id === id);
    if (!layer) return;
    const { showEdgeLengths, labelSource, ...visualStyle } = style;
    Object.assign(layer.style, visualStyle);
    if (showEdgeLengths !== undefined) layer.showEdgeLengths = !!showEdgeLengths;
    if (style.showLabels !== undefined) layer.showLabels = !!style.showLabels;
    if (['name', 'shm', 'luas', 'deskripsi', 'nib', 'keterangan', 'none'].includes(labelSource)) {
      layer.labelSource = labelSource;
    }
    if (layer.leafletLayer.setStyle) {
      layer.leafletLayer.setStyle({
        color: visualStyle.strokeColor || layer.style.color,
        fillColor: visualStyle.fillColor || layer.style.fillColor,
        fillOpacity: parseFloat(visualStyle.fillOpacity ?? layer.style.fillOpacity),
        weight: parseFloat(visualStyle.strokeWidth ?? layer.style.weight),
        opacity: parseFloat(visualStyle.strokeOpacity ?? layer.style.opacity),
        dashArray: visualStyle.dash || null
      });
    }
    this.refreshEdgeLabels(layer);
    this.refreshFeatureLabels(layer);
    AppConsole.log(`Style applied to "${layer.name}"`, 'success');
  },

  zoomTo(id) {
    const layer = State.layers.find(l => l.id === id);
    if (!layer) return;
    try {
      const b = layer.leafletLayer.getBounds();
      if (b.isValid()) MapManager.map.fitBounds(b, { padding: [30, 30] });
    } catch(e) {}
  },

  rename(id, newName) {
    const layer = State.layers.find(l => l.id === id);
    if (!layer) return;
    const old = layer.name;
    layer.name = newName;
    UI.renderLayerList();
    AppConsole.log(`Renamed "${old}" → "${newName}"`, 'info');
  },

  moveUp(id) {
    const idx = State.layers.findIndex(l => l.id === id);
    if (idx <= 0) return;
    [State.layers[idx], State.layers[idx-1]] = [State.layers[idx-1], State.layers[idx]];
    UI.renderLayerList();
  },

  moveDown(id) {
    const idx = State.layers.findIndex(l => l.id === id);
    if (idx < 0 || idx >= State.layers.length-1) return;
    [State.layers[idx], State.layers[idx+1]] = [State.layers[idx+1], State.layers[idx]];
    UI.renderLayerList();
  },

  getLayerAsGeoJSON(id) {
    const layer = State.layers.find(l => l.id === id);
    if (!layer) return null;
    if (layer.geoJSON) return layer.geoJSON;
    if (layer.leafletLayer && layer.leafletLayer.toGeoJSON) return layer.leafletLayer.toGeoJSON();
    return null;
  },

  _enrichFeaturesWithMeasurements(geoJSON) {
    if (!geoJSON?.features) return;
    geoJSON.features.forEach(f => {
      if (!f.properties) f.properties = {};
      normalizeFeatureAreaProps(f);
      if (f.properties.name === undefined) f.properties.name = f.properties.Name || '';
      if (f.properties.deskripsi === undefined)
        f.properties.deskripsi = f.properties.description || f.properties.Description || '';
      const m = Utils.calcFeatureMeasurements(f);
      Object.keys(m).forEach(k => {
        f.properties[k] = m[k];
      });
      if (f.properties.luas === undefined) f.properties.luas = '';
    });
  },

  selectFeatureInLayer(layerId, featureIndex) {
    const entry = State.layers.find(l => l.id === layerId);
    if (!entry || !entry.geoJSON?.features) return;
    const feature = entry.geoJSON.features[featureIndex];
    if (!feature) return;
    let leafletSub = null;
    if (typeof entry.leafletLayer.eachLayer === 'function') {
      entry.leafletLayer.eachLayer(sub => { if (sub.feature === feature) leafletSub = sub; });
    }
    State.selectedLayer = layerId;
    FeatureSelect.select(feature, leafletSub || entry.leafletLayer, layerId);
    if (!UI.syncSelectionInLayerList()) UI.renderLayerList();
    try {
      const ll = leafletSub || entry.leafletLayer;
      const b = ll.getBounds ? ll.getBounds() : (ll.getLatLng ? ll.getLatLng().toBounds(50) : null);
      if (b) MapManager.map.fitBounds(b, { padding: [40, 40], maxZoom: 18 });
    } catch(e) {}
  },

  removeFeatureByIndex(layerId, featureIndex) {
    const entry = State.layers.find(l => l.id === layerId);
    if (!entry || !entry.geoJSON?.features) return;
    const feature = entry.geoJSON.features[featureIndex];
    if (!feature) return;
    const fname = feature.properties?.name || `Fitur ${featureIndex + 1}`;
    LayerManager.removeFeatureFromLayer(layerId, feature);
    Toast.show(`"${fname}" dihapus`, 'warn');
  },

  removeFeatureFromLayer(layerId, feature) {
    const entry = State.layers.find(l => l.id === layerId);
    if (!entry) return;
    if (entry.geoJSON?.features) {
      const idx = entry.geoJSON.features.indexOf(feature);
      if (idx >= 0) entry.geoJSON.features.splice(idx, 1);
    }
    entry.featureCount = entry.geoJSON?.features?.length || 0;
    if (typeof entry.leafletLayer.eachLayer === 'function') {
      entry.leafletLayer.eachLayer(sub => {
        if (sub.feature === feature) entry.leafletLayer.removeLayer(sub);
      });
    }
    if (entry.featureCount === 0) {
      LayerManager.removeLayer(layerId);
      FeatureSelect.clear();
      document.getElementById('props-content').innerHTML = emptyStateHtml('🗺', 'Klik fitur di peta untuk melihat propertinya.');
      return;
    }
    if (State.selectedFeature === feature) {
      FeatureSelect.clear();
      document.getElementById('props-content').innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">🗺</div><div class="empty-state-text">Klik fitur di peta untuk melihat propertinya.</div></div>';
    }
     this.refreshEdgeLabels(entry);
     this.refreshFeatureLabels(entry);
     AttrTable.load();
    UI.renderLayerList();
    UI.updateStats();
    AppConsole.log(`Fitur dihapus dari layer "${entry.name}"`, 'warn');
  },

  addFeatureToLayer(layerId, leafletLayer, feature) {
    const entry = State.layers.find(l => l.id === layerId);
    if (!entry) return;
    const m = Utils.calcFeatureMeasurements(feature);
    Object.assign(feature.properties, m);
    if (!entry.geoJSON) entry.geoJSON = { type: 'FeatureCollection', features: [] };
    entry.geoJSON.features.push(feature);
    entry.featureCount = entry.geoJSON.features.length;
    leafletLayer.feature = feature;
    const lid = layerId;
    leafletLayer.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      FeatureSelect.select(leafletLayer.feature, leafletLayer, lid);
    });
    leafletLayer.on('contextmenu', (e) => {
      L.DomEvent.stopPropagation(e);
      ContextMenuManager.showFeatureMenu(e, leafletLayer, lid);
    });
    if (typeof entry.leafletLayer.addLayer === 'function') {
      entry.leafletLayer.addLayer(leafletLayer);
    } else {
      leafletLayer.addTo(MapManager.map);
    }
    this.refreshEdgeLabels(entry);
    this.refreshFeatureLabels(entry);
    AttrTable.load();
    UI.renderLayerList();
    UI.updateStats();
    AppConsole.log(`Fitur ditambah ke layer "${entry.name}"`, 'success');
  }
};
