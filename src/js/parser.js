// =====================================================
// AuroraMaps · parser.js — GeoJSON/KML/KMZ/GPX parsers + file manager
// =====================================================
'use strict';

// =====================================================
// FILE MANAGER & PARSERS
// =====================================================
const Parser = {
  parseGeoJSON(text) {
    const gj = JSON.parse(text);
    if (gj.type === 'FeatureCollection') return gj;
    if (gj.type === 'Feature') return { type: 'FeatureCollection', features: [gj] };
    if (gj.type && gj.coordinates) return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: gj, properties: {} }] };
    if (gj.features) return gj;
    throw new Error('Not a valid GeoJSON');
  },

  parseKML(text) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const features = [];

    function getCoords(coordStr) {
      return coordStr.trim().split(/\s+/).map(c => {
        const [lng, lat, alt] = c.split(',').map(Number);
        return [lng, lat];
      });
    }

    function processPlacemark(pm) {
      const name = pm.querySelector('name')?.textContent || '';
      const desc = pm.querySelector('description')?.textContent || '';
      const props = { name, description: desc };

      pm.querySelectorAll('Data, SimpleData').forEach(d => {
        const k = d.getAttribute('name') || d.tagName;
        const v = d.querySelector('value')?.textContent || d.textContent;
        props[k] = v;
      });

      const point = pm.querySelector('Point coordinates');
      if (point) {
        const [lng, lat] = point.textContent.trim().split(',').map(Number);
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: props });
        return;
      }

      const line = pm.querySelector('LineString coordinates');
      if (line) {
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: getCoords(line.textContent) }, properties: props });
        return;
      }

      const outerBoundary = pm.querySelector('outerBoundaryIs LinearRing coordinates');
      if (outerBoundary) {
        const outer = getCoords(outerBoundary.textContent);
        const holes = [...pm.querySelectorAll('innerBoundaryIs LinearRing coordinates')].map(h => getCoords(h.textContent));
        features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [outer, ...holes] }, properties: props });
        return;
      }

      const multi = pm.querySelector('MultiGeometry');
      if (multi) {
        processPlacemark({ querySelector: (s) => multi.querySelector(s), querySelectorAll: (s) => multi.querySelectorAll(s) });
      }
    }

    doc.querySelectorAll('Placemark').forEach(processPlacemark);
    return { type: 'FeatureCollection', features };
  },

  parseGPX(text) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const features = [];

    doc.querySelectorAll('wpt').forEach(wpt => {
      const lat = parseFloat(wpt.getAttribute('lat'));
      const lon = parseFloat(wpt.getAttribute('lon'));
      const name = wpt.querySelector('name')?.textContent || 'Waypoint';
      const ele = wpt.querySelector('ele')?.textContent;
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { name, elevation: ele } });
    });

    doc.querySelectorAll('trk').forEach(trk => {
      const name = trk.querySelector('name')?.textContent || 'Track';
      const coords = [];
      trk.querySelectorAll('trkpt').forEach(pt => {
        coords.push([parseFloat(pt.getAttribute('lon')), parseFloat(pt.getAttribute('lat'))]);
      });
      if (coords.length > 0) {
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: { name } });
      }
    });

    doc.querySelectorAll('rte').forEach(rte => {
      const name = rte.querySelector('name')?.textContent || 'Route';
      const coords = [];
      rte.querySelectorAll('rtept').forEach(pt => {
        coords.push([parseFloat(pt.getAttribute('lon')), parseFloat(pt.getAttribute('lat'))]);
      });
      if (coords.length > 0) {
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: { name } });
      }
    });

    return { type: 'FeatureCollection', features };
  },

  async parseKMZ(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const kmlFiles = Object.keys(zip.files).filter(f => f.toLowerCase().endsWith('.kml'));
    if (kmlFiles.length === 0) throw new Error('No KML found in KMZ');
    const kmlText = await zip.files[kmlFiles[0]].async('text');
    return this.parseKML(kmlText);
  }
};

const FileManager = {
  async openFiles(files) {
    for (const file of files) {
      await this.processFile(file);
    }
  },

  async processFile(file) {
    const name = file.name;
    const ext = name.split('.').pop().toLowerCase();
    AppConsole.log(`Loading "${name}"...`, 'info');

    try {
      if (ext === 'auroramaps' || ext === 'senjamaps') {
        await ProjectManager.openFile(file);
        return;
      }
      let geoJSON;
      const meta = { source: 'file', filename: name, format: ext.toUpperCase(), size: file.size, created: new Date().toISOString() };

      if (ext === 'geojson' || ext === 'json') {
        const text = await file.text();
        geoJSON = Parser.parseGeoJSON(text);
      } else if (ext === 'kml') {
        const text = await file.text();
        geoJSON = Parser.parseKML(text);
      } else if (ext === 'kmz') {
        const buf = await file.arrayBuffer();
        geoJSON = await Parser.parseKMZ(buf);
      } else if (ext === 'gpx') {
        const text = await file.text();
        geoJSON = Parser.parseGPX(text);
      } else {
        throw new Error(`Unsupported format: .${ext}`);
      }

      if (!geoJSON || !geoJSON.features) throw new Error('No features found in file');

      const layerName = name.replace(/\.[^.]+$/, '');
      LayerManager.addLayer(layerName, geoJSON, null, meta);
      Toast.show(`Loaded "${name}" (${geoJSON.features.length} features)`, 'success');

      State.fileHistory.unshift({ name, time: new Date().toISOString(), count: geoJSON.features.length });
      State.fileHistory = State.fileHistory.slice(0, 20);
      UI.renderFileHistory();

      const lastLayer = State.layers[State.layers.length - 1];
      if (lastLayer) {
        setTimeout(() => LayerManager.zoomTo(lastLayer.id), 200);
      }
    } catch(e) {
      Toast.show(`Error loading "${name}": ${e.message}`, 'error');
      AppConsole.log(`Error loading "${name}": ${e.message}`, 'error');
    }
  },

  async loadFromURL(url) {
    try {
      AppConsole.log(`Fetching: ${url}`, 'info');
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const text = await resp.text();
      const geoJSON = Parser.parseGeoJSON(text);
      const name = url.split('/').pop().split('?')[0] || 'URL Layer';
      LayerManager.addLayer(name, geoJSON);
      Toast.show(`Loaded from URL (${geoJSON.features.length} features)`, 'success');
    } catch(e) {
      Toast.show(`Error loading URL: ${e.message}`, 'error');
      AppConsole.log(`Error loading URL: ${e.message}`, 'error');
    }
  }
};
