// =====================================================
// AuroraMaps · utils.js — Pure helpers & core helpers
// =====================================================
'use strict';

// =====================================================
// UTILS
// =====================================================
const Utils = {
  id: () => Math.random().toString(36).slice(2,9),
  now: () => new Date().toLocaleTimeString(),
  nextColor() {
    const c = Config.colors[State.colorIndex % Config.colors.length];
    State.colorIndex++;
    return c;
  },
  formatArea(m2) {
    if (m2 > 1e6) return (m2/1e6).toFixed(3) + ' km²';
    if (m2 > 1e4) return (m2/1e4).toFixed(3) + ' ha';
    return m2.toFixed(2) + ' m²';
  },
  formatDist(m) {
    if (m > 1000) return (m/1000).toFixed(3) + ' km';
    return m.toFixed(2) + ' m';
  },
  formatEdgeMeters(m) {
    if (!Number.isFinite(m)) return '—';
    return `${m >= 100 ? m.toFixed(1) : m.toFixed(2)} m`;
  },
  deg2rad(d) { return d * Math.PI / 180; },
  haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000, dLat = Utils.deg2rad(lat2-lat1), dLon = Utils.deg2rad(lon2-lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(Utils.deg2rad(lat1))*Math.cos(Utils.deg2rad(lat2))*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },
  polylineLength(latlngs) {
    let d = 0;
    for (let i=1;i<latlngs.length;i++) {
      d += Utils.haversine(latlngs[i-1].lat, latlngs[i-1].lng, latlngs[i].lat, latlngs[i].lng);
    }
    return d;
  },
  polygonArea(latlngs) {
    let area = 0, n = latlngs.length;
    for (let i=0;i<n;i++) {
      const j = (i+1)%n;
      area += Utils.deg2rad(latlngs[j].lng - latlngs[i].lng) *
              (2 + Math.sin(Utils.deg2rad(latlngs[i].lat)) + Math.sin(Utils.deg2rad(latlngs[j].lat)));
    }
    return Math.abs(area * 6371000 * 6371000 / 2);
  },
  calcLayerMeasurements(layer, type) {
    const props = {};
    try {
      if (type === 'polyline') {
        const lls = layer.getLatLngs().flat(Infinity);
        props['panjang'] = Utils.formatDist(Utils.polylineLength(lls));
      } else if (type === 'polygon' || type === 'rectangle') {
        const raw = layer.getLatLngs();
        const ring = Array.isArray(raw[0]) ? raw[0].flat(Infinity) : raw.flat(Infinity);
        const closed = [...ring, ring[0]];
        props['keliling'] = Utils.formatDist(Utils.polylineLength(closed));
        props['luas_poligon'] = Utils.formatArea(Utils.polygonArea(ring));
      } else if (type === 'circle') {
        const r = layer.getRadius();
        props['radius'] = Utils.formatDist(r);
        props['luas_poligon'] = Utils.formatArea(Math.PI * r * r);
      }
    } catch (err) {}
    return props;
  },

  calcFeatureMeasurements(feature) {
    const geom = feature?.geometry;
    if (!geom) return {};
    const p = {};
    try {
      if (geom.type === 'LineString') {
        const pts = geom.coordinates.map(c => L.latLng(c[1], c[0]));
        p.panjang = Utils.formatDist(Utils.polylineLength(pts));
      } else if (geom.type === 'MultiLineString') {
        let total = 0;
        geom.coordinates.forEach(line => {
          const pts = line.map(c => L.latLng(c[1], c[0]));
          total += Utils.polylineLength(pts);
        });
        p.panjang = Utils.formatDist(total);
      } else if (geom.type === 'Polygon') {
        const ring = geom.coordinates[0].map(c => L.latLng(c[1], c[0]));
        const closed = [...ring, ring[0]];
        p.keliling = Utils.formatDist(Utils.polylineLength(closed));
        p.luas_poligon = Utils.formatArea(Utils.polygonArea(ring));
      } else if (geom.type === 'MultiPolygon') {
        let totalArea = 0, totalPerim = 0;
        geom.coordinates.forEach(poly => {
          const ring = poly[0].map(c => L.latLng(c[1], c[0]));
          const closed = [...ring, ring[0]];
          totalArea += Utils.polygonArea(ring);
          totalPerim += Utils.polylineLength(closed);
        });
        p.keliling = Utils.formatDist(totalPerim);
        p.luas_poligon = Utils.formatArea(totalArea);
      }
    } catch(e) {}
    return p;
  },
  featureCoordinatesText(feature) {
    const geom = feature?.geometry;
    if (!geom || !geom.coordinates) return '—';
    const fmt = (n) => Number(n).toFixed(6);
    try {
      if (geom.type === 'Point') {
        const [lng, lat] = geom.coordinates;
        return `${fmt(lat)}, ${fmt(lng)}`;
      }
      const collect = (coords) => {
        if (!Array.isArray(coords) || coords.length === 0) return [];
        if (typeof coords[0] === 'number') return [`${fmt(coords[1])}, ${fmt(coords[0])}`];
        return coords.flatMap(collect);
      };
      return collect(geom.coordinates).join(' | ') || '—';
    } catch (e) {
      return '—';
    }
  },
  geomTypeIcon(type) {
    if (!type) return '◇';
    const t = type.toLowerCase();
    if (t.includes('point'))   return '📍';
    if (t.includes('line'))    return '〰';
    if (t.includes('polygon')) return '⬡';
    return '◇';
  },
  escapeHtml(s) {
    if (typeof s !== 'string') s = String(s);
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
  formatJSON(obj) {
    const str = JSON.stringify(obj, null, 2);
    return str.replace(/("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+\.?\d*(?:[Ee][+-]?\d+)?)/g, match => {
      let cls = 'json-number';
      if (/^"/.test(match)) cls = /:$/.test(match) ? 'json-key' : 'json-string';
      else if (/true|false/.test(match)) cls = 'json-bool';
      else if (/null/.test(match)) cls = 'json-null';
      return `<span class="${cls}">${Utils.escapeHtml(match)}</span>`;
    });
  },
  coordStr(lat, lng) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  },
  safeName(value, fallback) {
    return String(value || fallback).trim().replace(/[^a-zA-Z0-9\-_]/g, '_') || fallback;
  }
};
// =====================================================
// CORE HELPERS
// =====================================================
const FEATURE_AUTO_KEYS = ['_drawType', 'keliling', 'luas_poligon', 'luas', 'luas', 'panjang', 'jari_jari', 'name', 'Name', 'deskripsi', 'description', 'Description', 'Deskripsi', 'DESKRIPSI', 'shm', 'SHM', 'nib', 'NIB', 'keterangan', 'Keterangan'];

function preserveAutoFeatureProps(source = {}) {
  const preserved = {};
  FEATURE_AUTO_KEYS.forEach(k => {
    if (source[k] !== undefined) preserved[k] = source[k];
  });
  return preserved;
}

function nextAutoFeatureName() {
  let nextNumber = 1;
  State.layers.forEach(layer => {
    const features = layer.geoJSON?.features || [];
    features.forEach(feature => {
      const value = feature?.properties?.name || feature?.properties?.Name || '';
      const match = String(value).trim().match(/^AM(\d+)$/i);
      if (match) nextNumber = Math.max(nextNumber, Number(match[1]) + 1);
    });
  });
  return `AM${String(nextNumber).padStart(4, '0')}`;
}

function normalizeFeatureAreaProps(feature) {
  const props = feature?.properties;
  if (!props) return props;
  if ((props.luas_poligon === undefined || props.luas_poligon === '') && props.luas !== undefined) {
    props.luas_poligon = props.luas;
  }
  if (props.luas === undefined) props.luas = props.luasSHM ?? props.luas_sertifikat ?? '';
  // Sinkronisasi nama field dengan Google My Maps (Deskripsi/NIB/Keterangan → kanonik lowercase)
  if (props.deskripsi === undefined) props.deskripsi = props.Deskripsi ?? props.DESKRIPSI;
  if (props.nib === undefined) props.nib = props.NIB;
  if (props.keterangan === undefined) props.keterangan = props.Keterangan;
  delete props.luasSHM;
  delete props.luas_sertifikat;
  delete props.Deskripsi;
  delete props.DESKRIPSI;
  delete props.NIB;
  delete props.Keterangan;
  return props;
}

function featureExportRow(feature, index) {
  const p = normalizeFeatureAreaProps(feature) || {};
  const m = Utils.calcFeatureMeasurements(feature);
  return {
    no: index + 1,
    nama: p.name || p.nama || p.Name || '',
    deskripsi: p.deskripsi || p.description || p.Description || '',
    nib: p.nib || p.NIB || '',
    shm: p.shm || p.SHM || '',
    luas: p.luas || p.luas || '',
    luas_poligon: m.luas_poligon || p.luas_poligon || '',
    keliling: m.keliling || p.keliling || p.panjang || '',
    keterangan: p.keterangan || p.Keterangan || '',
    koordinat: Utils.featureCoordinatesText(feature),
    maps: p.url || ''
  };
}

function parseEditableValue(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v !== '' && !isNaN(Number(v))) return Number(v);
  return v;
}

function collectPropertyRows(rootSelector, scope = document) {
  const extraProps = {};
  let hasError = false;
  scope.querySelectorAll(rootSelector).forEach(row => {
    const keyEl = row.querySelector('.prop-edit-key');
    const valEl = row.querySelector('.prop-edit-val');
    const k = keyEl?.value.trim();
    const v = valEl?.value ?? '';
    if (!k) {
      if (keyEl) keyEl.style.borderColor = 'var(--danger)';
      hasError = true;
      return;
    }
    if (keyEl) keyEl.style.borderColor = '';
    extraProps[k] = parseEditableValue(v);
  });
  return { extraProps, hasError };
}

function refreshFeatureState(feature, layerId) {
  if (!feature) return;
  const layer = State.layers.find(l => l.id === layerId || l.id === State.selectedFeatureLayer);
  FeatureEditor._refreshPopup();
  const jsonViewer = document.getElementById('json-viewer');
  if (jsonViewer) jsonViewer.innerHTML = Utils.formatJSON(feature);
  if (layer) {
    AttrTable.load();
    // Nama layer (folder) TIDAK boleh ikut berubah saat satu fitur/bidang diedit.
    // Sinkronkan nama layer hanya untuk layer hasil gambar/draw (isDrawn) yang masih
    // berisi satu fitur, karena pada layer draw nama layer memang mengikuti nama fiturnya.
    // Layer hasil import (KMZ/KML/GeoJSON) TIDAK pernah ikut di-rename dari edit fitur.
    const featureCount = layer.geoJSON?.features?.length ?? layer.featureCount ?? 0;
    if (layer.isDrawn && featureCount <= 1) {
      const name = feature.properties?.name || feature.properties?.Name;
      if (name) layer.name = String(name);
    }
    UI.renderLayerList();
  }
  UI.showProperties(feature);
}

// Empty-state placeholder HTML (shared by layer list & feature panels)
function emptyStateHtml(icon, text, cls = '') {
  return `<div class="empty-state ${cls}"><div class="empty-state-icon">${icon}</div><div class="empty-state-text">${text}</div></div>`;
}
