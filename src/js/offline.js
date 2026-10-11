// AuroraMaps · offline.js — cache tile basemap untuk survei offline
'use strict';
const OfflineManager = {
  cacheName: 'auroramaps-map-tiles-v1',
  async cacheTile(url) {
    try { const r = await fetch(url, { mode: 'cors' }); if (r.ok) (await caches.open(this.cacheName)).put(url, r.clone()); return r.ok; } catch { return false; }
  },
  tileLayer(url, options) {
    const Base = L.TileLayer;
    return new Base(url, options).on('tileerror', async e => { if (!navigator.onLine) { const c = await caches.open(this.cacheName); const r = await c.match(e.tile.src); if (r) e.tile.src = URL.createObjectURL(await r.blob()); } });
  },
  async downloadCurrentArea() {
    if (!window.isSecureContext && location.protocol !== 'file:') { Toast.show('Download offline memerlukan HTTPS', 'warn'); return; }
    const map = MapManager.map, b = map.getBounds(), min = Config.offline.minZoom, max = Config.offline.maxZoom;
    const urls = [];
    const xt = (lng,z) => Math.floor((lng+180)/360*Math.pow(2,z));
    const yt = (lat,z) => Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*Math.pow(2,z));
    for (let z=min; z<=max; z++) { const x1=xt(b.getWest(),z), x2=xt(b.getEast(),z), y1=yt(b.getNorth(),z), y2=yt(b.getSouth(),z); for(let x=x1;x<=x2;x++) for(let y=y1;y<=y2;y++) urls.push(Config.baseLayers[State.currentBasemap].url.replace('{z}',z).replace('{x}',x).replace('{y}',y).replace('{s}','a')); }
    if (urls.length > Config.offline.maxDownloadTiles) { Toast.show(`Area terlalu besar (${urls.length} tile). Zoom lebih dekat lalu coba lagi.`, 'warn'); return; }
    let done=0; Toast.show(`Mengunduh ${urls.length} tile peta…`, 'info');
    for (const url of urls) { if (await this.cacheTile(url)) done++; }
    Toast.show(`${done}/${urls.length} tile tersimpan untuk offline`, done ? 'success' : 'error');
  }
};
