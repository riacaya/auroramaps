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
    return { ...collection, features: collection.features.map((feature, index) => ({
      ...feature, properties: featureExportRow(feature, index)
    })) };
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
    this.exportBatch({
      all: document.getElementById('exp-scope-all')?.checked === true,
      perLayer: document.getElementById('exp-scope-layer')?.checked === true,
      perFeature: document.getElementById('exp-scope-feature')?.checked === true,
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

  async exportMapImage(format, options = {}) {
    const filename = options.filename || ('peta_' + new Date().toISOString().slice(0,10));
    const quality  = options.quality ?? 0.92;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      Toast.show('Browser tidak mendukung Screen Capture API. Gunakan Win+Shift+S (Windows) atau tombol Power+Volume Down (Android).', 'warn');
      AppConsole.log('Screen Capture API tidak tersedia di browser ini', 'warn');
      return;
    }

    Toast.show('Pilih tab / layar lalu klik Bagikan → screenshot otomatis tersimpan.', 'info');
    AppConsole.log('Menunggu izin Screen Capture…', 'info');

    try {
      const constraints = {
        video: {
          frameRate:   { ideal: 5, max: 15 },
          width:       { ideal: window.screen.width  * (window.devicePixelRatio || 1) },
          height:      { ideal: window.screen.height * (window.devicePixelRatio || 1) },
          displaySurface: 'browser'
        },
        audio: false,
        preferCurrentTab:    true,
        selfBrowserSurface:  'include',
        surfaceSwitching:    'exclude',
        monitorTypeSurfaces: 'exclude'
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      const video = document.createElement('video');
      video.srcObject  = stream;
      video.muted      = true;
      video.playsInline = true;

      await new Promise(resolve => {
        video.onloadedmetadata = () => resolve();
      });
      await video.play();

      await new Promise(r => setTimeout(r, 300));

      const W = video.videoWidth;
      const H = video.videoHeight;

      const canvas = document.createElement('canvas');
      canvas.width  = W;
      canvas.height = H;
      canvas.getContext('2d').drawImage(video, 0, 0, W, H);

      stream.getTracks().forEach(t => t.stop());
      video.srcObject = null;

      const ext = format === 'png' ? '.png' : '.jpg';
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';

      await new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Canvas kosong')); return; }
          this._download(blob, filename + ext);
          Toast.show(`Disimpan: ${filename}${ext}  (${W}×${H}px)`, 'success');
          AppConsole.log(`Screenshot layar berhasil → ${filename}${ext} ${W}×${H}`, 'success');
          resolve();
        }, mime, quality);
      });

    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        Toast.show('Screenshot dibatalkan.', 'warn');
        AppConsole.log('Screenshot dibatalkan oleh pengguna', 'warn');
      } else {
        Toast.show('Gagal screenshot: ' + err.message, 'error');
        AppConsole.log('Screenshot error: ' + err.message, 'error');
      }
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
