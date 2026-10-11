// =====================================================
// AuroraMaps · search.js — Search engine + autocomplete + coordinate log
// =====================================================
'use strict';

// =====================================================
// SEARCH ENGINE
// =====================================================
const Search = {
  query: '',
  results: [],
  _pendingController: null,
  _suggestController: null,
  _dropdown: null,
  _input: null,
  _debounce: null,

  init() {
    this._input = document.getElementById('search-input');
    if (!this._input) return;
    this._dropdown = document.createElement('div');
    this._dropdown.className = 'search-dropdown';
    this._dropdown.style.display = 'none';
    this._input.parentElement.style.position = 'relative';
    this._input.parentElement.appendChild(this._dropdown);

    this._input.addEventListener('input', () => {
      clearTimeout(this._debounce);
      const q = this._input.value.trim();
      if (q.length < 2) { this._hideDropdown(); return; }
      this._debounce = setTimeout(() => this._suggest(q), 250);
    });
    this._input.addEventListener('focus', () => {
      if (this._dropdown.children.length > 0) this._dropdown.style.display = '';
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.header-search')) this._hideDropdown();
    });
    this._dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.search-dd-item');
      if (!item) return;
      const lat = +item.dataset.lat, lng = +item.dataset.lng, bb = item.dataset.bbox;
      this._goToResult(lat, lng, bb);
      this._hideDropdown();
    });
  },

  async _suggest(q) {
    if (this._suggestController) this._suggestController.abort();
    this._suggestController = new AbortController();
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=8&countrycodes=id&accept-language=id`,
        { signal: this._suggestController.signal, headers: { 'Accept-Language': 'id,en' } }
      );
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data.length) { this._hideDropdown(); return; }
      this._dropdown.innerHTML = data.map(d => {
        const parts = d.display_name.split(',');
        const name = parts[0].trim();
        const sub = parts.slice(1, 3).join(',').trim();
        const icon = this._typeIcon(d.type, d.class);
        return `<div class="search-dd-item" data-lat="${d.lat}" data-lng="${d.lon}" data-bbox="${d.boundingbox?.join(',') || ''}">
          <span class="search-dd-icon">${icon}</span>
          <span class="search-dd-text"><strong>${Utils.escapeHtml(name)}</strong><br/><small>${Utils.escapeHtml(sub)}</small></span>
        </div>`;
      }).join('');
      this._dropdown.style.display = '';
    } catch(e) {
      if (e.name !== 'AbortError') this._hideDropdown();
    }
  },

  _typeIcon(type, cls) {
    if (cls === 'place' && (type === 'city' || type === 'town')) return '🏙';
    if (cls === 'place' && (type === 'village' || type === 'hamlet')) return '🏘';
    if (cls === 'place' && type === 'suburb') return '📍';
    if (type === 'county') return '🗺';
    if (type === 'state') return '🌏';
    if (type === 'administrative') return '🏛';
    if (cls === 'boundary') return '📌';
    return '📍';
  },

  _goToResult(lat, lng, bboxStr) {
    if (bboxStr) {
      const bb = bboxStr.split(',').map(Number);
      // nominatim bbox: [south, north, west, east]
      const bounds = L.latLngBounds([bb[0], bb[2]], [bb[1], bb[3]]);
      MapManager.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    } else {
      MapManager.map.setView([lat, lng], 15);
    }
    const m = L.circleMarker([lat, lng], {
      radius: 8, color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.6, weight: 3
    });
    MapManager.measureItems.clearLayers();
    MapManager.measureItems.addLayer(m);
    setTimeout(() => MapManager.measureItems.clearLayers(), 4000);
    Toast.show(`Lokasi: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'success');
    AppConsole.log(`Navigasi ke: ${lat}, ${lng}`, 'info');
  },

  _hideDropdown() {
    if (this._dropdown) { this._dropdown.style.display = 'none'; this._dropdown.innerHTML = ''; }
  },

  async search(q) {
    this.query = q.trim();
    this.results = [];
    this._hideDropdown();
    if (!this.query) {
      document.getElementById('search-clear').style.display = 'none';
      return;
    }
    document.getElementById('search-clear').style.display = 'block';

    const coordMatch = this._parseCoords(this.query);
    if (coordMatch) {
      this._goToResult(coordMatch.lat, coordMatch.lng);
      return;
    }

    State.layers.forEach(layer => {
      if (!layer.geoJSON?.features) return;
      layer.geoJSON.features.forEach(f => {
        const props = JSON.stringify(f.properties).toLowerCase();
        if (props.includes(this.query.toLowerCase())) {
          this.results.push({ feature: f, layerId: layer.id, layerName: layer.name });
        }
      });
    });

    if (this.results.length > 0) {
      Toast.show(`${this.results.length} fitur ditemukan untuk "${q}"`, 'info');
      AppConsole.log(`Pencarian "${q}": ${this.results.length} hasil fitur`, 'info');
      const first = this.results[0];
      LayerManager.selectFeatureInLayer(first.layerId, first.feature.geometry ? State.layers.find(l => l.id === first.layerId).geoJSON.features.indexOf(first.feature) : 0);
      return;
    }

    Toast.show('Mencari lokasi di peta…', 'info');
    if (this._pendingController) this._pendingController.abort();
    this._pendingController = new AbortController();
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=id`,
        { signal: this._pendingController.signal, headers: { 'Accept-Language': 'id,en' } }
      );
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      if (data && data.length > 0) {
        this._goToResult(parseFloat(data[0].lat), parseFloat(data[0].lon), data[0].boundingbox?.join(','));
        Toast.show(`Ditemukan: ${data[0].display_name}`, 'success');
        AppConsole.log(`Geocoding "${q}": ${data[0].display_name}`, 'success');
      } else {
        Toast.show(`Tidak ditemukan: "${q}"`, 'warn');
        AppConsole.log(`Pencarian "${q}": tidak ada hasil`, 'warn');
      }
    } catch(e) {
      if (e.name !== 'AbortError') {
        Toast.show('Gagal mencari lokasi: ' + e.message, 'error');
        AppConsole.log('Geocoding error: ' + e.message, 'error');
      }
    }
  },

  _parseCoords(s) {
    const m = s.match(/(-?\d{1,3}(?:[.,]\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:[.,]\d+)?)/);
    if (!m) return null;
    const lat = parseFloat(m[1].replace(',', '.'));
    const lng = parseFloat(m[2].replace(',', '.'));
    if (isNaN(lat) || isNaN(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  }
};
// =====================================================
// COORDINATE LOG
// =====================================================
const CoordLog = {
  add(latlng) {
    State.coordLog.push({ lat: latlng.lat, lng: latlng.lng, time: Utils.now() });
    this.render();
  },

  render() {
    const el = document.getElementById('coord-list');
    if (State.coordLog.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📌</div><div class="empty-state-text">Click on the map to record coordinates.</div></div>';
      return;
    }
    el.innerHTML = State.coordLog.map((c, i) => `
      <div class="coord-item">
        <span class="coord-idx">${i+1}</span>
        <span class="coord-val">${Utils.coordStr(c.lat, c.lng)}</span>
        <span style="color:var(--text-muted);font-size:10px">${c.time}</span>
        <button class="coord-copy" data-coord-copy="${Utils.coordStr(c.lat, c.lng)}">⧉</button>
      </div>
    `).join('');
  },

  clear() {
    State.coordLog = [];
    this.render();
  }
};
