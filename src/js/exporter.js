// =====================================================
// AuroraMaps · exporter.js — Exports (GeoJSON/KML/CSV/XLSX/ZIP/image)
// =====================================================
'use strict';

// =====================================================
// EXPORT MANAGER
// =====================================================
const Exporter = {
  _cleanExportCollection(collection) {
    if (!collection?.features) return collection;
    return { ...collection, features: collection.features.map((feature, index) => {
      const properties = featureExportRow(feature, index);
      const circleRadius = LayerManager._circleRadiusMeters(feature);
      if (circleRadius) {
        properties._drawType = 'circle';
        properties.radius_m = circleRadius;
        properties.radius = Utils.formatDist(circleRadius);
      }
      return { ...feature, properties };
    }) };
  },

  exportGeoJSON(layerId, filename) {
    const gj = LayerManager.getLayerAsGeoJSON(layerId);
    if (!gj) { Toast.show('No data to export', 'warn'); return; }
    this._syncDrawnGeometry(layerId, gj);
    const name = filename || (State.layers.find(l => l.id === layerId)?.name || 'export').replace(/[^a-zA-Z0-9\-_]/g, '_');
    const blob = new Blob([JSON.stringify(this._cleanExportCollection(gj), null, 2)], { type: 'application/geo+json' });
    this._download(blob, name + '.geojson');
    AppConsole.log(`Exported GeoJSON: ${name}.geojson`, 'success');
    Toast.show(`Disimpan: ${name}.geojson`, 'success');
  },

  exportFeatureGeoJSON(layerId, featureIndex) {
    const entry = State.layers.find(l => l.id === layerId);
    if (!entry || !entry.geoJSON?.features?.[featureIndex]) { Toast.show('Fitur tidak ditemukan', 'warn'); return; }
    const feature = entry.geoJSON.features[featureIndex];
    this._syncDrawnGeometry(layerId, { type: 'FeatureCollection', features: [feature] });
    const layerName = this._safeExportName(entry.name, 'bidang');
    const featureName = feature.properties?.name || feature.properties?.Name || feature.properties?.nib || `bidang_${featureIndex + 1}`;
    const name = layerName + '_' + this._safeExportName(featureName, 'fitur');
    const fc = { type: 'FeatureCollection', features: [feature] };
    const blob = new Blob([JSON.stringify(this._cleanExportCollection(fc), null, 2)], { type: 'application/geo+json' });
    this._download(blob, name + '.geojson');
    AppConsole.log(`Exported feature GeoJSON: ${name}.geojson`, 'success');
    Toast.show(`Disimpan: ${name}.geojson`, 'success');
  },

  exportFeatureKML(layerId, featureIndex) {
    const entry = State.layers.find(l => l.id === layerId);
    if (!entry || !entry.geoJSON?.features?.[featureIndex]) { Toast.show('Fitur tidak ditemukan', 'warn'); return; }
    const feature = entry.geoJSON.features[featureIndex];
    this._syncDrawnGeometry(layerId, { type: 'FeatureCollection', features: [feature] });
    const layerName = this._safeExportName(entry.name, 'bidang');
    const featureName = feature.properties?.name || feature.properties?.Name || feature.properties?.nib || `bidang_${featureIndex + 1}`;
    const name = layerName + '_' + this._safeExportName(featureName, 'fitur');
    const fc = { type: 'FeatureCollection', features: [feature] };
    const kml = this._geojsonToKML(this._cleanExportCollection(fc));
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    this._download(blob, name + '.kml');
    AppConsole.log(`Exported feature KML: ${name}.kml`, 'success');
    Toast.show(`Disimpan: ${name}.kml`, 'success');
  },

  exportKML(layerId, filename) {
    const gj = LayerManager.getLayerAsGeoJSON(layerId);
    if (!gj) { Toast.show('No data to export', 'warn'); return; }
    this._syncDrawnGeometry(layerId, gj);
    const name = filename || (State.layers.find(l => l.id === layerId)?.name || 'export').replace(/[^a-zA-Z0-9\-_]/g, '_');
    const kml = this._geojsonToKML(this._cleanExportCollection(gj));
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    this._download(blob, name + '.kml');
    AppConsole.log(`Exported KML: ${name}.kml`, 'success');
    Toast.show(`Disimpan: ${name}.kml`, 'success');
  },

  exportCSV(layerId, filename) {
    const gj = LayerManager.getLayerAsGeoJSON(layerId);
    if (!gj || !gj.features?.length) { Toast.show('No data to export', 'warn'); return; }
    this._syncDrawnGeometry(layerId, gj);
    const name = filename || (State.layers.find(l => l.id === layerId)?.name || 'export').replace(/[^a-zA-Z0-9\-_]/g, '_');
    // Collect all property keys
    const allKeys = new Set();
    gj.features.forEach(f => { Object.keys(f.properties || {}).forEach(k => allKeys.add(k)); });
    allKeys.add('geometry_type');
    allKeys.add('coordinates');
    const keys = [...allKeys];
    // Build CSV
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = [keys.map(esc).join(',')];
    gj.features.forEach(f => {
      const p = f.properties || {};
      const g = f.geometry;
      const coords = g ? JSON.stringify(g.coordinates) : '';
      const row = keys.map(k => {
        if (k === 'geometry_type') return esc(g?.type || '');
        if (k === 'coordinates') return esc(coords);
        return esc(p[k]);
      });
      rows.push(row.join(','));
    });
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    this._download(blob, name + '.csv');
    AppConsole.log(`Exported CSV: ${name}.csv (${gj.features.length} features)`, 'success');
    Toast.show(`Disimpan: ${name}.csv`, 'success');
  },

  exportFeatureCSV(layerId, featureIndex) {
    const entry = State.layers.find(l => l.id === layerId);
    if (!entry || !entry.geoJSON?.features?.[featureIndex]) { Toast.show('Fitur tidak ditemukan', 'warn'); return; }
    const feature = entry.geoJSON.features[featureIndex];
    const gj = { type: 'FeatureCollection', features: [feature] };
    const layerName = this._safeExportName(entry.name, 'bidang');
    const featureName = feature.properties?.name || feature.properties?.Name || feature.properties?.nib || `bidang_${featureIndex + 1}`;
    const name = layerName + '_' + this._safeExportName(featureName, 'fitur');
    this.exportCSV(null, name);
  },

  _geojsonToKMLGeometryOnly(gj) {
    const fmt = (c) => c[0] + ',' + c[1] + ',0';
    const ringToKML = (ring) => ring.map(fmt).join(' ');
    const polygonToKML = (poly) =>
      `    <Polygon><outerBoundaryIs><LinearRing><coordinates>${ringToKML(poly[0])}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
    const placemarks = [];
    (gj.features || []).forEach(f => {
      const g = f.geometry;
      if (!g) return;
      if (g.type === 'Polygon') {
        placemarks.push(`  <Placemark>\n${polygonToKML(g.coordinates)}\n  </Placemark>`);
      } else if (g.type === 'MultiPolygon') {
        g.coordinates.forEach(poly => placemarks.push(`  <Placemark>\n${polygonToKML(poly)}\n  </Placemark>`));
      }
    });
    return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n${placemarks.join('\n')}\n</Document>\n</kml>`;
  },

  _safeExportName(value, fallback = 'export') {
    return Utils.safeName(value, fallback);
  },

  _collectGeoJSON(layerIds) {
    const collection = { type: 'FeatureCollection', features: [] };
    layerIds.forEach(id => {
      const gj = LayerManager.getLayerAsGeoJSON(id);
      if (gj) {
        this._syncDrawnGeometry(id, gj);
        if (gj.features) collection.features.push(...gj.features);
      }
    });
    return collection.features.length ? collection : null;
  },

  _excelBlob(features) {
    if (typeof XLSX === 'undefined') return null;
    const rows = features.map((f, idx) => featureExportRow(f, idx));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ['nama', 'deskripsi', 'nib', 'shm', 'luas', 'luas_poligon', 'keliling', 'keterangan', 'koordinat', 'maps']
    });
    XLSX.utils.book_append_sheet(wb, ws, 'Atribut');
    const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },

  _buildExportBlob(collection, format) {
    collection = this._cleanExportCollection(collection);
    if (format === 'geojson') {
      return new Blob([JSON.stringify(collection, null, 2)], { type: 'application/geo+json' });
    }
    if (format === 'kml') {
      return new Blob([this._geojsonToKML(collection)], { type: 'application/vnd.google-earth.kml+xml' });
    }
    if (format === 'kml-poly') {
      // KML poligon bersih: hanya geometri Polygon/MultiPolygon, properti dibersihkan
      return new Blob([this._geojsonToKMLGeometryOnly(collection)], { type: 'application/vnd.google-earth.kml+xml' });
    }
    if (format === 'xlsx') {
      const blob = this._excelBlob(collection.features || []);
      if (!blob) throw new Error('Library Excel belum dimuat');
      return blob;
    }
    return null;
  },

  async _buildKMZBlob(collection) {
    const zip = new JSZip();
    zip.file('doc.kml', this._geojsonToKML(collection));
    return zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
  },

  _validateCoordinate(coord, path, errors) {
    if (!Array.isArray(coord) || coord.length < 2) {
      errors.push(`${path}: koordinat tidak lengkap`);
      return false;
    }
    const lng = Number(coord[0]);
    const lat = Number(coord[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      errors.push(`${path}: koordinat bukan angka`);
      return false;
    }
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      errors.push(`${path}: koordinat di luar batas bumi`);
      return false;
    }
    return true;
  },

  _validateGeometry(geometry, path, errors) {
    if (!geometry || typeof geometry !== 'object') {
      errors.push(`${path}: geometri kosong`);
      return;
    }
    const coords = geometry.coordinates;
    const checkList = (items, label) => {
      if (!Array.isArray(items) || items.length === 0) {
        errors.push(`${path}: ${label} tidak memiliki koordinat`);
        return;
      }
      items.forEach((coord, index) => this._validateCoordinate(coord, `${path}[${index}]`, errors));
    };
    const checkLine = (line, label) => {
      if (!Array.isArray(line) || line.length < 2) {
        errors.push(`${path}: ${label} minimal memiliki 2 titik`);
        return;
      }
      line.forEach((coord, index) => this._validateCoordinate(coord, `${path}[${index}]`, errors));
    };
    const checkPolygon = (polygon, label) => {
      if (!Array.isArray(polygon) || polygon.length === 0) {
        errors.push(`${path}: ${label} tidak memiliki ring`);
        return;
      }
      polygon.forEach((ring, ringIndex) => {
        if (!Array.isArray(ring) || ring.length < 4) {
          errors.push(`${path}: ring ${ringIndex + 1} minimal memiliki 4 titik`);
          return;
        }
        ring.forEach((coord, pointIndex) => this._validateCoordinate(coord, `${path}[${ringIndex}][${pointIndex}]`, errors));
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (!Array.isArray(first) || !Array.isArray(last) || first[0] !== last[0] || first[1] !== last[1]) {
          errors.push(`${path}: ring ${ringIndex + 1} belum tertutup`);
        }
      });
    };

    switch (geometry.type) {
      case 'Point': this._validateCoordinate(coords, path, errors); break;
      case 'MultiPoint': checkList(coords, 'MultiPoint'); break;
      case 'LineString': checkLine(coords, 'LineString'); break;
      case 'MultiLineString':
        if (!Array.isArray(coords)) errors.push(`${path}: MultiLineString tidak memiliki koordinat`);
        else coords.forEach((line, index) => checkLine(line, `garis ${index + 1}`));
        break;
      case 'Polygon': checkPolygon(coords, 'Polygon'); break;
      case 'MultiPolygon':
        if (!Array.isArray(coords)) errors.push(`${path}: MultiPolygon tidak memiliki koordinat`);
        else coords.forEach((polygon, index) => checkPolygon(polygon, `polygon ${index + 1}`));
        break;
      case 'GeometryCollection':
        if (!Array.isArray(geometry.geometries) || geometry.geometries.length === 0) {
          errors.push(`${path}: GeometryCollection kosong`);
        } else {
          geometry.geometries.forEach((item, index) => this._validateGeometry(item, `${path}.geometries[${index}]`, errors));
        }
        break;
      default:
        errors.push(`${path}: tipe geometri "${geometry.type || 'tidak diketahui'}" tidak didukung`);
    }
  },

  validateData() {
    const report = {
      layers: State.layers.length,
      totalFeatures: 0,
      validFeatures: 0,
      invalidFeatures: 0,
      missingNames: 0,
      emptyLayers: 0,
      errors: [],
      warnings: []
    };
    State.layers.forEach(layer => {
      const gj = this._collectGeoJSON([layer.id]);
      const features = gj?.features || [];
      if (!features.length) {
        report.emptyLayers++;
        report.warnings.push(`Layer "${layer.name || 'tanpa nama'}" tidak memiliki fitur`);
        return;
      }
      features.forEach((feature, index) => {
        report.totalFeatures++;
        const errors = [];
        if (!feature || feature.type !== 'Feature') errors.push('format fitur bukan Feature');
        if (!feature?.geometry) errors.push('geometri kosong');
        else this._validateGeometry(feature.geometry, `${layer.name || 'Layer'} / fitur ${index + 1}`, errors);
        const props = feature?.properties;
        if (!props || typeof props !== 'object' || Array.isArray(props)) {
          report.warnings.push(`${layer.name || 'Layer'} / fitur ${index + 1}: atribut kosong`);
        }
        const name = props?.name ?? props?.Name;
        if (!String(name || '').trim()) {
          report.missingNames++;
          report.warnings.push(`${layer.name || 'Layer'} / fitur ${index + 1}: nama bidang kosong`);
        }
        if (errors.length) {
          report.invalidFeatures++;
          report.errors.push(...errors);
        } else {
          report.validFeatures++;
        }
      });
    });
    return report;
  },

  validateFromModal() {
    return this.validateData();
  },

  // Simpan semua fitur ke file Excel (dari tabel atribut)
  exportAllXLSX() {
    const collection = this._collectGeoJSON(State.layers.map(l => l.id));
    if (!collection || !collection.features.length) {
      Toast.show('Belum ada data untuk disimpan', 'warn');
      return;
    }
    const blob = this._excelBlob(collection.features);
    if (!blob) {
      Toast.show('Library Excel belum dimuat', 'warn');
      return;
    }
    const name = 'atribut_' + new Date().toISOString().slice(0, 10);
    this._download(blob, name + '.xlsx');
    AppConsole.log(`Saved Excel: ${name}.xlsx`, 'success');
    Toast.show(`Disimpan: ${name}.xlsx`, 'success');
  },

  async exportBatch({ all, perLayer, perFeature, formats }) {
    if (State.layers.length === 0) {
      Toast.show('Belum ada bidang untuk diekspor', 'warn');
      return;
    }
    if (!all && !perLayer && !perFeature) {
      Toast.show('Pilih Semua, Per layer, atau Per fitur', 'warn');
      return;
    }
    if (!formats.length) {
      Toast.show('Pilih minimal satu format file', 'warn');
      return;
    }
    if (formats.includes('xlsx') && typeof XLSX === 'undefined') {
      Toast.show('Library Excel belum dimuat', 'error');
      return;
    }

    const report = this.validateData();
    if (report.errors.length) {
      Toast.show(`Export dibatalkan: ${report.invalidFeatures} fitur memiliki geometri bermasalah`, 'error');
      return;
    }

    Modal.close();
    Toast.show('Menyiapkan ZIP export…', 'info');
    const zip = new JSZip();
    const totalFeatureCount = State.layers.reduce((n, l) => n + (l.featureCount || 0), 0);
    const totalFiles = (all ? formats.length : 0) + (perLayer ? formats.length * totalFeatureCount : 0) + (perFeature ? formats.length * totalFeatureCount : 0);
    let completed = 0;

    const addCollection = async (collection, format, filename, folder) => {
      const extension = format === 'geojson' ? 'geojson' : format === 'kml-poly' ? 'kml' : format;
      const blob = format === 'kmz'
        ? await this._buildKMZBlob(collection)
        : this._buildExportBlob(collection, format);
      if (!blob) return;
      const baseName = this._safeExportName(filename);
      let zipName = `${folder}/${baseName}.${extension}`;
      let suffix = 2;
      while (zip.file(zipName)) {
        zipName = `${folder}/${baseName}_${suffix}.${extension}`;
        suffix++;
      }
      zip.file(zipName, blob);
      completed++;
      AppConsole.log(`Export ${completed}/${totalFiles}: ${filename}.${extension}`, 'success');
    };

    if (all) {
      const combined = this._collectGeoJSON(State.layers.map(layer => layer.id));
      if (combined) {
        for (const format of formats) {
          await addCollection(combined, format, format === 'kml-poly' ? 'semua_poligon' : 'semua_bidang', 'semua_bidang');
        }
      }
    }

    if (perLayer) {
      for (const layer of State.layers) {
        if (!layer.geoJSON?.features?.length) continue;
        const layerName = this._safeExportName(layer.name, 'bidang');
        for (let fi = 0; fi < layer.geoJSON.features.length; fi++) {
          const feature = layer.geoJSON.features[fi];
          this._syncDrawnGeometry(layer.id, { type: 'FeatureCollection', features: [feature] });
          const featureName = feature.properties?.name || feature.properties?.Name || feature.properties?.nib || `bidang_${fi + 1}`;
          const singleFC = { type: 'FeatureCollection', features: [feature] };
          const safeName = this._safeExportName(layerName + '_' + featureName, 'bidang');
          for (const format of formats) {
            await addCollection(singleFC, format, safeName, 'per_bidang');
          }
        }
      }
    }

    if (perFeature) {
      for (const layer of State.layers) {
        if (!layer.geoJSON?.features) continue;
        const layerName = this._safeExportName(layer.name, 'bidang');
        for (let fi = 0; fi < layer.geoJSON.features.length; fi++) {
          const feature = layer.geoJSON.features[fi];
          this._syncDrawnGeometry(layer.id, { type: 'FeatureCollection', features: [feature] });
          const featureName = feature.properties?.name || feature.properties?.Name || feature.properties?.nib || `bidang_${fi + 1}`;
          const singleFC = { type: 'FeatureCollection', features: [feature] };
          const safeName = this._safeExportName(layerName + '_' + featureName, 'bidang');
          for (const format of formats) {
            await addCollection(singleFC, format, safeName, 'per_fitur');
          }
        }
      }
    }

    zip.file('validasi.json', JSON.stringify(report, null, 2));
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const projectName = this._safeExportName(document.getElementById('project-name-display')?.textContent, 'auroramaps');
    this._download(zipBlob, `${projectName}_export.zip`);
    Toast.show(`${completed} file dikemas dalam ZIP`, 'success');
  },

  runBatchFromModal() {
    const report = this.validateFromModal();
    if (report.errors.length) {
      Toast.show('Perbaiki geometri bermasalah sebelum export', 'error');
      return;
    }
    const formats = ['geojson', 'kml', 'kmz', 'xlsx', 'kml-poly']
      .filter(format => document.getElementById(`exp-format-${format}`)?.checked);
    const scope = document.getElementById('exp-scope')?.value || 'all';
    this.exportBatch({
      all: scope === 'all',
      perLayer: scope === 'layer',
      perFeature: scope === 'feature',
      formats
    });
  },

  async exportKMZ(layerId, filename) {
    const gj = LayerManager.getLayerAsGeoJSON(layerId);
    if (!gj) { Toast.show('No data to export', 'warn'); return; }
    this._syncDrawnGeometry(layerId, gj);
    const name = filename || (State.layers.find(l => l.id === layerId)?.name || 'export').replace(/[^a-zA-Z0-9\-_]/g, '_');
    try {
      const kml = this._geojsonToKML(this._cleanExportCollection(gj));
      const zip = new JSZip();
      zip.file('doc.kml', kml);
      const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      this._download(content, name + '.kmz');
      AppConsole.log(`Exported KMZ: ${name}.kmz`, 'success');
      Toast.show(`Disimpan: ${name}.kmz`, 'success');
    } catch(e) {
      Toast.show('Error exporting KMZ: ' + e.message, 'error');
      AppConsole.log('KMZ export error: ' + e.message, 'error');
    }
  },

  _syncDrawnGeometry(layerId, gj) {
    const entry = State.layers.find(l => l.id === layerId);
    if (!entry || !entry.isDrawn) return;
    try {
      const current = entry.leafletLayer.toGeoJSON ? entry.leafletLayer.toGeoJSON() : null;
      if (current && gj.features?.length > 0) {
        if (current.type === 'Feature') {
          gj.features[0].geometry = current.geometry;
        } else if (current.type === 'FeatureCollection' && current.features?.length > 0) {
          gj.features[0].geometry = current.features[0].geometry;
        }
      }
    } catch(e) {}
  },

  mergeLayersIntoApp(targetId, sourceIds) {
    const target = State.layers.find(l => l.id === targetId);
    if (!target) return;
    let added = 0;
    sourceIds.forEach(sid => {
      if (sid === targetId) return;
      const src = State.layers.find(l => l.id === sid);
      if (!src) return;
      const gj = LayerManager.getLayerAsGeoJSON(sid);
      if (gj?.features) {
        target.geoJSON.features.push(...gj.features);
        target.featureCount = target.geoJSON.features.length;
        gj.features.forEach(f => {
          const sub = L.geoJSON(f, {
            style: () => ({ color: target.color, fillColor: target.color, fillOpacity: 0.35, weight: 2 }),
            pointToLayer: (feat, latlng) => L.circleMarker(latlng, { radius: 6, color: target.color, fillColor: target.color, fillOpacity: 0.8, weight: 2 })
          });
          sub.eachLayer(sl => {
            sl.on('click', (e) => { L.DomEvent.stopPropagation(e); FeatureSelect.select(f, sl, targetId); });
            target.leafletLayer.addLayer ? target.leafletLayer.addLayer(sl) : null;
          });
        });
        LayerManager.removeLayer(sid);
        added++;
      }
    });
    UI.renderLayerList();
    UI.updateStats();
    AttrTable.load();
    Toast.show(`${added} layer digabung ke "${target.name}"`, 'success');
    AppConsole.log(`Merged ${added} layer into "${target.name}" (${target.featureCount} fitur total)`, 'success');
    History.push({ type: 'merge_layers', targetId });
  },

  _geojsonToKML(gj) {
    // Nama field KML disinkronkan dengan Google My Maps agar tidak bertabrakan saat upload
    const KML_FIELD_MAP = { deskripsi: 'Deskripsi', nib: 'NIB', keterangan: 'Keterangan' };
    const placemarks = gj.features.map(f => {
      const props = f.properties || {};
      const name = props.nama || props.name || props.Name || 'Feature';
      const desc = props.deskripsi || props.description || props.desc || '';
      const coords = this._coordsToKML(f.geometry);

      const excluded = new Set(['name', 'Name', 'deskripsi', 'description', 'desc', '_drawType', 'Description', 'Deskripsi', 'DESKRIPSI', 'NIB', 'Keterangan']);
      const rows = Object.entries(props)
        .filter(([k]) => !excluded.has(k))
        .map(([k, v]) => {
          const outName = KML_FIELD_MAP[k] || k;
          return `      <Data name="${Utils.escapeHtml(outName)}"><value>${Utils.escapeHtml(String(v ?? ''))}</value></Data>`;
        });
      // Deskripsi → kolom "Deskripsi" di My Maps (bukan elemen <description>)
      if (desc) {
        rows.push(`      <Data name="Deskripsi"><value>${Utils.escapeHtml(desc)}</value></Data>`);
      }
      const extDataBlock = rows.length ? `    <ExtendedData>\n${rows.join('\n')}\n    </ExtendedData>\n` : '';

      return `  <Placemark>\n    <name>${Utils.escapeHtml(name)}</name>\n${extDataBlock}${coords}\n  </Placemark>`;
    }).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n${placemarks}\n</Document>\n</kml>`;
  },

  _coordsToKML(geom) {
    if (!geom) return '';
    const fmt = (c) => c[0] + ',' + c[1] + ',0';
    switch (geom.type) {
      case 'Point': return `    <Point><coordinates>${fmt(geom.coordinates)}</coordinates></Point>`;
      case 'LineString': return `    <LineString><coordinates>${geom.coordinates.map(fmt).join(' ')}</coordinates></LineString>`;
      case 'Polygon': return `    <Polygon><outerBoundaryIs><LinearRing><coordinates>${geom.coordinates[0].map(fmt).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
      default: return '';
    }
  },

  // ── CETAK / SIMPAN GAMBAR (pengganti Screen Capture lama) ───────────────────
  // Cara lama memakai getDisplayMedia: tidak tersedia sama sekali di WebView
  // Android, harus memilih tab layar, dan hasilnya hanya sebesar layar sehingga
  // tidak bisa untuk plang 4×6 m. Kini peta dirender ulang lewat html2canvas
  // pada skala sesuai ukuran cetak × DPI, ditambah ekspor vektor SVG yang tajam
  // di ukuran cetak berapa pun.
  // Pilihan terakhir dipersist ke localStorage agar panel cetak
  // langsung membuka ukuran/DPI/format yang biasa dipakai.
  _printState: Object.assign({ widthM: 4, dpi: 50, format: 'png', title: true }, Storage.load('print-prefs', {})),

  _savePrintPrefs() {
    const S = this._printState;
    Storage.save('print-prefs', { widthM: S.widthM, dpi: S.dpi, format: S.format, title: S.title });
  },

  _printLimits() {
    const small = Math.min(window.innerWidth, window.innerHeight) < 768;
    return small
      ? { maxPixels: 12e6, maxSide: 6000, device: 'HP' }
      : { maxPixels: 40e6, maxSide: 12000, device: 'Komputer' };
  },

  _printGeometry() {
    const el = document.getElementById('map-container');
    const cw = Math.max(1, el ? el.offsetWidth : 1000);
    const ch = Math.max(1, el ? el.offsetHeight : 700);
    const lim = this._printLimits();
    // Skala ideal = lebar cetak (m) × inci-per-meter ÷ DPI, dibaca dari lebar
    // layar dalam px CSS. Contoh: 4 m @50 DPI pada layar 1000 px → skala 7,87×.
    const ideal = (this._printState.widthM * 39.3700787 * this._printState.dpi) / cw;
    // Batas aman kanvas perangkat (memori + panjang sisi maksimal).
    const scale = Math.min(ideal,
                           lim.maxSide / Math.max(cw, ch),
                           Math.sqrt(lim.maxPixels / (cw * ch)));
    const effDpi = this._printState.dpi * (scale / ideal);
    return {
      cw, ch, lim, ideal, scale, effDpi,
      w: Math.round(cw * scale),
      h: Math.round(ch * scale),
      // Panjang cetak aktual (mengecil bila dibatasi memori perangkat).
      printW: this._printState.widthM * (scale / ideal),
      clamped: scale < ideal - 1e-6
    };
  },

  _fmtId(n) { return Number(n).toLocaleString('id-ID'); },

  showPrintPanel() {
    const S = this._printState;
    // Pilihan tunggal memakai dropdown; pilihan ganda memakai daftar centang.
    const sizes = [[0.297, 'A3 — 29,7 × 42 cm'], [0.42, 'A2 — 42 × 59,4 cm'],
                   [0.594, 'A1 — 59,4 × 84,1 cm'], [0.841, 'A0 — 84,1 × 118,9 cm'],
                   [2, 'Lebar 2 m'], [3, 'Lebar 3 m'], [4, 'Lebar 4 m'], [5, 'Lebar 5 m']];
    const dpis  = [[30, '30 DPI — spanduk, dilihat dari jauh'], [50, '50 DPI — poster'],
                   [75, '75 DPI'], [100, '100 DPI — detail dekat']];
    const fmts  = [['png', 'PNG — kualitas penuh'],
                   ['jpg', 'JPG — berkas lebih kecil'],
                   ['svg', 'SVG Vektor — tajam di ukuran berapa pun']];
    const opts = (items, cur) => items.map(([val, label]) =>
      `<option value="${val}"${String(cur) === String(val) ? ' selected' : ''}>${label}</option>`).join('');

    const html = `
      <div class="modal-stack">
        <div class="exp-field">
          <span class="exp-field-label">Ukuran cetak (lebar)</span>
          <select id="pp-size" class="exp-select">${opts(sizes, S.widthM)}</select>
        </div>
        <div class="exp-field">
          <span class="exp-field-label">Ketajaman (DPI)</span>
          <select id="pp-dpi" class="exp-select">${opts(dpis, S.dpi)}</select>
        </div>
        <div class="exp-field">
          <span class="exp-field-label">Format berkas</span>
          <select id="pp-format" class="exp-select">${opts(fmts, S.format)}</select>
        </div>
        <label class="exp-check">
          <input type="checkbox" id="pp-title" class="modal-check"${S.title ? ' checked' : ''}/>
          <span class="exp-check-text"><span>Sertakan pita judul</span>
            <span class="exp-check-help">Nama proyek, tanggal, koordinat pusat, dan skala bar</span></span>
        </label>
        <div id="pp-summary" class="exp-file-count" style="margin-top:8px"></div>
      </div>`;

    Modal.open('Cetak / Simpan Gambar', html, [
      { label: 'Batal', cls: 'btn-secondary', action: () => Modal.close() },
      { label: '🖨️ Simpan / Ekspor', cls: 'btn-primary', action: () => this.runPrintFromPanel() }
    ]);

    const bind = (id, key, num) => document.getElementById(id)?.addEventListener('change', e => {
      S[key] = num ? parseFloat(e.target.value) : e.target.value;
      this._savePrintPrefs();
      this._refreshPrintSummary();
    });
    bind('pp-size', 'widthM', true);
    bind('pp-dpi', 'dpi', true);
    bind('pp-format', 'format', false);
    document.getElementById('pp-title')?.addEventListener('change', e => { S.title = e.target.checked; this._savePrintPrefs(); });
    this._refreshPrintSummary();
  },

  // Tombol utama panel cetak: PNG/JPG dirender ulang pada resolusi cetak,
  // SVG diekspor sebagai vektor (tajam di ukuran berapa pun).
  runPrintFromPanel() {
    const format = this._printState.format;
    Modal.close();
    if (format === 'svg') this.exportVectorSVG();
    else this.exportPrintImage();
  },

  _refreshPrintSummary() {
    const el = document.getElementById('pp-summary');
    if (!el) return;
    const S = this._printState;
    // Ukuran & DPI tidak berlaku untuk vektor — redupkan agar tidak menyesatkan.
    for (const id of ['pp-size', 'pp-dpi']) {
      const sel = document.getElementById(id);
      if (sel) sel.disabled = S.format === 'svg';
    }
    if (S.format === 'svg') {
      el.innerHTML = '<strong>SVG vektor</strong> · tajam di ukuran cetak berapa pun '
        + '(termasuk 4 × 6 m) · tidak dibatasi memori perangkat · berkas kecil';
      return;
    }
    const g = this._printGeometry();
    const bpp = S.format === 'jpg' ? 0.35 : 1.8;   // perkiraan kasar
    const mb = (g.w * g.h * bpp) / 1048576;
    const ratio = g.ch / g.cw;
    el.innerHTML = `<strong>${this._fmtId(g.w)} × ${this._fmtId(g.h)} px</strong> · `
      + `cetak ${g.printW.toFixed(2)} × ${(g.printW * ratio).toFixed(2)} m · `
      + `±${Math.round(g.effDpi)} DPI · file ±${mb < 1 ? '<1' : mb.toFixed(0)} MB`
      + (g.clamped ? `<div class="mp-cand" style="margin-top:6px">⚠️ ${g.lim.device} membatasi hasil ke `
          + `${this._fmtId(g.w)} × ${this._fmtId(g.h)} px (±${Math.round(g.effDpi)} DPI), `
          + `jadi maksimal ±${g.printW.toFixed(2)} m. Untuk ukuran lebih besar, pilih SVG Vektor.</div>` : '');
  },

  async exportPrintImage() {
    if (typeof domtoimage !== 'object' || typeof domtoimage.toCanvas !== 'function') {
      Toast.show('Modul gambar cetak belum termuat.', 'error');
      return;
    }
    const el = document.getElementById('map-container');
    const mapEl = document.getElementById('map');
    if (!el) return;
    const g = this._printGeometry();
    Toast.show('Merender peta untuk cetak…', 'info');
    AppConsole.log(`Cetak: skala ${g.scale.toFixed(2)}× → ${g.w}×${g.h} px (±${Math.round(g.effDpi)} DPI)`, 'info');
    // Sembunyikan panel selama render agar dialog tidak ikut tercetak.
    const modalBox = document.getElementById('modal-container');
    if (modalBox) modalBox.style.visibility = 'hidden';
    try {
      // Leaflet mengubah posisi SVG vektor dengan CSS transform saat pan/zoom.
      // html2canvas menerapkan transform SVG itu dua kali dan menggeser poligon
      // dari tile peta/zona. dom-to-image-more menyalin posisi DOM yang sudah
      // dihitung browser sebelum meraster hasilnya.
      const target = mapEl || el;
      const canvas = await domtoimage.toCanvas(target, {
        width: target.offsetWidth || g.cw,
        height: target.offsetHeight || g.ch,
        scale: g.scale,
        bgcolor: getComputedStyle(target).backgroundColor || '#0b1020',
        httpTimeout: 20000,
        ignoreCSSRuleErrors: true
      });
      if (this._printState.title) this._drawPrintTitleBar(canvas, g.scale);
      const mime = this._printState.format === 'jpg' ? 'image/jpeg' : 'image/png';
      const ext  = this._printState.format === 'jpg' ? '.jpg' : '.png';
      const blob = await new Promise(res => canvas.toBlob(res, mime, 0.9));
      if (!blob) throw new Error('kanvas kosong (gambar mungkin gagal dimuat)');
      const ts = new Date().toISOString().replace(/[T:]/g, '-').slice(0, 19);
      this._download(blob, `auroramaps_cetak_${ts}${ext}`);
      AppConsole.log(`Gambar cetak tersimpan → ${canvas.width}×${canvas.height} (${(blob.size / 1048576).toFixed(1)} MB)`, 'success');
      Toast.show(`Tersimpan: ${canvas.width}×${canvas.height} px`, 'success');
      Modal.close();
    } catch (err) {
      Toast.show('Gagal membuat gambar: ' + err.message, 'error');
      AppConsole.log('Cetak gambar error: ' + err.message, 'error');
    } finally {
      if (modalBox) modalBox.style.visibility = '';
    }
  },

  // Pita judul di dasar hasil cetak: nama proyek, tanggal, koordinat, skala.
  _drawPrintTitleBar(canvas, scale) {
    const ctx = canvas.getContext && canvas.getContext('2d');
    const map = MapManager.map;
    if (!ctx || !map) return;
    const H = canvas.height, W = canvas.width;
    const barPx = 56 * scale;
    ctx.save();
    // html2canvas meninggalkan translate pada konteks (mis. e:-1, f:-88) —
    // tanpa reset ini pita judul tergeser keluar bidang kanvas.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(13,18,32,0.94)';
    ctx.fillRect(0, H - barPx, W, barPx);
    ctx.scale(scale, scale);
    const w = W / scale, y0 = H / scale - 56;
    const c = map.getCenter();
    let nama = 'AuroraMaps';
    for (const id of ['project-name-display', 'project-name', 'proj-name', 'active-project-name']) {
      const t = document.getElementById(id)?.textContent?.trim();
      if (t) { nama = t; break; }
    }
    const tgl = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = '#e5e7eb'; ctx.font = '600 15px system-ui,sans-serif';
    ctx.fillText(nama.slice(0, 48), 14, y0 + 19);
    ctx.fillStyle = '#9aa4b2'; ctx.font = '12px system-ui,sans-serif';
    ctx.fillText(`${tgl} · ${c.lat.toFixed(6)}, ${c.lng.toFixed(6)} · zoom ${map.getZoom()}`, 14, y0 + 39);
    const bar = this._printScaleBar(map, 150);
    if (bar && bar.px > 20 && bar.px < w - 40) {
      const x2 = w - 16, x1 = x2 - bar.px, yb = y0 + 34;
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x1, yb); ctx.lineTo(x2, yb);
      ctx.moveTo(x1, yb - 5); ctx.lineTo(x1, yb + 5);
      ctx.moveTo(x2, yb - 5); ctx.lineTo(x2, yb + 5);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillText(bar.label, (x1 + x2) / 2, yb - 12);
    }
    ctx.restore();
  },

  // Panjang skala "bulat" (1/2/5×10ⁿ) yang paling mendekati lebar px tertentu.
  _printScaleBar(map, targetPx) {
    const c = map.getCenter();
    const mpp = 156543.03392 * Math.cos(c.lat * Math.PI / 180) / Math.pow(2, map.getZoom());
    const targetM = targetPx * mpp;
    const pow = Math.pow(10, Math.floor(Math.log10(Math.max(targetM, 1e-6))));
    const k = [1, 2, 5, 10].find(v => v * pow >= targetM * 0.7) || 10;
    const m = k * pow;
    return { px: m / mpp, label: m >= 1000 ? (m / 1000) + ' km' : Math.round(m) + ' m' };
  },

  // Ekspor vektor SVG: semua geometri layer terlihat + pita judul. Karena
  // vektor, hasilnya tajam di ukuran cetak berapa pun dan filenya kecil
  // sehingga aman dari batas memori perangkat.
  exportVectorSVG() {
    const map = MapManager.map;
    const el = document.getElementById('map-container');
    if (!map || !el) return;
    const cw = el.offsetWidth || 1000, ch = el.offsetHeight || 700;
    const margin = Math.max(cw, ch) * 1.5;   // buang geometri jauh di luar layar
    const toPts = ring => ring.filter(p => Array.isArray(p) && p.length >= 2).map(p => {
      const q = map.latLngToContainerPoint([p[1], p[0]]);
      return (q.x < -margin || q.x > cw + margin || q.y < -margin || q.y > ch + margin) ? null : q;
    });
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}" viewBox="0 0 ${cw} ${ch}" font-family="system-ui,Segoe UI,sans-serif">`,
      `<rect width="${cw}" height="${ch}" fill="#ffffff"/>`
    ];
    let n = 0;
    for (const entry of State.layers) {
      if (!entry.visible || !entry.geoJSON?.features) continue;
      const col = entry.color || '#3b82f6';
      for (const f of entry.geoJSON.features) {
        const g = f?.geometry; if (!g) continue;
        let rings = [];
        if (g.type === 'Point') rings = [[g.coordinates]];
        else if (g.type === 'MultiPoint') rings = g.coordinates.map(c => [c]);
        else if (g.type === 'LineString') rings = [g.coordinates];
        else if (g.type === 'MultiLineString') rings = g.coordinates;
        else if (g.type === 'Polygon') rings = g.coordinates;
        else if (g.type === 'MultiPolygon') rings = g.coordinates.flat();
        else continue;
        const area = /Polygon/.test(g.type) || /Point/.test(g.type);
        for (const ring of rings) {
          const ps = toPts(ring).filter(Boolean);
          if (ps.length < (area ? 3 : 2)) continue;
          if (/Point/.test(g.type)) {
            svg.push(`<circle cx="${ps[0].x.toFixed(1)}" cy="${ps[0].y.toFixed(1)}" r="6" fill="${col}" fill-opacity="0.8" stroke="${col}" stroke-width="2"/>`);
          } else {
            const d = ps.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + (area ? ' Z' : '');
            svg.push(`<path d="${d}" fill="${area ? col : 'none'}" fill-opacity="${area ? 0.35 : 0}" stroke="${col}" stroke-opacity="1" stroke-width="2" stroke-linejoin="round"/>`);
          }
          n++;
        }
      }
    }
    if (this._printState.title) this._svgTitleBlock(svg, cw, ch);
    svg.push('</svg>');
    const ts = new Date().toISOString().replace(/[T:]/g, '-').slice(0, 19);
    this._download(new Blob([svg.join('\n')], { type: 'image/svg+xml;charset=utf-8' }), `auroramaps_vektor_${ts}.svg`);
    AppConsole.log(`Ekspor vektor SVG → ${n} bentuk geometri`, 'success');
    Toast.show(`SVG vektor tersimpan (${n} bentuk) — tajam di ukuran cetak berapa pun.`, 'success');
  },

  _svgTitleBlock(svg, cw, ch) {
    const map = MapManager.map; if (!map) return;
    const c = map.getCenter();
    let nama = 'AuroraMaps';
    for (const id of ['project-name-display', 'project-name', 'proj-name', 'active-project-name']) {
      const t = document.getElementById(id)?.textContent?.trim();
      if (t) { nama = t; break; }
    }
    const esc = s => String(s).replace(/[<>&"]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[m]));
    const tgl = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    svg.push(`<rect x="0" y="${ch - 56}" width="${cw}" height="56" fill="#0d1220" fill-opacity="0.94"/>`);
    svg.push(`<text x="14" y="${ch - 37}" fill="#e5e7eb" font-size="15" font-weight="600">${esc(nama.slice(0, 48))}</text>`);
    svg.push(`<text x="14" y="${ch - 17}" fill="#9aa4b2" font-size="12">${esc(`${tgl} · ${c.lat.toFixed(6)}, ${c.lng.toFixed(6)} · zoom ${map.getZoom()}`)}</text>`);
    const bar = this._printScaleBar(map, 150);
    if (bar && bar.px > 20 && bar.px < cw - 40) {
      const x2 = cw - 16, x1 = x2 - bar.px, yb = ch - 22;
      svg.push(`<path d="M${x1} ${yb} L${x2} ${yb} M${x1} ${yb - 5} L${x1} ${yb + 5} M${x2} ${yb - 5} L${x2} ${yb + 5}" stroke="#e5e7eb" stroke-width="1.6" fill="none"/>`);
      svg.push(`<text x="${(x1 + x2) / 2}" y="${yb - 8}" fill="#e5e7eb" font-size="12" text-anchor="middle">${bar.label}</text>`);
    }
  },

  _download(blob, filename) {
    // Android WebView tidak memproses <a download> seperti browser biasa.
    // Kirim Blob ke MediaStore native agar masuk ke folder Download APK.
    if (window.AndroidFileSaver?.saveFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const base64 = String(reader.result).split(',')[1] || '';
          const ok = window.AndroidFileSaver.saveFile(filename, blob.type || 'application/octet-stream', base64);
          if (!ok) Toast.show('Gagal menyimpan file ke folder Download', 'error');
        } catch (e) {
          Toast.show('Gagal menyimpan file: ' + e.message, 'error');
        }
      };
      reader.readAsDataURL(blob);
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
};
