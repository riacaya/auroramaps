// =====================================================
// AuroraMaps · map.js — Leaflet map manager
// =====================================================
'use strict';

// =====================================================
// MAP MANAGER
// =====================================================
const MapManager = {
  _gpsRecording: false,
  _gpsWatchId: null,
  _gpsPoints: [],
  _gpsPreview: null,
  _gpsLastPosition: null,
  map: null,
  baseLayers: {},
  activeBaselayer: null,
  drawControl: null,
  drawnItems: null,
  measureItems: null,
  isMeasuring: false,
  measurePoints: [],
  measureLayer: null,
  _satelliteErrorFallbackUsed: false,
  _locationWatchId: null,
  _locationLayer: null,
  _locationHasCentered: false,

  init() {
    const cachedView = Storage.load('map-view', null);
    const initialCenter = cachedView && Number.isFinite(Number(cachedView.lat)) && Number.isFinite(Number(cachedView.lng))
      ? [Number(cachedView.lat), Number(cachedView.lng)] : Config.defaultCenter;
    const initialZoom = cachedView && Number.isFinite(Number(cachedView.zoom))
      ? Number(cachedView.zoom) : Config.defaultZoom;
    this.map = L.map('map', {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
      maxZoom: 22,
    });

    Object.keys(Config.baseLayers).forEach(k => {
      const cfg = Config.baseLayers[k];
      const sourceCfg = cfg;
      const layerOpts = {
        attribution: sourceCfg.attribution,
        maxZoom: sourceCfg.maxZoom
      };
      if (sourceCfg.maxNativeZoom !== undefined) layerOpts.maxNativeZoom = sourceCfg.maxNativeZoom;
      if (sourceCfg.tileSize !== undefined) layerOpts.tileSize = sourceCfg.tileSize;
      if (sourceCfg.zoomOffset !== undefined) layerOpts.zoomOffset = sourceCfg.zoomOffset;
      if (sourceCfg.opacity !== undefined) layerOpts.opacity = sourceCfg.opacity;
      this.baseLayers[k] = OfflineManager.tileLayer(sourceCfg.url, layerOpts);
      // Dark (Stadia Maps) butuh auth untuk domain production → pasang
      // deteksi penolakan tile (lihat _watchDarkAuth).
      if (k === 'dark') this._watchDarkAuth(this.baseLayers[k]);
    });
    this.baseLayers['street'].addTo(this.map);
    this.activeBaselayer = 'street';

    // Urutan layer dari belakang ke depan (z-index pane Leaflet):
    //   200 Basemap (tilePane) < 250 Overlay JPG < 300 LSD < 310 RTRW
    //   < 320 Bidang Tanah (persil, aktif 18 Agu) < 400 Data import (GeoJSON/KMZ/KML)
    //   < 500 Gambar manual (titik/poligon/kotak) < 600 marker/label
    // Pane terpisah per kategori agar urutan stabil, tidak bergantung DOM.
    this.map.createPane('imgOverlayPane');
    this.map.getPane('imgOverlayPane').style.zIndex = 250;

    this.map.createPane('dataPane');
    this.map.getPane('dataPane').style.zIndex = 400;

    this.map.createPane('drawPane');
    this.map.getPane('drawPane').style.zIndex = 500;

    this.map.createPane('bidangPane'); // slot Bidang Tanah / persil (aktif 18 Agu)
    this.map.getPane('bidangPane').style.zIndex = 320;

    this.drawnItems = new L.FeatureGroup();
    this.map.addLayer(this.drawnItems);

    this.measureItems = new L.FeatureGroup();
    this.map.addLayer(this.measureItems);

    this.drawControl = new L.Control.Draw({
      draw: {
        polyline: { shapeOptions: { color: '#3b82f6', weight: 2 } },
        polygon: { shapeOptions: { color: '#3b82f6', weight: 2, fillOpacity: 0.3 } },
        circle: { shapeOptions: { color: '#8b5cf6', weight: 2, fillOpacity: 0.2 } },
        rectangle: { shapeOptions: { color: '#22c55e', weight: 2, fillOpacity: 0.2 } },
        marker: { icon: L.divIcon({ className: 'draw-marker', html: '<div style="background:#3b82f6;width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>', iconSize:[14,14], iconAnchor:[7,7] }) },
        circlemarker: false
      },
      edit: { featureGroup: this.drawnItems }
    });

    this.map.on('draw:created', e => this._onDrawCreated(e));
    this.map.on('draw:edited', e => this._onDrawEdited(e));
    this.map.on('draw:deleted', e => this._onDrawDeleted(e));
    this.map.on('mousemove', e => this._onMouseMove(e));
    this.map.on('zoomend', () => {
      UI.updateStatusBar();
      State.layers.forEach(layer => LayerManager.refreshEdgeLabels(layer));
    });
    this.map.on('moveend', () => {
      State.layers.forEach(layer => LayerManager.refreshEdgeLabels(layer));
      const c = this.map.getCenter();
      Storage.save('map-view', { lat: c.lat, lng: c.lng, zoom: this.map.getZoom() });
    });
    this.map.on('click', e => this._onMapClick(e));
    this.map.on('contextmenu', e => this._onContextMenu(e));

    UI.updateStatusBar();
    AppConsole.log('Map initialized (Leaflet ' + L.version + ')', 'success');
  },

  switchBasemap(key) {
    // Alias lama: 'osm' kini menunjuk 'street' (OpenStreetMap)
    if (key === 'osm') key = 'street';
    if (!this.baseLayers[key]) return;
    // Mode 3D: ganti citra globe Cesium
    if (this._cesiumViewer) {
      this._add3DBaseLayer(key);
      State.currentBasemap = key;
      document.querySelectorAll('.basemap-btn').forEach(b => b.classList.toggle('active', b.dataset.layer === key));
      UI.updateStatusBar();
      AppConsole.log(`3D basemap: ${key}`, 'info');
      return;
    }
    if (this.baseLayers[this.activeBaselayer]) {
      this.map.removeLayer(this.baseLayers[this.activeBaselayer]);
    }
    this.baseLayers[key].addTo(this.map);
    this.activeBaselayer = key;
    State.currentBasemap = key;
    document.querySelectorAll('.basemap-btn').forEach(b => b.classList.toggle('active', b.dataset.layer === key));
    // Perbarui status bar agar nama basemap & level native ikut berubah
    UI.updateStatusBar();
    AppConsole.log(`Switched to ${key} basemap`, 'info');
  },

  // ── Fallback peta gelap ────────────────────────────────────────────
  // Stadia Maps melayani tile tanpa API key hanya untuk localhost atau
  // domain yang terdaftar (domain-based auth). Di host lain (mis. build blog)
  // tile dibalas 401/403 → ganti otomatis ke Esri Dark Gray (gratis, native
  // z16) supaya basemap gelap tidak pernah menampilkan tile peringatan.
  // Status dicek via fetch (Stadia mengirim CORS header access-control-allow-origin).
  // 429 (rate limit localhost) TIDAK memicu fallback — hanya 401/403.
  _darkAuthProbing: false,
  _darkFallbackUsed: false,
  _watchDarkAuth(layer) {
    layer.on('tileerror', (e) => {
      if (this._darkAuthProbing || this._darkFallbackUsed) return;
      if (!navigator.onLine || !e.coords || typeof layer.getTileUrl !== 'function') return;
      this._darkAuthProbing = true;
      fetch(layer.getTileUrl(e.coords), { method: 'GET' })
        .then(r => { if (r.status === 401 || r.status === 403) this._useDarkFallback(layer); })
        .catch(() => {}) // jaringan putus → biarkan; cache offline menangani
        .finally(() => { this._darkAuthProbing = false; });
    });
  },
  _useDarkFallback(layer) {
    this._darkFallbackUsed = true;
    const stadiaAttr = '© Stadia Maps, © OpenStreetMap contributors';
    const fbUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
    const fbAttr = '© Esri, HERE, Garmin, FAO, NOAA, USGS';
    const cfg = Config.baseLayers.dark;
    cfg.url = fbUrl; cfg.maxNativeZoom = 16; cfg.attribution = fbAttr;
    layer.options.maxNativeZoom = 16;
    layer.options.attribution = fbAttr;
    layer.setUrl(fbUrl);
    this.map?.attributionControl?.removeAttribution?.(stadiaAttr);
    this.map?.attributionControl?.addAttribution?.(fbAttr);
    UI.updateStatusBar();
    AppConsole.log('Tile dark ditolak (401/403) → fallback Esri Dark Gray (native z16)', 'warn');
  },

  _onDrawCreated(e) {
    const layer = e.layer;
    const type = e.layerType;

    const targetLayerId = State.drawTargetLayerId;
    State.drawTargetLayerId = null;
    const targetEntry = targetLayerId ? State.layers.find(l => l.id === targetLayerId) : null;
    const color = targetEntry ? targetEntry.color : Utils.nextColor();

    if (layer.setStyle) {
      layer.setStyle({ color, fillColor: color, fillOpacity: 0.3, weight: 2 });
    }
    // Pastikan hasil gambar manual selalu di drawPane (di atas data import),
    // berapa pun urutan tambah/hapus layer.
    layer.options.pane = 'drawPane';
    if (this.map.hasLayer(layer)) this.map.removeLayer(layer);

    const gj = layer.toGeoJSON ? layer.toGeoJSON() : { type: 'Feature', geometry: null, properties: {} };
    const measurements = Utils.calcLayerMeasurements(layer, type);
    const pendingBhumi = State.pendingBhumiProperties;
    gj.properties = { name: nextAutoFeatureName(), deskripsi: '', _drawType: type, ...measurements, ...(pendingBhumi || {}) };
    State.pendingBhumiProperties = null;
    // Keep the SHM area supplied by the popup; only initialize it for manual draws.
    if (gj.properties.luas === undefined) gj.properties.luas = '';

    this.drawnItems.addLayer(layer);
    layer.on('click', (ev) => this._onDrawnItemClick(ev));
    this._stopDrawTool();

    if (targetEntry) {
      LayerManager.addFeatureToLayer(targetLayerId, layer, gj);
      State.selectedLayer = targetLayerId;
      State.expandedLayers[targetLayerId] = true;
      UI.renderLayerList();
      UI.updateStats();
      AppConsole.log(`Fitur ${type} ditambah ke layer "${targetEntry.name}"`, 'success');
      FeatureSelect.select(gj, layer, targetLayerId);
    } else {
      const newId = LayerManager.addDrawnLayer(layer, gj, type, color);
      History.push({ type: 'draw_create', layerId: newId });
      UI.renderLayerList();
      UI.updateStats();
      AppConsole.log(`Drew ${type} — otomatis diberi nama ${gj.properties.name}`, 'success');
      FeatureSelect.select(layer.feature, layer, newId);
    }
  },

  _onDrawEdited(e) {
    e.layers.eachLayer(editedLeafletLayer => {
      State.layers.forEach(entry => {
        const matchDirect = entry.leafletLayer === editedLeafletLayer;
        const matchSub = typeof entry.leafletLayer.eachLayer === 'function'
          && (() => { let found = false; entry.leafletLayer.eachLayer(sl => { if (sl === editedLeafletLayer) found = true; }); return found; })();

        if (matchDirect) {
          const updatedGeoJSON = editedLeafletLayer.toGeoJSON();
          if (entry.geoJSON?.features?.length > 0) {
            entry.geoJSON.features[0].geometry = updatedGeoJSON.geometry;
            const drawType = entry.geoJSON.features[0].properties?._drawType || '';
            const newMeasure = Utils.calcLayerMeasurements(editedLeafletLayer, drawType);
            Object.assign(entry.geoJSON.features[0].properties, newMeasure);
          }
          if (editedLeafletLayer.feature) {
            editedLeafletLayer.feature.geometry = updatedGeoJSON.geometry;
            const drawType = editedLeafletLayer.feature.properties?._drawType || '';
            Object.assign(editedLeafletLayer.feature.properties, Utils.calcLayerMeasurements(editedLeafletLayer, drawType));
          }
           LayerManager.refreshEdgeLabels(entry);
           LayerManager.refreshFeatureLabels(entry);
          AppConsole.log(`Geometri "${entry.name}" diperbarui`, 'success');
        } else if (matchSub) {
          const updatedGeoJSON = editedLeafletLayer.toGeoJSON();
          if (editedLeafletLayer.feature) {
            editedLeafletLayer.feature.geometry = updatedGeoJSON.geometry;
            const idx = entry.geoJSON?.features?.indexOf(editedLeafletLayer.feature);
            if (idx >= 0) entry.geoJSON.features[idx].geometry = updatedGeoJSON.geometry;
          }
           LayerManager.refreshEdgeLabels(entry);
           LayerManager.refreshFeatureLabels(entry);
        }
      });
    });
    AppConsole.log('Fitur selesai diedit — geometri tersinkron', 'info');
    UI.updateStats();
    History.push({ type: 'edit' });
  },

  _onDrawDeleted(e) {
    AppConsole.log('Features deleted', 'info');
    UI.updateStats();
  },

  _onMouseMove(e) {
    const { lat, lng } = e.latlng;
    const s = Utils.coordStr(lat, lng);
    document.getElementById('status-cursor').textContent = s;

    if (this.isMeasuring && this.measurePoints.length > 0) {
      this._updateMeasureDisplay(e.latlng);
    }
  },

  _onMapClick(e) {
    if (this.isMeasuring) {
      this.measurePoints.push(e.latlng);
      this._addMeasurePoint(e.latlng);
      CoordLog.add(e.latlng);
      return;
    }
    CoordLog.add(e.latlng);
  },

  _onDrawnItemClick(e) {
    if (typeof MapPopup === 'undefined') return;
    if (e) L.DomEvent.stopPropagation(e);
    // HPA and drawn-feature details share the single MapPopup surface.
    // Close any legacy Leaflet popup so two cards cannot remain visible.
    this.map?.closePopup?.();
    const layer = e.layer || e.target;
    if (!layer || !layer.feature) return;
    const f = layer.feature;
    if (!f) return;
    // Popup is a read-only view of the same metadata object used by Edit.
    normalizeFeatureAreaProps(f);
    Object.assign(f.properties, Utils.calcFeatureMeasurements(f));
    const p = f.properties || {};
    const g = f.geometry;
    const drawType = p._drawType || '';
    const rows = [
      ['Nama', p.name || p.Name || ''],
      ['Deskripsi', p.deskripsi || p.description || p.Description || ''],
      ['Luas', p.luas || ''],
      ['NIB', p.nib || p.NIB || ''],
      ['Keterangan', p.keterangan || p.Keterangan || ''],
      ['Luas Poligon', p.luas_poligon || ''],
      ['Keliling', p.keliling || p.panjang || '']
    ];
    const formatPopupValue = (label, value) => {
      if (!value) return '';
      const text = String(value);
      if (label === 'Luas' && /\d/.test(text) && !/m\u00B2/.test(text)) return text + ' m\u00B2';
      if ((label === 'Luas Poligon') && /\d/.test(text) && !/m\u00B2/.test(text)) return text + ' m\u00B2';
      if (label === 'Keliling' && /\d/.test(text) && !/ m/.test(text)) return text + ' m';
      return text;
    };
    const icon = { point: '\u{1F4CD}', linestring: '\u{1F4CF}', polygon: '\u{1F4D0}' }[drawType] || '\u{1F4D0}';
    MapPopup.show(`
      <div class="mp-header">
        <span class="mp-title">${icon} ${Utils.escapeHtml(rows[0][1] || 'Fitur')}</span>
        <button class="mp-close" onclick="MapPopup.hide()">\u2715</button>
      </div>
      <table>
        ${rows.filter(([, v]) => v != null && v !== '').map(([k, v]) => `<tr><th>${k}</th><td>${Utils.escapeHtml(formatPopupValue(k, v))}</td></tr>`).join('')}
      </table>
    `);
  },

  _onContextMenu(e) {
    ContextMenuManager.showMapMenu(e);
  },

  startDraw(type) {
    this._stopDrawTool();
    const handlers = {
      point: () => new L.Draw.Marker(this.map, this.drawControl.options.draw.marker),
      line:  () => new L.Draw.Polyline(this.map, this.drawControl.options.draw.polyline),
      poly:  () => new L.Draw.Polygon(this.map, this.drawControl.options.draw.polygon),
      rect:  () => new L.Draw.Rectangle(this.map, this.drawControl.options.draw.rectangle),
      circle:() => new L.Draw.Circle(this.map, this.drawControl.options.draw.circle),
    };
    if (!handlers[type]) return;
    State.activeDrawTool = handlers[type]();
    State.activeDrawType = type;
    State.activeDrawTool.enable();
    if (window.BhumiIdentify) BhumiIdentify.pauseOverlay();
    document.querySelectorAll('.draw-tools-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('dt-' + type)?.classList.add('active');
    AppConsole.log(`Draw ${type} tool active. Click to place.`, 'info');
  },

  toggleDraw(type) {
    // Menggambar hanya di peta 2D
    if (this._cesiumViewer) {
      Toast.show('Mode menggambar hanya aktif di peta 2D', 'warn');
      return;
    }
    // Klik ikon yang sama / tekan Esc → batalkan mode menggambar
    if (State.activeDrawType === type && State.activeDrawTool) {
      this._stopDrawTool();
      return;
    }
    this.startDraw(type);
  },

  cancelDraw() {
    this._stopDrawTool();
  },

  _stopDrawTool() {
    if (State.activeDrawTool) {
      State.activeDrawTool.disable();
      State.activeDrawTool = null;
    }
    State.activeDrawType = null;
    document.querySelectorAll('.draw-tools-btn').forEach(b => b.classList.remove('active'));
    if (window.BhumiIdentify) BhumiIdentify.resumeOverlay();
    // Bersihkan mode gambar mobile (crosshair) jika aktif
    const crosshair = document.getElementById('mobile-crosshair');
    if (crosshair) crosshair.style.display = 'none';
  },

  startMeasureDist() {
    this._stopMeasure();
    this.isMeasuring = true;
    State.activeMeasureTool = 'dist';
    this.measurePoints = [];
    this.map.getContainer().style.cursor = 'crosshair';
    this.map.doubleClickZoom.disable();
    this._measureDblHandler = () => {
      if (this.measurePoints.length > 0) this.measurePoints.pop();
      this._drawMeasureLine();
      this._finishMeasure();
    };
    this.map.on('dblclick', this._measureDblHandler);
    Toast.show('Klik untuk menambah titik, dobel-klik untuk selesai', 'info');
    AppConsole.log('Distance: klik → tambah titik, dobel-klik → selesai.', 'info');
    document.getElementById('tb-measure-dist')?.classList.add('active');
  },

  _addMeasurePoint(latlng) {
    const pt = L.circleMarker(latlng, { radius: 4, color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 1, weight: 2 });
    this.measureItems.addLayer(pt);

    if (this.measurePoints.length > 1) {
      this._drawMeasureLine();
    }
  },

  _drawMeasureLine() {
    this.measureItems.clearLayers();
    this.measurePoints.forEach(p => {
      const pt = L.circleMarker(p, { radius: 4, color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 1, weight: 2 });
      this.measureItems.addLayer(pt);
    });
    if (this.measurePoints.length > 1) {
      const line = L.polyline(this.measurePoints, { color: '#f59e0b', weight: 2, dashArray: '6,4' });
      this.measureItems.addLayer(line);
    }
  },

  _updateMeasureDisplay(latlng) {
    if (this.measurePoints.length < 1) return;
    const pts = [...this.measurePoints, latlng];
    if (State.activeMeasureTool === 'dist') {
      const d = Utils.polylineLength(pts);
      document.getElementById('status-ready').textContent = '📏 ' + Utils.formatDist(d);
    } else {
      if (pts.length > 2) {
        const a = Utils.polygonArea(pts);
        document.getElementById('status-ready').textContent = '⬜ ' + Utils.formatArea(a);
      }
    }
  },

  _finishMeasure() {
    this.isMeasuring = false;
    this.map.getContainer().style.cursor = '';
    const pts = this.measurePoints;
    if (pts.length < 2) { this._stopMeasure(); return; }

    let result;
    if (State.activeMeasureTool === 'dist') {
      result = '📏 Total distance: ' + Utils.formatDist(Utils.polylineLength(pts));
    } else if (pts.length > 2) {
      result = '⬜ Total area: ' + Utils.formatArea(Utils.polygonArea(pts));
    }

    if (result) {
      Toast.show(result, 'success');
      AppConsole.log(result, 'success');
      document.getElementById('status-ready').textContent = result;
    }
    document.querySelectorAll('[id^="tb-measure"]').forEach(b => b.classList.remove('active'));
  },

  _stopMeasure() {
    this.isMeasuring = false;
    State.activeMeasureTool = null;
    this.measurePoints = [];
    this.measureItems.clearLayers();
    this.map.getContainer().style.cursor = '';
    this.map.doubleClickZoom.enable();
    if (this._measureDblHandler) {
      this.map.off('dblclick', this._measureDblHandler);
      this._measureDblHandler = null;
    }
    document.querySelectorAll('[id^="tb-measure"]').forEach(b => b.classList.remove('active'));
    document.getElementById('status-ready').textContent = 'Ready';
  },

  zoomToAll() {
    const bounds = [];
    State.layers.forEach(l => {
      if (l.leafletLayer) {
        try {
          const b = l.leafletLayer.getBounds();
          if (b.isValid()) bounds.push(b);
        } catch(e) {}
      }
    });
    if (bounds.length === 0) { Toast.show('No layers to zoom to', 'warn'); return; }
    const merged = bounds.reduce((acc, b) => acc.extend(b), bounds[0]);
    this.map.fitBounds(merged, { padding: [30, 30] });
  },

  toggleMyLocation() {
    if (!navigator.geolocation) {
      Toast.show('Browser ini tidak mendukung akses lokasi', 'error');
      return;
    }

    if (this._cesiumViewer) {
      this._fly3DToUserLocation();
      return;
    }

    if (this._locationWatchId !== null) {
      this.stopLocationTracking();
      Toast.show('Pelacakan lokasi dihentikan', 'info');
      return;
    }

    const button = document.getElementById('btn-my-location');
    if (button) {
      button.classList.add('active');
      button.title = 'Hentikan pelacakan lokasi';
      button.setAttribute('aria-label', 'Hentikan pelacakan lokasi');
    }
    this._locationHasCentered = false;
    Toast.show('Meminta izin akses lokasi…', 'info');

    this._locationWatchId = navigator.geolocation.watchPosition(
      position => this._updateMyLocation(position),
      error => {
        const messages = {
          1: 'Akses lokasi ditolak. Izinkan lokasi di browser untuk menggunakannya.',
          2: 'Lokasi tidak tersedia saat ini.',
          3: 'Permintaan lokasi habis waktu. Coba lagi.'
        };
        this.stopLocationTracking();
        Toast.show(messages[error.code] || 'Gagal mendapatkan lokasi perangkat', 'error');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  },

  toggleGPSRecording() {
    if (this._gpsRecording) { this.stopGPSRecording(); return; }
    if (!navigator.geolocation) { Toast.show('Browser tidak mendukung GPS', 'error'); return; }
    this._gpsRecording = true;
    this._gpsCoordinateOnly = Storage.load('gps-coordinate-only', false) === true;
    if (this._gpsCoordinateOnly && this.baseLayers[this.activeBaselayer]) this.map.removeLayer(this.baseLayers[this.activeBaselayer]);
    this._gpsPoints = [];
    this._gpsLastPosition = null;
    document.querySelectorAll('#tb-gps-record,#mm-gps-record').forEach(b => { b.classList.add('active'); b.textContent = b.id === 'tb-gps-record' ? '⏹ Selesai GPS' : '⏹ Selesai Rekam GPS'; });
    Toast.show('GPS aktif. Peta mengikuti lokasi Anda.', 'info');
    if (this._locationWatchId === null) this.toggleMyLocation();
    this._gpsWatchId = navigator.geolocation.watchPosition(pos => {
      const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
      const last = this._gpsLastPosition;
      if (last && this.map.distance(last, ll) < 5) return;
      this._gpsLastPosition = ll;
      this._gpsPoints.push(ll);
      if (this._gpsPreview) this._gpsPreview.setLatLngs(this._gpsPoints);
      else this._gpsPreview = L.polyline(this._gpsPoints, { color: '#ef4444', weight: 4, dashArray: '7,5', pane: 'drawPane' }).addTo(this.map);
    }, err => Toast.show('GPS survey gagal: ' + err.message, 'error'), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  },

  stopGPSRecording() {
    if (this._gpsWatchId !== null) navigator.geolocation.clearWatch(this._gpsWatchId);
    this._gpsWatchId = null;
    this._gpsRecording = false;
    if (this._gpsCoordinateOnly && this.baseLayers[this.activeBaselayer]) this.baseLayers[this.activeBaselayer].addTo(this.map);
    this._gpsCoordinateOnly = false;
    document.querySelectorAll('#tb-gps-record,#mm-gps-record').forEach(b => { b.classList.remove('active'); b.textContent = b.id === 'tb-gps-record' ? '📍 Rekam GPS' : '📍 Rekam GPS'; });
    if (this._gpsPreview) { this._gpsPreview.remove(); this._gpsPreview = null; }
    if (this._gpsPoints.length < 2) { this._gpsPoints = []; Toast.show('Belum cukup titik GPS', 'warn'); return; }
    const first = this._gpsPoints[0], last = this._gpsPoints[this._gpsPoints.length - 1];
    const closed = this.map.distance(first, last) <= 10 && this._gpsPoints.length >= 3;
    const type = closed ? 'polygon' : 'polyline';
    const layer = closed ? L.polygon(this._gpsPoints, { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.25, weight: 3, pane: 'drawPane' }) : L.polyline(this._gpsPoints, { color: '#ef4444', weight: 3, pane: 'drawPane' });
    const gj = layer.toGeoJSON();
    gj.properties = { name: closed ? 'Survey Bidang GPS' : 'Survey Jarak GPS', _drawType: closed ? 'poly' : 'line', deskripsi: closed ? 'Hasil rekam GPS — bidang' : 'Hasil rekam GPS — jarak', luas: '', keterangan: `Jarak: ${Utils.formatDist(Utils.polylineLength(this._gpsPoints))}` };
    const id = LayerManager.addDrawnLayer(layer, gj, type);
    FeatureSelect.select(layer.feature, layer, id);
    this._gpsPoints = [];
    Toast.show(closed ? 'Rute kembali ke awal: disimpan sebagai bidang' : 'Rute terbuka: disimpan sebagai garis jarak', 'success');
  },

  _updateMyLocation(position) {
    const { latitude, longitude, accuracy } = position.coords;
    const latlng = [latitude, longitude];
    if (!this._locationLayer) {
      this._locationLayer = L.layerGroup().addTo(this.map);
    }
    this._locationLayer.clearLayers();
    L.circle(latlng, {
      radius: Math.max(Number(accuracy) || 0, 5),
      color: '#3b82f6',
      weight: 1,
      fillColor: '#3b82f6',
      fillOpacity: 0.12,
      interactive: false
    }).addTo(this._locationLayer);
    L.marker(latlng, {
      icon: L.divIcon({
        className: '',
        html: '<div class="location-marker-pulse"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      }),
      interactive: false
    }).addTo(this._locationLayer);

    if (!this._locationHasCentered) {
      this.map.setView(latlng, Math.max(this.map.getZoom(), 16), { animate: true });
      this._locationHasCentered = true;
      Toast.show(`Lokasi ditemukan (akurasi ±${Math.round(accuracy || 0)} m)`, 'success');
    } else {
      this.map.panTo(latlng, { animate: true, duration: 0.35 });
    }
  },

  stopLocationTracking() {
    if (this._locationWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this._locationWatchId);
    }
    this._locationWatchId = null;
    this._locationHasCentered = false;
    const button = document.getElementById('btn-my-location');
    if (button) {
      button.classList.remove('active');
      button.title = 'Tampilkan lokasi saya';
      button.setAttribute('aria-label', 'Tampilkan lokasi saya');
    }
  },

  // ── 3D View (CesiumJS di kanvas yang sama, dimuat lazy) ──
  _cesiumViewer: null,
  _cesiumEntities: [],
  _loading3D: false,

  async toggle3D() {
    if (this._cesiumViewer) {
      this.close3D();
      return;
    }
    // ATR/BPN TIDAK kompatibel dengan globe 3D: RTR Provinsi di-render per-tile
    // via export ArcGIS (membanjiri proxy publik saat globe diputar), dan layer
    // XYZ tanpa batas zoom jadi kosong di zoom dalam. Karena itu mode 3D diblokir
    // selama ada layer ATR/BPN yang aktif (fallback sesuai permintaan USER).
    if (typeof AtrbpnLayers !== 'undefined' && AtrbpnLayers._layers &&
        Object.values(AtrbpnLayers._layers).some(l => l.on)) {
      Toast.show('Matikan layer ATR/BPN dulu untuk masuk mode 3D', 'warn');
      AppConsole.log('Mode 3D diblokir: layer ATR/BPN masih aktif', 'warn');
      return;
    }
    // Abaikan klik ganda saat Cesium masih dimuat
    if (this._loading3D) return;
    this._loading3D = true;
    // Batalkan mode menggambar sebelum masuk 3D (gambar hanya di 2D)
    this.cancelDraw();
    const btn = document.getElementById('btn-3d');
    if (btn) btn.classList.add('active');
    try {
      await this._ensureCesium();
      this._open3DView();
    } catch (e) {
      Toast.show('Gagal memuat tampilan 3D: ' + (e.message || 'Cesium tidak tersedia'), 'error');
      AppConsole.log('3D load error: ' + e.message, 'error');
      if (btn) btn.classList.remove('active');
    } finally {
      this._loading3D = false;
    }
  },

  zoomIn() {
    if (this._cesiumViewer) {
      const h = this._cesiumViewer.camera.positionCartographic.height;
      this._cesiumViewer.camera.zoomIn(Math.max(500, h * 0.4));
      return;
    }
    this.map.zoomIn();
  },

  zoomOut() {
    if (this._cesiumViewer) {
      const h = this._cesiumViewer.camera.positionCartographic.height;
      this._cesiumViewer.camera.zoomOut(Math.max(500, h * 0.4));
      return;
    }
    this.map.zoomOut();
  },

  _ensureCesium() {
    if (window.Cesium) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (!document.getElementById('cesium-css')) {
        const l = document.createElement('link');
        l.id = 'cesium-css';
        l.rel = 'stylesheet';
        l.href = 'https://unpkg.com/cesium@1.111.0/Build/Cesium/Widgets/widgets.css';
        document.head.appendChild(l);
      }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/cesium@1.111.0/Build/Cesium/Cesium.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('CDN Cesium tidak dapat dimuat'));
      document.head.appendChild(s);
    });
  },

  // Ganti/muat citra globe Cesium sesuai basemap yang dipilih (osm/satellite/topo/dark)
  _add3DBaseLayer(key) {
    const C = window.Cesium;
    const viewer = this._cesiumViewer;
    if (!viewer || !C) return;
    this._cesiumTileFails = 0;
    if (this._cesiumImagery) {
      viewer.imageryLayers.remove(this._cesiumImagery, true);
      this._cesiumImagery = null;
    }
    // maximumLevel = batas data asli (sama dengan maxNativeZoom 2D): di atasnya
    // Cesium minta tile yang tidak ada (mis. Esri z20+ = tile putih kosong).
    const providers = {
      street: new C.UrlTemplateImageryProvider({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        maximumLevel: 19,
        credit: '© OpenStreetMap contributors'
      }),
      satellite: new C.UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maximumLevel: 19,
        credit: '© Esri'
      }),
      topo: new C.UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        maximumLevel: 19,
        credit: '© Esri'
      }),
      // Carto (voyager/dark) kini wajib API key → pakai OSM & Stadia, sama
      // dengan basemap 2D. Bila tile ditolak, handler errorEvent di bawah
      // melakukan fallback otomatis ke street.
      dark: new C.UrlTemplateImageryProvider({
        url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png',
        maximumLevel: 21,
        credit: '© Stadia Maps, © OpenStreetMap contributors'
      })
    };
    const provider = providers[key] || providers.street;
    this._cesiumImagery = viewer.imageryLayers.addImageryProvider(provider);
    // Deteksi kegagalan tiles (mis. domain diblokir/offline) → fallback otomatis ke street
    // agar globe tidak "berhenti di langit" (biru kosong tanpa citra)
    if (provider.errorEvent) {
      provider.errorEvent.addEventListener((err) => {
        if (err && err.message) AppConsole.log(`3D tile error (${key}): ${err.message}`, 'error');
        this._cesiumTileFails = (this._cesiumTileFails || 0) + 1;
        if (this._cesiumTileFails >= 3 && key !== 'street') {
          this._cesiumTileFails = 0;
          AppConsole.log(`3D basemap "${key}" gagal dimuat — fallback ke Street`, 'warn');
          Toast.show('Basemap 3D gagal dimuat — beralih ke Street', 'warn');
          State.currentBasemap = 'street';
          document.querySelectorAll('.basemap-btn').forEach(b => b.classList.toggle('active', b.dataset.layer === 'street'));
          this._add3DBaseLayer('street');
        }
      });
    }
  },

  // Sinkronkan layer 2D (titik/garis/poligon + label) ke globe 3D
  _syncLayersTo3D() {
    const C = window.Cesium;
    const viewer = this._cesiumViewer;
    if (!viewer || !C) return;
    if (this._cesiumEntities.length) {
      this._cesiumEntities.forEach(e => { try { viewer.entities.remove(e); } catch (err) {} });
      this._cesiumEntities = [];
    }
    State.layers.forEach(entry => {
      if (entry.visible === false) return;
      const color = C.Color.fromCssColorString(entry.color || '#ff8c00');
      const features = entry.geoJSON?.features || [];
      features.forEach(f => {
        const g = f.geometry;
        if (!g) return;
        const props = f.properties || {};
        const labelText = this._labelFor3D(entry, props);
        if (g.type === 'Point') {
          this._cesiumEntities.push(viewer.entities.add({
            position: C.Cartesian3.fromDegrees(g.coordinates[0], g.coordinates[1]),
            point: { pixelSize: 8, color, outlineColor: C.Color.WHITE.withAlpha(0.85), outlineWidth: 1 },
            label: labelText ? this._labelGraphics3D(labelText) : undefined,
            properties: { layerId: entry.id }
          }));
        } else if (g.type === 'LineString' || g.type === 'MultiLineString') {
          const lines = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
          lines.forEach(line => {
            if (line.length < 2) return;
            this._cesiumEntities.push(viewer.entities.add({
              polyline: {
                positions: C.Cartesian3.fromDegreesArray(line.map(c => [c[0], c[1]]).flat()),
                width: 3,
                material: color,
                clampToGround: true
              },
              properties: { layerId: entry.id }
            }));
          });
        } else if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
          const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
          polys.forEach(poly => {
            if (!poly.length) return;
            const outer = poly[0].map(c => [c[0], c[1]]);
            if (outer.length < 3) return;
            const holes = poly.slice(1).map(h => h.map(c => [c[0], c[1]]));
            this._cesiumEntities.push(viewer.entities.add({
              polygon: {
                hierarchy: new C.PolygonHierarchy(
                  C.Cartesian3.fromDegreesArray(outer.flat()),
                  holes.length ? holes.map(h => C.Cartesian3.fromDegreesArray(h.flat())) : undefined
                ),
                height: 0,
                material: color.withAlpha(0.45),
                outline: true,
                outlineColor: color
              },
              label: labelText ? this._labelGraphics3D(labelText, this._centroid3D(outer)) : undefined,
              properties: { layerId: entry.id }
            }));
          });
        }
      });
    });
  },

  _labelFor3D(entry, props) {
    if (entry.showLabels !== true) return '';
    const source = ['name', 'shm', 'luas', 'deskripsi', 'nib', 'keterangan', 'none'].includes(entry.labelSource) ? entry.labelSource : 'name';
    const values = {
      name: props.name ?? props.Name ?? entry.name,
      shm: props.shm ?? props.SHM,
      luas: props.luas,
      deskripsi: props.deskripsi ?? props.description ?? props.Description,
      nib: props.nib ?? props.NIB,
      keterangan: props.keterangan ?? props.Keterangan
    };
    if (source === 'none') return '';
    const v = values[source];
    return v === undefined || v === null ? '' : String(v).trim();
  },

  _labelGraphics3D(text, position) {
    const C = window.Cesium;
    const g = {
      text,
      font: '12px sans-serif',
      fillColor: C.Color.WHITE,
      outlineColor: C.Color.BLACK,
      outlineWidth: 3,
      style: C.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new C.Cartesian2(0, -14),
      showBackground: true,
      backgroundColor: C.Color.BLACK.withAlpha(0.45),
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    };
    if (position) g.position = position;
    return g;
  },

  _centroid3D(coords) {
    const C = window.Cesium;
    let x = 0, y = 0;
    coords.forEach(c => { x += c[0]; y += c[1]; });
    return C.Cartesian3.fromDegrees(x / coords.length, y / coords.length);
  },

  _open3DView() {
    const C = window.Cesium;
    const container = document.getElementById('cesium-container');
    if (!container) return;
    document.getElementById('map-container')?.classList.add('viewing-3d');

    const viewer = new C.Viewer(container, {
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false
    });
    this._cesiumViewer = viewer;
    // ATR/BPN hanya untuk panduan menggambar di 2D → nonaktifkan saat mode 3D
    this._setAtrbpnEnabled(false);
    // Citra globe mengikuti basemap aktif (Cesium 1.11x: tambahkan eksplisit)
    this._add3DBaseLayer(State.currentBasemap || 'street');
    // Update jarum kompas setiap kamera berputar
    viewer.camera.changed.addEventListener(() => this._updateCompass3D());

    // Arahkan kamera ke area peta 2D saat ini (bounding box) agar isi peta + layer ikut terlihat
    const bounds = this.map.getBounds();
    const cLng = (bounds.getWest() + bounds.getEast()) / 2;
    const cLat = (bounds.getSouth() + bounds.getNorth()) / 2;
    const latSpanM = (bounds.getNorth() - bounds.getSouth()) * 111320;
    const lngSpanM = (bounds.getEast() - bounds.getWest()) * 111320 * Math.cos(cLat * Math.PI / 180);
    const maxSpan = Math.max(latSpanM, lngSpanM, 500);
    const height = Math.max(2000, maxSpan * 2.2);
    // Kamera sedikit di selatan target, menghadap utara dengan tilt -45° → fitur terpusat + efek 3D
    const camLat = cLat - (height * 0.9) / 111320;
    const dest = C.Cartesian3.fromDegrees(cLng, camLat, height);
    const orient = { heading: 0, pitch: C.Math.toRadians(-45), roll: 0 };
    // Langsung ke posisi — tanpa animasi terbang (bola berputar) biar responsif
    viewer.camera.setView({ destination: dest, orientation: orient });
    this._updateCompass3D();
    // Sinkronkan semua layer 2D (titik/garis/poligon + label) ke globe
    this._syncLayersTo3D();
    AppConsole.log('3D view aktif — layer 2D ikut ditampilkan', 'success');
  },

  // Update jarum kompas mengikuti heading kamera (heading 0 = utara di atas)
  _updateCompass3D() {
    const v = this._cesiumViewer;
    const needle = document.querySelector('#compass-3d svg');
    if (!v || !needle) return;
    const headingDeg = (v.camera.heading * 180 / Math.PI) % 360;
    needle.style.transform = `rotate(${-headingDeg}deg)`;
    const btn = document.getElementById('compass-3d');
    if (btn) {
      const rotated = Math.abs(headingDeg) > 0.5;
      btn.classList.toggle('active', rotated);
    }
  },

  // Kembalikan arah utara di mode 3D (heading 0) tanpa mengubah posisi/tilt
  reset3DHeading() {
    const v = this._cesiumViewer;
    if (!v || !window.Cesium) return;
    const C = window.Cesium;
    const cam = v.camera;
    cam.setView({
      destination: cam.position,
      orientation: { heading: 0, pitch: cam.pitch, roll: 0 }
    });
    this._updateCompass3D();
    AppConsole.log('Arah utara dikembalikan', 'info');
  },

  // Tombol lokasi saat mode 3D aktif: terbang ke posisi perangkat di globe
  _fly3DToUserLocation() {
    const C = window.Cesium;
    if (!navigator.geolocation) { Toast.show('Geolokasi tidak didukung', 'warn'); return; }
    Toast.show('Mencari lokasi…', 'info');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        this._cesiumViewer.camera.flyTo({
          destination: C.Cartesian3.fromDegrees(longitude, latitude, 6000),
          orientation: { heading: 0, pitch: C.Math.toRadians(-55), roll: 0 },
          duration: 1.5
        });
        Toast.show('Lokasi ditemukan', 'success');
      },
      () => Toast.show('Gagal mendapatkan lokasi', 'error')
    );
  },

  close3D() {
    if (this._cesiumViewer) {
      try { this._cesiumViewer.destroy(); } catch (e) {}
      this._cesiumViewer = null;
    }
    this._cesiumEntities = [];
    this._cesiumImagery = null;
    document.getElementById('map-container')?.classList.remove('viewing-3d');
    this._setAtrbpnEnabled(true);
    const btn = document.getElementById('btn-3d');
    if (btn) btn.classList.remove('active');
    // Sinkronkan basemap 2D dengan pilihan terakhir di 3D
    this.switchBasemap(State.currentBasemap || 'street');
  },

  // ATR/BPN (LSD & RTRW) hanya untuk panduan menggambar di 2D,
  // jadi tombolnya dinonaktifkan selama mode 3D aktif.
  _setAtrbpnEnabled(enabled) {
    ['btn-atrbpn', 'mm-atrbpn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
  },

  getScale() {
    const zoom = this.map.getZoom();
    const lat = this.map.getCenter().lat;
    const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
    const scale = Math.round(metersPerPixel * 96 / 0.0254);
    return '1:' + scale.toLocaleString();
  },
};
