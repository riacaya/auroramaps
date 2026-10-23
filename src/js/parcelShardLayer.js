// Layer batas persil nasional PMTiles dari integrasi publik StudioPolygon/BHUMI.
// Memuat shard sesuai viewport ketika layer di panel ATR/BPN diaktifkan.
'use strict';

class ParcelShardLayer {
  constructor(map) {
    this.map = map;
    this.registryUrl = 'https://api.studiopolygon.id/bhumi-integration/registry.json';
    this.shardBaseUrl = 'https://api.studiopolygon.id/bhumi-integration/shards/';
    this.registryPromise = null;
    this.shards = new Map();
    this.enabled = false;
    this.lastError = '';
    this.opacity = 1;
    this.layer = L.layerGroup();
    this.layer.setOpacity = opacity => {
      this.opacity = opacity;
      for (const entry of this.shards.values()) {
        entry.low.setOpacity(opacity);
        entry.high.setOpacity(opacity);
      }
    };
    this.layer.on('add', () => { this.enabled = true; this.refresh(); });
    this.layer.on('remove', () => { this.enabled = false; });
    this.pane = 'parcelBoundaryPane';
    if (!map.getPane(this.pane)) {
      const pane = map.createPane(this.pane);
      pane.style.zIndex = 322;
      pane.style.pointerEvents = 'none';
    }
    this._refresh = () => this.refresh();
    map.on('moveend zoomend', this._refresh);
  }

  async _getRegistry() {
    if (!this.registryPromise) {
      this.registryPromise = fetch(this.registryUrl, { cache: 'no-cache' })
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then(data => {
          if (data?.format !== 'bhumi-sanitized-shard-registry@1' || !Array.isArray(data.shards)) {
            throw new Error('Format registry shard tidak dikenal');
          }
          return data.shards.filter(item => item?.shardId && item.bounds &&
            ['west', 'south', 'east', 'north'].every(key => Number.isFinite(item.bounds[key])));
        })
        .catch(error => {
          this.registryPromise = null;
          throw error;
        });
    }
    return this.registryPromise;
  }

  async refresh() {
    if (!this.enabled || !this.map || !window.pmtiles?.PMTiles || !window.pmtiles?.leafletRasterLayer) return;
    try {
      const registry = await this._getRegistry();
      if (!this.enabled) return;
      const bounds = this.map.getBounds();
      const view = { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() };
      const visible = registry.filter(({ bounds: b }) =>
        !(b.east < view.west || b.west > view.east || b.north < view.south || b.south > view.north));
      const zoom = this.map.getZoom();
      // Batas shard aktif agar pergeseran/zoom jauh tidak menumpuk tile layer.
      const candidates = zoom >= 17 ? visible.slice(0, 5) : [];
      if (zoom < 17 && this.layer._map && !this._zoomNoticeShown && typeof Toast !== 'undefined') {
        this._zoomNoticeShown = true;
        Toast.show('Zoom in hingga level 17 untuk melihat batas persil.', 'info');
      }
      const visibleIds = new Set(candidates.map(item => item.shardId));

      for (const [id, entry] of this.shards) {
        if (!visibleIds.has(id)) {
          if (this.layer.hasLayer(entry.low)) this.layer.removeLayer(entry.low);
          if (this.layer.hasLayer(entry.high)) this.layer.removeLayer(entry.high);
          entry.visible = false;
        }
      }

      for (const item of candidates) {
        let entry = this.shards.get(item.shardId);
        if (!entry) {
          const fileName = `${item.shardId.replace(/:/g, '-')}.pmtiles`;
          const archive = new window.pmtiles.PMTiles(this.shardBaseUrl + encodeURIComponent(fileName));
          const common = { attribution: 'Data persil: BHUMI ATR/BPN / StudioPolygon', pane: this.pane, minZoom: 17, maxZoom: 22, maxNativeZoom: 17, opacity: this.opacity, bounds: L.latLngBounds([item.bounds.south, item.bounds.west], [item.bounds.north, item.bounds.east]) };
          entry = {
            low: window.pmtiles.leafletRasterLayer(archive, common),
            high: window.pmtiles.leafletRasterLayer(archive, { ...common, minZoom: 20, maxNativeZoom: 19 }),
            visible: false
          };
          entry.low.on('tileerror', event => this._reportError(event?.error));
          entry.high.on('tileerror', event => this._reportError(event?.error));
          this.shards.set(item.shardId, entry);
        }
        if (!entry.visible) {
          this.layer.addLayer(entry.low);
          this.layer.addLayer(entry.high);
          entry.visible = true;
        }
      }

      // Jaga cache kecil: hapus arsip shard yang sudah lama di luar viewport.
      if (this.shards.size > 10) {
        for (const [id, entry] of this.shards) {
          if (entry.visible) continue;
          this.shards.delete(id);
          if (this.shards.size <= 8) break;
        }
      }
    } catch (error) {
      this._reportError(error);
    }
  }

  _reportError(error) {
    const message = error?.message || 'sumber tile tidak dapat dijangkau';
    if (message === this.lastError) return;
    this.lastError = message;
    console.warn('[Batas Persil Indonesia]', error || message);
    if (this.enabled && typeof Toast !== 'undefined') {
      Toast.show(`Batas Persil Indonesia gagal dimuat: ${message}`, 'warn');
    }
  }
}

window.ParcelShardLayer = ParcelShardLayer;
