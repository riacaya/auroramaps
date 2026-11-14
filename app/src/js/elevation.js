'use strict';

/**
 * Elevation (mdpl) lookup via OpenTopoData (gratis).
 * - Default: SRTM 30m, fallback dataset bila null/gagal.
 * - Cache & in-flight dedupe per koordinat (dibulatkan).
 */
window.Elevation = {
  _cache: new Map(),      // key -> meters|null
  _inflight: new Map(),   // key -> Promise
  _datasets: ['srtm30m', 'aster30m', 'etopo1'],
  _key(lat, lng) {
    return `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
  },
  _fmt(m) {
    if (m == null || !isFinite(m)) return null;
    const r = Math.round(m * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  },

  async _fetchDataset(dataset, lat, lng) {
    const url = `https://api.opentopodata.org/v1/${dataset}?locations=${lat.toFixed(6)},${lng.toFixed(6)}`;
    const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const to = ctl ? setTimeout(() => ctl.abort(), 10000) : null;
    try {
      const res = await fetch(url, { signal: ctl ? ctl.signal : undefined });
      if (!res.ok) throw new Error('http ' + res.status);
      const data = await res.json();
      const m = data && data.results && data.results[0] ? data.results[0].elevation : null;
      return (m == null || !isFinite(Number(m))) ? null : Number(m);
    } finally {
      if (to) clearTimeout(to);
    }
  },

  async get(lat, lng) {
    lat = Number(lat); lng = Number(lng);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    const k = this._key(lat, lng);
    if (this._cache.has(k)) return this._cache.get(k);
    if (this._inflight.has(k)) return this._inflight.get(k);
    const p = (async () => {
      let val = null;
      for (let i = 0; i < this._datasets.length; i++) {
        try {
          val = await this._fetchDataset(this._datasets[i], lat, lng);
          if (val != null) break;
        } catch (e) {
          // coba dataset/fallback berikutnya
        }
      }
      // cache hasil final (termasuk null) agar tidak memukul API berulang; popup bisa coba lagi saat buka baru
      this._cache.set(k, val);
      this._inflight.delete(k);
      return val;
    })();
    this._inflight.set(k, p);
    return p;
  },

  async label(lat, lng) {
    const m = await this.get(lat, lng);
    const f = this._fmt(m);
    return f == null ? null : (f + ' m dpl');
  },

  /** Isi properties.mdpl (+elevation) untuk feature Point jika belum ada. */
  async annotatePointFeature(feature, lat, lng) {
    try {
      if (!feature || !feature.properties) return null;
      const g = feature.geometry;
      if (g && g.type && g.type !== 'Point') return null;
      if (lat == null || lng == null) {
        const c = g && g.coordinates;
        if (!c || c.length < 2) return null;
        lng = c[0]; lat = c[1];
      }
      if (feature.properties.mdpl != null && feature.properties.mdpl !== '') return feature.properties.mdpl;
      const m = await this.get(lat, lng);
      if (m == null) return null;
      const f = this._fmt(m);
      feature.properties.mdpl = f;
      feature.properties.elevation = m; // kompatibilitas (angka meter)
      if (g && g.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
        g.coordinates[2] = m;
      }
      return f;
    } catch (e) { return null; }
  },

  /** Tambah baris mdpl di bawah .mp-coord pada elemen popup (async). */
  fillPopupCoord(container, lat, lng) {
    if (!container || lat == null || lng == null) return;
    const nodes = container.querySelectorAll ? container.querySelectorAll('.mp-coord') : [container];
    nodes.forEach(node => {
      if (!node) return;
      let line = node.nextElementSibling;
      if (!line || !line.classList || !line.classList.contains('mp-coord-mdpl')) {
        line = document.createElement('div');
        line.className = 'mp-coord-mdpl';
        node.insertAdjacentElement('afterend', line);
      }
      line.textContent = 'mdpl: memuat…';
      // hapus cache null agar klik/popup baru bisa coba ulang
      try {
        const k = this._key(lat, lng);
        if (this._cache.has(k) && this._cache.get(k) == null) this._cache.delete(k);
      } catch (_) {}
      this.label(lat, lng).then(txt => {
        line.textContent = txt ? ('mdpl: ' + txt) : 'mdpl: tidak tersedia';
      }).catch(() => {
        line.textContent = 'mdpl: tidak tersedia';
      });
    });
  }
};
