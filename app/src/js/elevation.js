'use strict';

/**
 * Elevation (mdpl) lookup via OpenTopoData (gratis).
 * - Default: SRTM 30m, endpoint publik (rate/kuota terbatas, cocok on-demand).
 * - Cache & in-flight dedupe per koordinat (dibulatkan).
 */
window.Elevation = {
  _cache: new Map(),      // key -> meters|null
  _inflight: new Map(),   // key -> Promise
  _key(lat, lng) {
    // ~1.1m presisi; cukup untuk cache & menghemat kuota
    return `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
  },
  _fmt(m) {
    if (m == null || !isFinite(m)) return null;
    // bulatkan wajar (SRTM ~meteran)
    const r = Math.round(m * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  },

  async get(lat, lng) {
    lat = Number(lat); lng = Number(lng);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    const k = this._key(lat, lng);
    if (this._cache.has(k)) return this._cache.get(k);
    if (this._inflight.has(k)) return this._inflight.get(k);
    const p = (async () => {
      const url = `https://api.opentopodata.org/v1/srtm30m?locations=${lat.toFixed(6)},${lng.toFixed(6)}`;
      const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const to = ctl ? setTimeout(() => ctl.abort(), 10000) : null;
      try {
        const res = await fetch(url, { signal: ctl ? ctl.signal : undefined });
        if (!res.ok) throw new Error('http ' + res.status);
        const data = await res.json();
        const m = data && data.results && data.results[0] ? data.results[0].elevation : null;
        const val = (m == null || !isFinite(Number(m))) ? null : Number(m);
        this._cache.set(k, val);
        return val;
      } catch (e) {
        // jangan cache error agar bisa dicoba lagi
        return null;
      } finally {
        if (to) clearTimeout(to);
        this._inflight.delete(k);
      }
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
      // simpan Z jika koordinat point tersedia
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
      if (!node || node._mdplFilled) return;
      node._mdplFilled = true;
      let line = node.nextElementSibling;
      if (!line || !line.classList || !line.classList.contains('mp-coord-mdpl')) {
        line = document.createElement('div');
        line.className = 'mp-coord-mdpl';
        node.insertAdjacentElement('afterend', line);
      }
      line.textContent = 'mdpl: memuat…';
      this.label(lat, lng).then(txt => {
        line.textContent = txt ? ('mdpl: ' + txt) : 'mdpl: tidak tersedia';
      });
    });
  }
};
