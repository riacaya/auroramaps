// =====================================================
// AuroraMaps · atrbpnLayers.js — Layer referensi ATR/BPN
// LSD (Lahan Sawah Dilindungi) · RTR Provinsi · RTRW Kabupaten/Kota
// Bidang Tanah / persil (bhumi mprx via proxy lokal /bhumi-proxy)
// Sumber: GISLINER TMS (RTRW Kab/Kota dari HAR pengguna), GISTARU WMS
// /expapi/rtrw/wms (merge), bhumi /expapi/bhumigeos/umum/wms (LSD, gisliner
// mati sejak 22 Okt 2026) & bhumi.atrbpn.go.id/mprx/service
// Klik peta → popup baca layer ATR/BPN aktif (GetFeatureInfo gistaru-app).
// ⚠ 14 Okt 2026: WAF gistaru menolak semua Referer kecuali bhumi.atrbpn.go.id
//   → GetMap RTR Provinsi & GetFeatureInfo zona prov/kab lewat proxy (worker / lokal)
//   (rute /gistaru, lihat _gistaruBase + data/cloudflare-worker.js).
// =====================================================
'use strict';

// Retry otomatis untuk tile yang gagal/gantung (server gisliner sering lambat).
// Event tileerror hanya terpicu untuk kegagalan sungguhan (network error /
// timeout / 404) — tile 200 tapi kosong (data memang tidak ada di kabupaten
// itu) tidak memicu error, jadi tidak ikut di-retry.
// Jeda naik: 1.2s lalu 2.4s (maxRetries 2) agar tidak menghantam server.
// PENTING: request ulang memakai cache-buster (&r=ts), BUKAN reset src='' —
// reset src='' memicu event error lagi yang bikin loop retry tak terbatas
// untuk tile yang gagal permanen (terbukti: 310 error dalam 4 detik).
function attachTileRetry(layer, maxRetries = 2, baseDelay = 1200) {
  const attempts = new Map(); // tile element -> jumlah percobaan
  layer.on('tileerror', (e) => {
    const tile = e.tile;
    if (!tile || !tile.src) return;
    const n = (attempts.get(tile) || 0) + 1;
    if (n > maxRetries) { attempts.delete(tile); return; }
    attempts.set(tile, n);
    const url = tile.src; // masih URL asli saat event tileerror (Leaflet belum menimpa)
    setTimeout(() => {
      if (!tile.isConnected) { attempts.delete(tile); return; } // tile sudah dibuang saat geser
      tile.src = url + (url.includes('?') ? '&' : '?') + 'r=' + Date.now();
    }, baseDelay * n);
  });
  layer.on('tileload', (e) => { if (e.tile) attempts.delete(e.tile); });
  layer.on('remove', () => attempts.clear());
  return layer;
}

// ── GISTARU WMS (acuan data/bhumi.atrbpn.go.id.har + katalog panel bhumi) ──
// Dipakai untuk GetMap (tile) dan GetFeatureInfo (klik → popup).
// GetFeatureInfo kini memakai info_format=application/json (14 Okt 2026):
// gateway gistaru membalas Content-Type: application/json untuk SEMUA
// info_format (termasuk text/html yang lama) dan geometri TIDAK ikut dikirim
// bila bbox klik kecil (±55 m) → respons ±1,1 KB, instan (varian lama
// text/html dulu 14–21 MB & >60 dtk karena geometri fitur ikut terbawa).
// ⚠ WAF: hanya Referer https://bhumi.atrbpn.go.id/ yang diterima (403 sisanya)
//   → semua request diarahkan ke proxy worker bila tersedia (_gistaruBase).
// CORS server terbuka: Access-Control-Allow-Origin: * (GET/POST/OPTIONS).
const GISTARU_WMS = 'https://gistaru-app.atrbpn.go.id/interoppublic/api/wms/';
// ── Slot "provinsi" di panel ATRBPN: endpoint RTRW Provinsi (dari HAR) ───────
// (permintaan user 22 Okt 2026; endpoint kini mengikuti HAR zonaprokab.har).
// Rekaman zonaprokab.har (situs BHUMI, 22 Okt 2026 09:58 WIB) memuat 10 tile
// GetMap endpoint ini — SEMUA 200 image/png (86–260 KB per tile 512px), plus
// GFI yang sama-sama 200 JSON; semua dengan Referer https://bhumi.atrbpn.go.id/ :
//   GET /interoppublic/api/wms/ed3223bb-7a26-408f-9b55-3fd39c1b901f
//       LAYERS=rtr-online:rtrw_provinsi_1_indonesia (WMS 1.3.0, TILED 512px)
// Field GFI provinsi: namobj/wadmpr/nothpr/meta terisi; wadmkk & wadmkc
// umumnya kosong di level provinsi → tidak dirender popup (tetap dicoba).
// Layer RDTR (0c4ea761-… + rtr-online:rdtr_1_indonesia) sempat dipakai 22 Okt
// 2026 & masih hidup, tetapi tidak ada di rekaman ini → tidak dipakai lagi.
const RTRP_UUID = 'ed3223bb-7a26-408f-9b55-3fd39c1b901f';
const RTRP_LAYER = 'rtr-online:rtrw_provinsi_1_indonesia';
const RTRW_UUID = '78abbda6-8c02-403e-baa9-2c470e647e6b';
const RTRW_LAYER = 'rtr-online:rtrw_kabkot_1_indonesia';

// ── Sumber alternatif zona RTRW Kab/Kota via WMS BHUMI (14 Okt 2026) ────────
// Temuan 14 Okt 2026: gistaru-app.atrbpn.go.id TIDAK terjangkau dari jaringan
// datacenter/cloud (Cloudflare Worker → 522 connection timeout; allorigins,
// codetabs, dan 4 node check-host lintas negara → timeout semua; tes TCP dari
// luar mati total) → rute /gistaru tidak berfungsi untuk versi hosting
// (GitHub Pages). Host bhumi.atrbpn.go.id justru MASIH terjangkau dari
// Worker (terverifikasi: GFI via rute /expapi worker → 200 JSON) → pakai
// WMS resmi milik bhumi yang memuat layer gabungan RTRW kab/kota:
//   GET /expapi/rtrw/wms  LAYERS=petabpn:rtrw_kabkot_merge
// Syarat parameter (uji-coba 14 Okt 2026):
//   • STYLES=petabpn:highlight_rtrw_kabkot WAJIB (tanpa styles → server
//     NullPointerException "defaultStyle is null" → 500);
//   • GetFeatureInfo harus CRS/SRS=EPSG:3857 (bbox 4326 → NPE
//     "AffineTransform.getScaleX() tr is null");
//   • info_format=application/json → properties { objectid, keterangan };
//     `keterangan` (jenis zona) dipetakan ke field `namobj` popup.
// Layer ini queryable & nasional (GetCapabilities /expapi/rtrw/wms memuat
// juga rtrwn_2025, rtrw_jateng, dll — tetapi kabkot_merge satu-satunya
// yang cakupannya seluruh Indonesia).
const BHUMI_RTRW_PATH = '/expapi/rtrw/wms';
// Timeout probe sumber RTRW #0: dari PC lokal, tile gistaru 512px butuh
// 0,3–15 dtk (HAR: 3,1 dtk & 12,7 dtk; uji lokal pernah 9,2 dtk) → timeout
// 4 dtk dulu terlalu galak & sering membuat sumber HAR (yang sebenarnya
// sehat) salah dianggap mati sehingga pindah ke cadangan bhumi.
const PROBE_TIMEOUT_MS = 12000;
// Jeda antar siklus penuh (semua sumber Bidang Tanah gagal) — penutupan WAF
// ATR/BPN selama ini bersifat sementara, jadi coba lagi tiap 10 menit tanpa
// spam toast "sumber berganti" tiap 6 tile error.
const BIDANG_RETRY_MS = 10 * 60 * 1000;
const BHUMI_RTRW_LAYER = 'petabpn:rtrw_kabkot_merge';
const BHUMI_RTRW_STYLE = 'petabpn:highlight_rtrw_kabkot';

// ── Layer LSD via WMS Geoserver BHUMI (22 Okt 2026) ──────────────────────────
// TMS gisliner 269_lsd_ MATI total (tile PNG transparan 235 B, md5 konstan
// untuk koordinat/zoom apa pun) → LSD pindah ke Geoserver resmi bhumi, pola
// sama dengan sumber Bidang Tanah (/expapi/bhumigeos/umum/wms). DUA layer
// yang SALING MELENGKAPI (uji langsung 22 Okt 2026 via worker):
//   • umum:lsd_merge_8_provinsi — cakupan Jawa–Bali–Lombok (tile nyata:
//     Bojonegoro 66 KB z12, Indramayu 44 KB z13, Sukoharjo 24 KB z15,
//     Lombok 64 KB z13; kosong di luar wilayah itu);
//   • umum:lsd_merge (12 provinsi) — provinsi LAIN di luar cakupan layer 8
//     (Banjarmasin 26 KB z12, Pontianak 8,5 KB, Banda Aceh 22 KB z12);
//     kosong di Jawa (sudah ditutup layer 8) → keduanya tampil serentak.
// Nama layer TERVERIFIKASI valid (layer tak dikenal membalas ServiceException
// GeoServer, bukan PNG). GetFeatureInfo TIDAK dipakai: wrapper /expapi
// membalas PNG untuk request GFI → LSD tetap visual-only.
const BHUMI_LSD_PATH = '/expapi/bhumigeos/umum/wms';
const BHUMI_LSD_LAYERS = ['umum:lsd_merge_8_provinsi', 'umum:lsd_merge'];

// ── Sumber tile Bidang Tanah (persil) — rantai fallback ─────────────────────
// Urut prioritas (riset 5 Okt 2026, rincian di endpoint.md §Sentuh Tanahku):
//   1) /expapi/bhumigeos/umum/wms + umum:Persil — TERVERIFIKASI LIVE:
//      200 PNG konten nyata (Jakarta 144 KB, Yogyakarta 139 KB per tile 512px;
//      md5 stabil & beda antar lokasi, layer lain di path sama = kosong).
//      Wajib WMS 1.3.0 + CRS=EPSG:3857 (hanya SRS → "InvalidCRS undefined")
//      dan Referer .atrbpn.go.id (tanpa itu 403) → lewat proxy bhumi.
//   2) /mprx/service + bhumi_persil — pola asli rekaman situs BHUMI (HAR);
//      5 Okt pagi backend-nya 503 "Application is not available" (pods mati).
//   3) /expapi/bhumigs/umum/wms + umum:Persil — katalog resmi Directus
//      (panel/items/layers: map_service_url=/bhumigs/umum, vendor Geoserver);
//      GetMap sempat error "Can't obtain the schema" (backend data bermasalah),
//      legend & identik tetap jalan.
// Bila sumber aktif gagal terus-menerus, _attachBidangFallback otomatis
// berganti ke sumber berikutnya (mirip fallback basemap dark).
const BIDANG_SOURCES = [
  // Sumber utama mengikuti bidtan.har: /mprx/service + bhumi_persil (200 PNG).
  { path: '/mprx/service',              layers: 'bhumi_persil' },
  { path: '/expapi/bhumigeos/umum/wms', layers: 'umum:Persil' },
  { path: '/expapi/bhumigs/umum/wms',   layers: 'umum:Persil' }
];

// ── Relai tile Bidang Tanah lewat halaman pendamping (sidecar) ─────────
// Sejak 23 Okt 2026 WAF ATR/BPN menolak permintaan cross-site & non-browser ke
// ruang /mprx dan /expapi: relay lokal (Node) dibalas 403, dan <img> langsung
// dari origin app pun ditolak (uji 24 Okt 2026, bahkan tanpa Referer). Yang
// masih dilayani hanya permintaan dari DALAM halaman bhumi.atrbpn.go.id
// (same-site, sesi & cookie tab itu) → sidecar (tools/bhumi-bridge) mengambil
// tile di dalam tab BHUMI pendamping lewat CDP, bytes-nya dikembalikan sebagai
// object URL. Tanpa sidecar relai dimatikan dan tile dimuat lewat jalur proxy
// lama — persis perilaku sebelumnya. Jalur ekstensi AuroraMaps Bridge dihapus
// 26 Okt 2026.
const BHUMI_TILE_ORIGIN = 'https://bhumi.atrbpn.go.id';
const GISTARU_ORIGIN = 'https://gistaru-app.atrbpn.go.id';
// PC lokal tidak memakai relai gistaru: rute /gistaru di local-server.mjs
// sudah membalas 200 (Referer bhumi di-inject di sana), tanpa putaran relay.
const IS_LOCAL_APP = location.protocol === 'http:' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
const BhumiTileRelay = {
  _cache: new Map(),    // url → object URL (dibatasi supaya hemat memori)
  _order: [],
  _queue: [],
  _active: 0,
  _maxActive: 4,        // jangan membanjiri sidecar
  _avail: null,         // null = belum tahu, false = sidecar tidak aktif
  _availAt: 0,
  _logged: false,

  _setAvail(value, via = 'sidecar lokal') {
    if (this._avail === value) return;
    this._avail = value;
    this._availAt = Date.now();
    if (value && !this._logged) {
      this._logged = true;
      AppConsole.log('Tile Bidang Tanah dimuat lewat tab BHUMI (' + via + ').', 'info');
    }
  },

  // URL object untuk bytes tile, disimpan per URL agar pan/zoom bolak-balik
  // tidak mengulang jaringan. Cache maksimum 200 tile; yang terbuang dicabut.
  _objectUrl(base64, mime) {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime || 'image/png' }));
  },
  _remember(url, base64, mime) {
    const hit = url && this._cache.get(url);
    if (hit) return hit;
    const objectUrl = this._objectUrl(base64, mime);
    if (!url) return objectUrl;
    this._cache.set(url, objectUrl);
    this._order.push(url);
    while (this._order.length > 200) {
      const old = this._order.shift();
      if (old === url) continue;
      const oldUrl = this._cache.get(old);
      this._cache.delete(old);
      if (oldUrl) { try { URL.revokeObjectURL(oldUrl); } catch (e) { /* abaikan */ } }
    }
    return objectUrl;
  },

  get(url) {
    const cached = this._cache.get(url);
    if (cached) return Promise.resolve(cached);
    // Setelah relai dipastikan tidak ada, coba lagi paling cepat tiap 30 detik
    // (mis. sidecar baru dinyalakan).
    const scOk = !!(window.AuroraBhumiSidecarClient && AuroraBhumiSidecarClient.availableSync());
    if (!scOk && this._avail === false && Date.now() - this._availAt < 30000) {
      return Promise.reject(Object.assign(new Error('Relai tile tidak aktif.'), { relay: false }));
    }
    return new Promise((resolve, reject) => {
      // Galat sementara dari relay (mis. WAF ATR/BPN membalas 500 saat burst
      // halaman BHUMI) dicoba ulang sekali lewat relai SELAMA 1.5 dtk sebelum
      // tile jatuh ke basis URL langsung. Galat relay:false (sidecar tidak
      // aktif) tidak diulang — memang tidak akan beda.
      const attempt = (sisa) => {
        this._queue.push({
          url,
          resolve,
          reject: (err) => {
            if (sisa > 0 && !(err && err.relay === false)) {
              setTimeout(() => attempt(sisa - 1), 1500);
            } else reject(err);
          }
        });
        this._pump();
      };
      attempt(1);
    });
  },
  _pump() {
    while (this._active < this._maxActive && this._queue.length) {
      const task = this._queue.shift();
      this._active++;
      const settle = () => { this._active--; this._pump(); };
      this._send(task.url).then(task.resolve, task.reject).then(settle, settle);
    }
  },
  async _send(url) {
    // Satu-satunya jalur: sidecar lokal (tools/bhumi-bridge) — gambar diambil
    // di dalam tab BHUMI pendamping lewat CDP. Galat relay:false dipakai
    // pemanggil untuk tidak mengulang saat sidecar memang tidak ada.
    const sc = window.AuroraBhumiSidecarClient;
    // Probe pertama belum tentu selesai saat tile pertama dimuat → tunggu
    // maks 2,5 dtk sebelum memutuskan.
    if (sc && sc.state() === null) { try { await sc.ready(2500); } catch (e) { /* abaikan */ } }
    if (!(sc && sc.availableSync())) {
      this._setAvail(false);
      throw Object.assign(new Error('Sidecar BHUMI tidak aktif — jalankan jalankan-auroramaps.bat.'), { relay: false });
    }
    return sc.tile(url).then(
      (r) => { this._setAvail(true, 'sidecar lokal'); return this._remember(url, r.base64, r.mime); },
      (err) => { throw err; }
    );
  }
};

// L.TileLayer.WMS yang mengambil tiap tile lewat BhumiTileRelay bila sidecar
// aktif; bila relai menolak, tile dimuat lewat basis URL lama (proxy)
// sehingga tanpa sidecar perilaku layer tidak berubah.
let _RelayWmsClass = null;
function relayWmsLayer(url, options, proxyBase, relayMode = 'bhumi') {
  if (!_RelayWmsClass) {
    // Leaflet 1.9.4: createTile menyetel tile.src LANGSUNG (metode _loadTile
    // sudah tidak ada di build ini) → override createTile, bukan _loadTile.
    _RelayWmsClass = L.TileLayer.WMS.extend({
      createTile(coords, done) {
        const tile = document.createElement('img');
        L.DomEvent.on(tile, 'load', this._tileOnLoad.bind(this, done, tile));
        L.DomEvent.on(tile, 'error', this._tileOnError.bind(this, done, tile));
        if (this.options.crossOrigin || this.options.crossOrigin === '') {
          tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
        }
        if (typeof this.options.referrerPolicy === 'string') tile.referrerPolicy = this.options.referrerPolicy;
        tile.alt = '';
        let direct = '';
        try { direct = this.getTileUrl(coords); } catch (e) { direct = ''; }
        if (!direct) { tile.dispatchEvent(new Event('error')); return tile; }
        const strip = this._relayStrip || '';
        let relayUrl = '';
        if (this._relayMode === 'gistaru') {
          // RTRW Provinsi: URL direct melewati proxy worker yang522 dari cloud
          // (dan dari PC lokal sudah ditangani server lokal) → relai memakai
          // URL asli gistaru, dijalankan dari halaman BHUMI (Referer otomatis).
          const idx = direct.indexOf('/interoppublic/api/wms/');
          if (idx >= 0 && !IS_LOCAL_APP) relayUrl = GISTARU_ORIGIN + direct.slice(idx);
        } else if (strip && direct.startsWith(strip)) {
          relayUrl = BHUMI_TILE_ORIGIN + direct.slice(strip.length);
        } else if (!direct.startsWith(BHUMI_TILE_ORIGIN)) {
          let rest = direct;
          while (rest.startsWith('/')) rest = rest.slice(1);
          relayUrl = BHUMI_TILE_ORIGIN + '/' + rest;
        } else {
          relayUrl = direct;
        }
        if (relayUrl) {
          BhumiTileRelay.get(relayUrl).then(
            (objectUrl) => { tile.src = objectUrl; },
            () => { tile.src = direct; } // tanpa relai / relai gagal → jalur lama
          );
        } else {
          tile.src = direct;
        }
        return tile;
      }
    });
  }
  const layer = new _RelayWmsClass(url, options);
  layer._relayStrip = proxyBase || '';
  layer._relayMode = relayMode;
  return layer;
}

const AtrbpnLayers = {
  _map: null,
  _layers: null,   // { lsd: {...}, rtrp: {...}, rtrw: {...} }

  init() {
    this._map = MapManager.map;
    const G = 'https://gisliner.atrbpn.go.id';
    const xyz = (c, ts) => G + '/layers/tms/public/' + c + '/{z}/{x}/{y}/?tileSize=' + ts;

    // WMS RTR Provinsi (slot provinsi, endpoint dari zonaprokab.har) — pola
    // identik WMS gistaru lain: 1.3.0 TILED 512px. ⚠ WAF gistaru hanya menerima
    // Referer bhumi.atrbpn.go.id (Referer halaman = origin app → 403 "Akses
    // ditolak") → WAJIB lewat proxy server-side. PC lokal: rute /gistaru di
    // local-server.mjs (→ /bhumi-proxy/gistaru); hosting: rute /gistaru di
    // worker Cloudflare. Catatan 22 Okt 2026: dari jaringan cloud worker balas
    // 522 (gistaru tak terjangkau dari luar); dari PC lokal 200 — teruji di HAR.
    const gBase = this._gistaruBase();
    const RTRP_URL = (gBase ? gBase + '/interoppublic/api/wms/' : GISTARU_WMS) + RTRP_UUID;
    // WMS RTRW Kab/Kota — pola PERSIS rekaman situs BHUMI (bhumiatrbpn2.har,
    // 22 Okt 2026): UUID 78abbda6 + LAYERS rtr-online:rtrw_kabkot_1_indonesia,
    // WMS 1.3.0, TILED 512px, STYLES kosong (dipakai utk GetMap tile & GFI).
    const RTRW_URL = (gBase ? gBase + '/interoppublic/api/wms/' : GISTARU_WMS) + RTRW_UUID;

    // Pane terpisah per layer agar urutannya stabil (belakang → depan):
    //   LSD (300) < RTR Provinsi (305) < RTRW Kab/Kota (310) < Bidang Tanah (320)
    // Semua di atas overlay JPG (250) & basemap (200), di bawah data import
    // (400) dan hasil gambar manual (500).
    this._map.createPane('atrbpnLsdPane');
    this._map.getPane('atrbpnLsdPane').style.zIndex = 300;
    this._map.createPane('atrbpnRtrpPane');
    this._map.getPane('atrbpnRtrpPane').style.zIndex = 305;
    this._map.createPane('atrbpnRtrwPane');
    this._map.getPane('atrbpnRtrwPane').style.zIndex = 310;
    this._map.createPane('atrbpnHutanPane');
    this._map.getPane('atrbpnHutanPane').style.zIndex = 318;
    this._map.createPane('atrbpnShguPane');
    this._map.getPane('atrbpnShguPane').style.zIndex = 315;

    // Ringan: tileSize 1024 (tipe native layer gisliner = 'zxy1024', bukan 256)
    // → request berkurang ±16x (mis. z15: 75 tile 256px → 4 tile 1024px), yang
    // penting karena server gisliner sering lambat/gantung di bawah beban.
    // PENTING: tile 1024px Wajib zoomOffset -2 (map z15 → minta grid z13):
    // tanpa offset, Leaflet minta koordinat grid z15 untuk tile 1024px =
    // lokasi salah (kosong/laut). Dengan offset, tile 1024px @zN-2 persis
    // menutupi grid 256px @zN, dan detail 1024px @zN-2 = 256px @zN.
    // maxNativeZoom (terverifikasi 18 Agu, tileSize 1024): data LSD & RTRW
    // ada s/d z16@1024 (Wonosobo; Wonogiri lebih dalam), z17@1024 kosong.
    // Leaflet memakai maxNativeZoom PADA MAP ZOOM SEBELUM zoomOffset
    // (clamp(mapZoom) lalu + offset) — jadi untuk membatasi grid request di
    // z16, set maxNativeZoom = 18 (16 + offset 2). Map z18 → request z16,
    // map z19-22 → tetap z16 (upscale). RTR Provinsi = 21 (WMS gistaru-app
    // dirender on-demand; HAR merekam request z8–z21 semua 200, tileSize 512,
    // tanpa offset).
    // Di atas maxNativeZoom, Leaflet otomatis MENG-UPSACALE tile terakhir
    // sampai maxZoom 22 (seperti basemap) — tanpa request tile tambahan.
    // updateWhenIdle=false + tile 1024: hanya 4-9 tile per viewport, langsung
    // termuat saat digeser (tidak lagi menunggu selesai bergerak).
    const LIGHT = (pane, maxNative = 17, opts = {}) => ({
      tileSize: 256, pane,
      keepBuffer: 1, updateWhenIdle: true,
      maxZoom: 22, maxNativeZoom: maxNative, minZoom: 7,
      attribution: 'ATR/BPN (gisliner)',
      ...opts
    });

    // Bidang Tanah (persil): WMS TILED 512px lewat rantai sumber BIDANG_SOURCES
    // (lihat konstanta di atas — #1 terverifikasi live 5 Okt 2026). Sejak 23 Okt
    // 2026 WAF menolak permintaan cross-site & non-browser → tiap tile dicoba
    // lewat relai sidecar (tab BHUMI pendamping) dulu, lalu jatuh ke basis URL di bawah
    // bila relai tidak tersedia. Basis URL dipilih otomatis, prioritas:
    //   1) URL param ?bhumiWorker=<url>     (override uji, contoh di README)
    //   2) PC lokal (localhost/127.0.0.1) → /bhumi-proxy (local-server.mjs)
    //   3) window.BHUMI_WORKER_URL           (di-set config.js setelah deploy worker)
    //   4) localStorage 'bhumiWorkerUrl'
    //   5) tanpa semua → layer dinonaktifkan + catatan di panel.
    // Opsi 2-4 = URL Cloudflare Worker yang di-deploy user
    // (.freebuff/bhumi-tile-worker.js) agar tile jalan dari blog mana pun
    // (origin non-localhost). Prioritas lokal dulu supaya index.html tetap
    // ringan & tidak bergantung internet ke worker. Pane: bidangPane (z 320,
    // dibuat map.js) — di atas layer ATR/BPN lain, di bawah data import (400).
    const bhumiBase = this._resolveBhumiBase();
    const bidang = (pane) => ({
      layers: BIDANG_SOURCES[0].layers, crs: L.CRS.EPSG3857, version: '1.3.0',
      tiled: true, tileSize: 512, uppercase: true,
      format: 'image/png', transparent: true,
      pane, maxZoom: 22, maxNativeZoom: 20, minZoom: 8,
      attribution: 'Persil ATR/BPN'
    });

    const bidangEntry = {
      label: 'Bidang Tanah (persil)',
      on: false, opacity: 0.8,
      note: bhumiBase ? '' : 'perlu proxy — lihat README (deploy worker)'
    };
    if (bhumiBase) {
      bidangEntry.layer = attachTileRetry(relayWmsLayer(bhumiBase + BIDANG_SOURCES[0].path, bidang('bidangPane'), bhumiBase));
      this._attachBidangFallback(bidangEntry, bhumiBase);
    } else {
      bidangEntry.layer = null;
    }

    // Arsip batas persil nasional PMTiles (shard sesuai area tampilan),
    // terpisah dari layer Bidang Tanah WMS agar dapat dicentang sendiri.
    const batasPersil = new ParcelShardLayer(this._map);
    const batasPersilEntry = {
      label: 'Batas Persil Indonesia', on: false, opacity: 0.85,
      layer: batasPersil.layer
    };

    const hutanEntry = {
      label: 'Kawasan Hutan', on: false, opacity: 0.7,
      note: bhumiBase ? '' : 'perlu proxy — lihat README'
    };    if (bhumiBase) {
      // Server WMS bhumi HANYA menggambar layer ini pada skala nasional
      // (terukur 26 Okt 2026): tile z3–z5 berisi poligon hutan (z5 terkaya,
      // 8,75% piksel berwarna), z6 ke bawah balasannya PNG transparan kosong
      // 6.728 byte — bukan karena URL salah (URL & nama layer persis entri
      // Directus `Kawasan Hutan` yang published) maupun karena TILED (diuji juga
      // tanpa TILED → sama), juga bukan karena WFS (semua rute 404).
      // Karena itu: minZoom 3 (mulai dari tampilan nasional, data z3–z5 ada)
      // dan maxNativeZoom 5 — Leaflet hanya meminta tile z3–z5 lalu
      // meng-overzoom-nya, sehingga hutan TETAP TERLIHAT (meski buram) saat
      // memperbesar, alih-alih hilang total seperti sebelumnya.
      hutanEntry.layer = attachTileRetry(relayWmsLayer(bhumiBase + '/expapi/bhumigeos/umum/wms', {
        layers: 'umum:penunjukan_kawasan_hutan', format: 'image/png',
        transparent: true, version: '1.3.0', uppercase: true, tiled: true, tileSize: 512,
        crs: L.CRS.EPSG3857, maxZoom: 22, maxNativeZoom: 5,
        minZoom: 3, pane: 'atrbpnHutanPane', attribution: 'ATR/BPN — Kawasan Hutan'
      }, bhumiBase));
    } else hutanEntry.layer = null;
    const shguEntry = { label: 'SHGU / HGU (WMS)', on: false, opacity: 0.75, layer: null };
    let shguKey = '';
    try { shguKey = new URLSearchParams(location.search).get('shguAuthKey') || localStorage.getItem('shguAuthKey') || '63e53df2-c66b-436a-aef4-01e8d547008b'; } catch (e) {}
    if (shguKey) shguEntry.layer = attachTileRetry(L.tileLayer.wms('https://api-interop.atrbpn.go.id/api/internal/internal-pusdatin/gisliner-WMSHGU/pptr', {
      layers: 'workspacehgu:layer_hgu', format: 'image/png', transparent: true, version: '1.1.1',
      uppercase: true, authkey: shguKey, crs: L.CRS.EPSG3857, tileSize: 512, maxZoom: 22,
      maxNativeZoom: 18, minZoom: 5, pane: 'atrbpnShguPane', attribution: 'ATR/BPN GISLINER — HGU'
    }));
    else shguEntry.note = 'perlu auth key — gunakan ?shguAuthKey=...';

    // ── RTRW Kab/Kota: TMS GISLINER sesuai HAR pengguna ────────────────────
    const rtrwLayer = attachTileRetry(L.tileLayer(xyz('212_rtrwkbpt', 1024),
      LIGHT('atrbpnRtrwPane', 18, { tileSize: 1024, zoomOffset: -2, updateWhenIdle: false })));
    // ── KP2B DIHAPUS dari panel (31 Okt 2026) ──────────────────────────────
    // Kolom TMS '235_kp2b' membalas 200 OK tetapi tile transparan 235 B di
    // semua titik uji (Semarang, Wonogiri, Sukoharjo, Sleman, Klaten,
    // Boyolali, Jakarta, Pontianak) pada z7–z15 — sedangkan LIGHT() membatasi
    // layer ini mulai minZoom 7, jadi layernya tidak pernah menampilkan apa
    // pun. Zona KP2B tetap terbaca lewat layer RTRW Kab/Kota (fitur
    // namobj="KP2B" + nothpr = dasar Perda, lihat popup RTRW Kab/Kota).

    // ── LSD (Lahan Sawah Dilindungi) ────────────────────────────────────────
    // Dua WMS Geoserver bhumi (rantai cakupan, lihat BHUMI_LSD_* di atas)
    // digabung dalam LayerGroup agar tampil serentak & opacity seragam.
    // Tanpa proxy bhumi → tetap memakai TMS gisliner lama (kini membalas tile
    // kosong konstan, tetap dipertahankan sebagai jaring pengaman bila server
    // gisliner dihidupkan lagi).
    const lsdOpt = (layerName) => ({
      layers: layerName, version: '1.3.0', crs: L.CRS.EPSG3857, tileSize: 512,
      uppercase: true, tiled: true, format: 'image/png', transparent: true,
      maxZoom: 22, maxNativeZoom: 18, minZoom: 7,
      pane: 'atrbpnLsdPane', attribution: 'LSD (bhumi)'
    });
    let lsdEntry;
    if (bhumiBase) {
      const lsdLayers = BHUMI_LSD_LAYERS.map(n =>          attachTileRetry(relayWmsLayer(bhumiBase + BHUMI_LSD_PATH, lsdOpt(n), bhumiBase)));
      const lsdGroup = L.layerGroup(lsdLayers);
      // Panel ATRBPN memanggil setOpacity() pada objek layer; LayerGroup
      // tidak punya metode itu → teruskan ke kedua anak.
      lsdGroup.setOpacity = v => lsdLayers.forEach(l => l.setOpacity(v));
      lsdEntry = { label: 'LSD Nasional', on: false, opacity: 0.8, layer: lsdGroup };
    } else {
      lsdEntry = { label: 'LSD Nasional', on: false, opacity: 0.8,
        layer: attachTileRetry(L.tileLayer(xyz('269_lsd_', 1024),
          LIGHT('atrbpnLsdPane', 18, { tileSize: 1024, zoomOffset: -2, updateWhenIdle: false }))) };
    }

    this._layers = {
      bidang: bidangEntry,
      batasPersil: batasPersilEntry,
      lsd:  lsdEntry,
      rtrp: { label: 'RTR Provinsi (RTRW)', on: false, opacity: 0.7, layer: attachTileRetry(relayWmsLayer(RTRP_URL, LIGHT('atrbpnRtrpPane', 21, {
              layers: RTRP_LAYER, version: '1.3.0',
              crs: L.CRS.EPSG3857, tileSize: 512, uppercase: true, tiled: true,
              format: 'image/png', transparent: true, attribution: 'RTR Provinsi (gistaru-app)'
            }), '', 'gistaru')) },
      rtrw: { label: 'RTRW Kab/Kota',     on: false, opacity: 0.7, layer: rtrwLayer },
      hutan: hutanEntry
      ,shgu: shguEntry
    };

    // Klik peta → baca layer ATR/BPN yang aktif (lihat _onMapClick).
    this._map.on('click', (e) => this._onMapClick(e));
    // Klik fitur poligon manual DIBLOKIR dari map-click (stopPropagation), jadi
    // hasil GetFeatureInfo yang masih lewat harus dibatalkan dari fase capture
    // di document — termasuk klik tombol ✕ popup (bukan bagian kontainer peta).
    document.addEventListener('click', () => {
      this._clickSeq = (this._clickSeq || 0) + 1;
    }, true);
  },

  // ── Klik peta → popup baca layer ATR/BPN ──
  // Aturan (5 Okt 2026):
  //   • Ada layer ATR/BPN aktif → klik membaca layer tsb (GetFeatureInfo
  //     GISTARU, pola acuan HAR) dan popup menampilkan keterangan zona
  //     RTR Provinsi & RTRW Kab/Kota.
  //   • Tidak ada yang aktif → klik dibiarkan; yang dibaca adalah poligon
  //     manual / layer fitur (handler fitur berhenti di sini via stopPropagation).
  //   • Layer Bidang Tanah aktif → TAB "Bidang" di popup INI yang diisi
  //     (POST /expapi/getPersil sesuai rekaman situs bidang.har 5 Okt 2026),
  //     berdampingan dengan tab RTRW Pro/Kab, LSD, KP2B (penggabungan popup
  //     25 Okt 2026) sehingga tidak ada lagi dua popup balapan.
  //   • Kawasan hutan masih DIABAIKAN (server sumbernya mati).
  _onMapClick(e) {
    if (State.activeDrawType) return;   // mode menggambar → klik dipakai vertex
    if (MapManager.isMeasuring) return; // mode pengukuran
    const active = this._activeKeys();
    if (!active.length) {
      // Invalsidasi hasil yang masih melayang (GFI/persil) supaya kartu yang
      // baru saja ditutup tidak dibuka lagi oleh balasan telat.
      this._clickSeq = (this._clickSeq || 0) + 1;
      MapPopup.hide();
      return; // klik baca poligon manual (perilaku lama)
    }
    const { lat, lng } = e.latlng;
    // Tab Bidang (25 Okt 2026): persil di titik klik diambil paralel dengan
    // GFI zona, hasilnya masuk ke state.bidang → tab pertama di popup ini.
    const state0 = {};
    if (active.includes('bidang')) {
      const canId = typeof BhumiIdentify !== 'undefined' && BhumiIdentify._clickIdentifyEnabled;
      state0.bidang = canId ? { pending: true } : { error: 'modul identifikasi belum termuat' };
    }
    // Info zona RTRW SELALU dibaca — seperti tab Analisa (keputusan 29 Okt
    // 2026): tanpa perlu mencentang layer di panel ATRBPN. Centang RTRW
    // Pro/Kab kini hanya mengatur tampilan layer TILE, bukan akses data
    // popup: provinsi lewat GFI GISTARU langsung (tanpa sidecar), kab/kota
    // lewat rantai persil GISTARU → WMS bhumi → GFI GISTARU.
    const want = { prov: true, kab: true };
    const seq = (this._clickSeq = (this._clickSeq || 0) + 1);
    // Klik baru = kartu baru → lupakan pilihan tab klik sebelumnya, supaya
    // kembali ke tab default (layer ATR/BPN aktif teratas, mis. Bidang).
    // Pilihan tab TETAP dipertahankan selama kartu yang sama di-refresh
    // oleh _refreshZones (lihat mapPopup._bindTabs).
    MapPopup._activeTab = null;
    // Kartu awal menampilkan panel untuk semua layer aktif — termasuk tab
    // Bidang yang sedang membaca (state0) dan status identify LSD/KP2B yang
    // belum disediakan endpoint TMS.
    // Tab Analisa (29 Okt 2026): profil "Analisa Bidang" situs (Rencana Tata
    // Ruang, Zona Nilai Tanah, Ketetapan Khusus) dibaca lewat
    // /expapi/analisaPersil — hanya bila sidecar ada; di hosting tanpa
    // sidecar tabnya menampilkan catatan, bukan memanggil (hindari 502/klik).
    const adaAnalisa = this._analisaAvailable();
    const awal = Object.assign({ pending: true }, state0);
    if (adaAnalisa) awal.analisa = { pending: true };
    MapPopup.show(this._zonePopupHtml(
      active, (want.prov || want.kab || state0.bidang || adaAnalisa) ? awal : null, lat, lng));
    // Render bertahap (14 Okt 2026): tiap GFI berjalan paralel TETAPI kartu
    // popup diperbarui setiap hasil masuk — bagian RTRW (WMS bhumi via worker,
    // ±2–4 dtk) langsung tampil tanpa menunggu rantai GISTARU (bisa 15+15 dtk
    // saat server tak terjangkau dari jaringan cloud). Tiap hasil memakai guard
    // seq yang sama seperti pola Promise.all lama.
    const state = Object.assign({}, state0);
    if (want.prov) state.prov = { pending: true };
    if (want.kab) state.kab = { pending: true };
    const settle = this._refreshZones(active, state, lat, lng, seq);
    if (adaAnalisa) {
      state.analisa = { pending: true };
      // Langsung dengan luas 0 supaya tab cepat terisi (±1,8 dtk); saat bidang
      // masuk dan luas diketahui, hasilnya diperbarui dengan luas asli (echo
      // znt.luas di balasan server).
      this._fetchAnalisa(lat, lng, 0).then(r => settle('analisa', r));
    }

    // Tab Bidang: getPersil ECDH di titik klik → hasil + overlay transparan
    // diserahkan ke BhumiIdentify.adopt (AutoSave & tombol bagikan/gambar
    // di tab tetap berfungsi), lalu tabnya dirender lewat settle.
    if (state0.bidang && state0.bidang.pending) {
      BhumiIdentify.readBidang(lat, lng).then(
        features => {
          // Balasan telat: buang HANYA bila kartu sudah bukan milik klik ini
          // (klik peta baru / ditutup). Klik UI mana pun menaikkan _clickSeq
          // (document capture), jadi guard-nya harus memakai _stillOurCard
          // seperti settle — kalau tidak, tab bisa nyangkut di "membaca…".
          if (seq !== this._clickSeq && !this._stillOurCard(lat)) return;
          if (!features || !features.length) { settle('bidang', { empty: true }); return; }
          const main = BhumiIdentify.adopt(features, lat, lng);
          settle('bidang', { features, main, count: features.length });
          // Analisa: perbarui dengan luas bidang yang sebenarnya bila ada.
          const luas = Number(main && main.properties && main.properties.luas);
          if (adaAnalisa && isFinite(luas) && luas > 0) {
            this._fetchAnalisa(lat, lng, luas).then(r => settle('analisa', r));
          }
        },
        err => settle('bidang', { error: (err && err.message) || 'gagal' })
      );
    }
  },

  // Kartu yang tampil masih milik klik pada `lat` ini?
  // Dipakai saat balasan GFI/persil telat masuk: _clickSeq bisa naik karena
  // KLIK UI APA PUN (document capture di init), jadi syaratnya adalah kartu
  // masih terbuka, koordinatnya cocok, dan masih berstatus membaca
  // ("Load ATRBPN……" = kartu pending lama).
  _stillOurCard(lat) {
    const el = MapPopup._el;
    return !!(el && el.style.display === '' &&
      el.textContent.includes(lat.toFixed(6)) &&
      (el.textContent.includes('membaca') || el.textContent.includes('Load ATRBPN')));
  },

  // GFI zona (RTRW Provinsi & Kab/Kota) paralel untuk kartu yang sedang tampil.
  // Mengembalikan settle(key, res): update state lalu susun ulang popup —
  // guard seq mencegah hasil lama menimpa klik yang lebih baru.
  _refreshZones(active, state, lat, lng, seq) {
    // Zona RTRW selalu dibaca (tanpa syarat centang) — lihat catatan di
    // pemanggil; centang hanya mengatur tile.
    const want = { prov: true, kab: true };
    const settle = (key, res) => {
      state[key] = res || { rows: [], count: 0, error: 'gagal' };
      // Buang hasil lama HANYA bila kartu pending sudah tidak tampil / sudah
      // diganti pihak lain (klik koordinat baru, klik fitur, atau ✕ tutup).
      // Klik UI lain tidak boleh membuang hasil — popup jangan nyangkut di
      // "membaca…" selamanya (tanpa auto-hide lagi).
      if (seq !== this._clickSeq && !this._stillOurCard(lat)) return;
      try {
        MapPopup.show(this._zonePopupHtml(active, state, lat, lng));
      } catch (err) {
        // Gagal menyusun popup (data tak terduga) → tetap tampilkan kartu tanpa crash.
        MapPopup.show(`
          <div class="mp-header">
            <span class="mp-title">🧭 ATRBPN</span>
            <button class="mp-close" onclick="MapPopup.hide()" title="Tutup">✕</button>
          </div>
          <div class="mp-cand">⚠ Data tidak tersedia</div>
          <div class="mp-coord">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
        `);
      }
    };
    if (want.prov) this._gfiZone(RTRP_UUID, RTRP_LAYER, lat, lng).then(r => settle('prov', r));
    if (want.kab) this._gfiKabZone(lat, lng).then(r => settle('kab', r));
    return settle;
  },

  // ── Popup gabungan dipanggil dari BhumiIdentify ──────────────────────
  // Polygon highlight bidang diklik ulang / info bidang hasil identify:
  // tab Bidang langsung terisi TANPA getPersil ulang, zona RTRW dibaca
  // seperti klik peta biasa. false = pemanggil memakai popup bidang lama.
  showBidangPopup(features, main, lat, lng) {
    const active = this._activeKeys();
    if (!active.includes('bidang')) return false;
    const bidang = {
      features: features || [],
      main: main || (features && features[0]) || null,
      count: (features || []).length
    };
    const state = { bidang };
    state.prov = { pending: true };
    state.kab = { pending: true };
    const adaAnalisa = this._analisaAvailable();
    if (adaAnalisa) state.analisa = { pending: true };
    const seq = (this._clickSeq = (this._clickSeq || 0) + 1);
    MapPopup._activeTab = null; // kartu baru → tab default (lihat _onMapClick)
    MapPopup.show(this._zonePopupHtml(active, state, lat, lng));
    const settle = this._refreshZones(active, state, lat, lng, seq);
    if (adaAnalisa) {
      const luas = Number(bidang.main && bidang.main.properties && bidang.main.properties.luas);
      this._fetchAnalisa(lat, lng, isFinite(luas) && luas > 0 ? luas : 0)
        .then(r => settle('analisa', r));
    }
    return true;
  },

  // Layer yang sedang tampil (on + benar-benar menempel di peta).
  _activeKeys() {
    return Object.keys(this._layers || {}).filter(k => {
      const e = this._layers[k];
      return e.on && e.layer && this._map.hasLayer(e.layer);
    });
  },

  // Basis proxy GISTARU (rute /gistaru di worker ATAU di server lokal).
  // WAF gistaru hanya membalas 200 untuk Referer https://bhumi.atrbpn.go.id/
  // dan browser tidak bisa mengubah Referer (Referer otomatis = origin app) →
  // GetMap tile & GetFeatureInfo wajib lewat proxy server-side. Basis apa pun
  // yang dipakai (worker cloud / proxy lokal) memakai rute '/gistaru' yang sama:
  // …/gistaru/* (worker) atau /bhumi-proxy/gistaru/* (local-server.mjs).
  _gistaruBase() {
    const b = this._resolveBhumiBase();
    if (!b) return '';
    return b.replace(/\/$/, '') + '/gistaru';
  },

  // ── Analisa Bidang (/expapi/analisaPersil lewat sidecar) ─────────────────
  // Hanya bila sidecar ada: sc.state()===false berarti hosting tanpa sidecar
  // → tab menampilkan catatan, request tidak dikirim (hindari 502 tiap klik).
  _analisaAvailable() {
    const sc = window.AuroraBhumiSidecarClient;
    if (!sc || typeof sc.analisa !== 'function') return false;
    return sc.state() !== false;
  },

  // → {data:{rtrw, znt, lsd, …}} | {error}
  // Balasan host berlapis {data:{success, data}} — dibuka sampai objek profil.
  _fetchAnalisa(lat, lng, luas) {
    const sc = window.AuroraBhumiSidecarClient;
    const gagal = (msg) => ({ error: msg });
    if (!sc || typeof sc.analisa !== 'function') return Promise.resolve(gagal('sidecar tidak tersedia'));
    // Probe pertama belum tentu selesai → tunggu sebentar sebelum memutuskan.
    const tunggu = (sc.state() === null && sc.ready) ? sc.ready(2500) : Promise.resolve(true);
    return tunggu.then(ok => {
      if (!ok) return gagal('sidecar BHUMI tidak aktif');
      return sc.analisa({ latitude: lat, longitude: lng, luas: luas || 0 })
        .then(r => {
          const a = r && r.data;
          const profil = a && a.success && a.data ? a.data : a;
          return (profil && typeof profil === 'object')
            ? { data: profil, luas: luas || 0 }
            : gagal('balasan analisa kosong');
        })
        .catch(e => gagal((e && e.message) || 'gagal'));
    });
  },

  // ── Baca atribut zona lewat getPersil (jalur resmi situs) ─────────────────
  // Sejak pembaruan data situs (Okt 2026) GetFeatureInfo mentah tidak bisa
  // dipakai lagi:
  //   • RTRW Pro  → poligon provinsi kini raksasa; balasan ≥60 dtk / 3,7 MB,
  //     lewat sidecar selalu `CDP timeout: Runtime.evaluate` (25 dtk).
  //     /api/proksi milik situs pun menolaknya: "content size … over limit
  //     26214400" (tercatat di HAR klikbidang-bhumi & pencarian-bhumi).
  //   • RTRW Kab  → balasan >512 KB, kena batas GFI_MAX_BYTES sidecar
  //     ("Balasan GFI terlalu besar.").
  // Jalur getPersil justru mengembalikan properti utuh dalam hitungan detik
  // (teruji live 28 Okt 2026): Pro 12 dtk · Kab 0,8 dtk, lengkap dengan
  // namobj/nothpr/wadmkk/meta. GFI lama dipertahankan sebagai cadangan bila
  // sidecar mati atau layer tak dikenali server.
  // Berhasil → {rows,count}; tidak bisa dicoba / kosong → null.
  async _zoneViaPersil(lat, lng, layerName, service) {
    const sc = window.AuroraBhumiSidecarClient;
    if (!sc || sc.state() === false) return null;
    if (sc.state() === null) { try { await sc.ready(3000); } catch (e) { /* abaikan */ } }
    if (!sc.availableSync()) return null;
    if (typeof BhumiIdentify === 'undefined' || !BhumiIdentify.readLayer) return null;
    try {
      const feats = await BhumiIdentify.readLayer(lat, lng, layerName, service);
      if (!feats || !feats.length) return null; // kosong → serahkan ke GFI cadangan
      const rows = feats.map(f => (f && f.properties) || {}).filter(o => Object.keys(o).length);
      return rows.length ? { rows, count: rows.length } : null;
    } catch (e) { return null; }
  },

  // GetFeatureInfo GISTARU — pola acuan HAR, info_format=application/json
  // (lihat catatan konstanta di atas). bbox = kotak kecil ±55 m di sekitar
  // titik klik, CRS 4326 seperti di HAR. Urutan percobaan: proxy /gistaru
  // dulu, URL asli sebagai cadangan (worker belum ter-deploy / WAF longgar).
  async _gfiZone(uuid, layerName, lat, lng, skipPersil) {
    // Jalur utama: getPersil di server GISTARU (lihat _zoneViaPersil).
    if (!skipPersil) {
      const p = await this._zoneViaPersil(lat, lng, layerName, GISTARU_WMS + uuid);
      if (p) return p;
    }
    const span = 0.0005;
    // FEATURE_COUNT=1 — terukur 27 Okt 2026: FC=5 memaksa server gistaru
    // men-serialize ≥5 poligon provinsi utuh (9 MB, >30 dtk → selalu timeout),
    // sedangkan FC=1 cukup (80 KB, ±4 dtk). Satu titik klik tetap berada di
    // satu zona, jadi satu fitur sudah mewakili hasilnya.
    const qs = '?version=1.1.1&request=GetFeatureInfo&info_format=application/json' +
      '&layers=' + encodeURIComponent(layerName) +
      '&query_layers=' + encodeURIComponent(layerName) +
      '&CRS=EPSG:4326&srs=EPSG:4326&width=256&height=256&x=128&y=128' +
      '&bbox=' + [lng - span, lat - span, lng + span, lat + span].map(v => v.toFixed(6)).join(',') +
      '&FEATURE_COUNT=1';
    const gBase = this._gistaruBase();
    const urls = [];
    const push = (u) => { if (u && !urls.includes(u)) urls.push(u); };
    // Sidecar belum pasti mati → URL gistaru asli didahulukan: lewat rute /gfi
    // (dijalankan di dalam halaman BHUMI pendamping) ia terjangkau dari mana
    // pun, sedangkan rute proxy worker bisa 403 (worker lama) / 522 (gistaru
    // tak terjangkau dari cloud) — dua kegagalan itulah yang muncul di Android.
    const scNow = window.AuroraBhumiSidecarClient;
    if (scNow && scNow.state() !== false) push(GISTARU_WMS + uuid + qs);
    if (gBase) push(gBase + '/interoppublic/api/wms/' + uuid + qs);
    push(GISTARU_WMS + uuid + qs);
    let last = null;
    for (const url of urls) {
      const r = await this._gfiFetch(url);
      if (!r.error) return r;
      last = r;
    }
    // 403 dari rute /gistaru = worker lama (belum ada route gistaru) atau WAF
    // masih menolak; 522 = route sudah ada tetapi server gistaru TIDAK bisa
    // dijangkau dari jaringan cloud (temuan 14 Okt 2026, lihat BHUMI_RTRW_*).
    // Beri petunjuk di popup supaya tidak terkesan mengambang.
    if (last && gBase && last.error && /403|522/.test(last.error)) {
      last.error = 'server GISTARU tidak terjangkau (WAF 403 / jaringan 522)';
    }
    return last;
  },

  // Zona RTRW Kab/Kota — getPersil GISTARU (layer rtrw_kabkot_1: field utuh)
  // dulu; gagal → WMS bhumi merge (lengkapnya terbatas: objectid+keterangan);
  // itu pun gagal → GFI GISTARU lama.
  async _gfiKabZone(lat, lng) {
    const p = await this._zoneViaPersil(lat, lng, RTRW_LAYER, GISTARU_WMS + RTRW_UUID);
    if (p) return p;
    const b = await this._gfiBhumiRtrw(lat, lng);
    if (b && !b.error && b.count > 0) return b;
    return this._gfiZone(RTRW_UUID, RTRW_LAYER, lat, lng, true);
  },

  // GetFeatureInfo zona RTRW lewat WMS BHUMI (petabpn:rtrw_kabkot_merge).
  // Hanya dipakai bila ada basis worker absolut (rute /expapi/* meng-inject
  // Referer bhumi yang dibutuhkan WAF); basis kosong → lewati (skip) supaya
  // pemanggil langsung jatuh ke GFI gistaru.
  async _gfiBhumiRtrw(lat, lng) {
    // bbox kotak ±40 m di sekitar titik klik, koordinat meter EPSG:3857
    // (persis pola live-test yang berhasil; span kecil = respons ringan).
    const span = 40;
    const x = lng * 20037508.34 / 180;
    const y = Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 20037508.34 / Math.PI;
    const qs = '?version=1.1.1&request=GetFeatureInfo&info_format=application/json' +
      '&layers=' + encodeURIComponent(BHUMI_RTRW_LAYER) +
      '&query_layers=' + encodeURIComponent(BHUMI_RTRW_LAYER) +
      '&styles=' + encodeURIComponent(BHUMI_RTRW_STYLE) +
      '&CRS=EPSG:3857&srs=EPSG:3857&width=256&height=256&x=128&y=128' +
      '&bbox=' + [x - span, y - span, x + span, y + span].map(v => v.toFixed(2)).join(',') +
      '&FEATURE_COUNT=5';
    // Basis percobaan: URL bhumi asli dulu BILA sidecar belum pasti mati —
    // lewat rute /gfi sidecar (halaman BHUMI) ia terjangkau dari mana pun;
    // basis worker cloud (gagal 403/522 di Android) jadi cadangan kedua.
    const bases = [];
    const sc = window.AuroraBhumiSidecarClient;
    if (sc && sc.state() !== false) bases.push(BHUMI_TILE_ORIGIN);
    const b = this._resolveBhumiBase();
    if (b && /^https?:\/\//i.test(b)) bases.push(b.replace(/\/$/, ''));
    if (!bases.length) return { rows: [], count: 0, skip: true };
    let last = { rows: [], count: 0 };
    for (const base of bases) {
      const r = await this._gfiFetch(base + BHUMI_RTRW_PATH + qs);
      if (!r.error) {
        // Normalisasi field: layer merge hanya punya objectid + keterangan →
        // samakan dengan nama field GISTARU (namobj) supaya popup tanpa perubahan.
        if (r.rows && r.rows.length) {
          r.rows = r.rows.map(o => (o.namobj ? o : Object.assign({ namobj: o.keterangan || '' }, o)));
        }
        return r;
      }
      last = r;
    }
    return last;
  },

  // URL GFI yang harus dijalankan DI DALAM halaman BHUMI lewat rute /gfi
  // sidecar (Referer/Origin asli) — fetch langsung dari halaman app ditolak
  // WAF (403) dan CORS, terutama di Android yang memuat app dari file://.
  // URL proxy (/bhumi-proxy, /gistaru) TIDAK cocok → tetap jalur fetch biasa.
  _gfiViaSidecar(url) {
    try {
      const u = new URL(url, location.href);
      return (u.origin === GISTARU_ORIGIN && u.pathname.startsWith('/interoppublic/api/wms/')) ||
             (u.origin === BHUMI_TILE_ORIGIN && u.pathname === BHUMI_RTRW_PATH);
    } catch (e) { return false; }
  },

  // Satu percobaan mengambil respons GFI: timeout 15 dtk, gagal → { error }.
  // Bila URL-nya milik bhumi/gistaru langsung dan sidecar aktif, jalankan lewat
  // sidecar dulu (berjalan di halaman BHUMI) — baru jatuh ke fetch biasa.
  async _gfiFetch(url) {
    const sc = window.AuroraBhumiSidecarClient;
    if (sc && this._gfiViaSidecar(url)) {
      if (sc.state() === null) { try { await sc.ready(2500); } catch (e) { /* abaikan */ } }
      if (sc.availableSync()) {
        try {
          const r = await sc.gfi(url);
          if (r && typeof r.text === 'string') return this._parseGfiBody(r.text);
        } catch (e) { /* jatuh ke fetch biasa di bawah */ }
      }
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return this._parseGfiBody(await res.text());
    } catch (err) {
      return { rows: [], count: 0,
               error: err && err.name === 'AbortError' ? 'timeout (15 dtk)' : ((err && err.message) || 'gagal') };
    } finally {
      clearTimeout(timer);
    }
  },

  // Respons GFI hari ini selalu JSON (gateway gistaru memaksa application/json
  // untuk info_format apa pun) → properties fitur jadi baris popup, geometri
  // tidak ikut dikirim. Bila server kembali membalas tabel HTML (varian lama),
  // jatuh ke parser table.featureInfo di bawah.
  _parseGfiBody(text) {
    const t = String(text == null ? '' : text).trim();
    if (t.charAt(0) === '{' || t.charAt(0) === '[') {
      try {
        const j = JSON.parse(t);
        if (j && typeof j === 'object' && !Array.isArray(j)) {
          if (j.error) return { rows: [], count: 0, error: String(j.error) };
          if (Array.isArray(j.features)) {
            const rows = j.features
              .map(f => (f && f.properties) || {})
              .filter(o => Object.keys(o).length);
            return { rows, count: rows.length };
          }
        }
        return { rows: [], count: 0 };
      } catch (e) { /* bukan JSON valid → lanjut coba parser HTML */ }
    }
    return this._parseGfiHtml(t);
  },

  // Parsing tabel default GeoServer (table.featureInfo): baris <th> = nama
  // field, baris <td> = nilai. Respons tanpa fitur → tabel tidak ada → [].
  _parseGfiHtml(html) {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const table = doc.querySelector('table.featureInfo');
      if (!table) return { rows: [], count: 0 };
      const trs = Array.from(table.querySelectorAll('tr'));
      const headTr = trs.find(tr => tr.querySelector('th'));
      const heads = headTr ? Array.from(headTr.querySelectorAll('th')).map(th => th.textContent.trim()) : [];
      const rows = [];
      for (const tr of trs) {
        const tds = Array.from(tr.querySelectorAll('td'));
        if (!tds.length) continue;
        const o = {};
        heads.forEach((h, i) => {
          const v = tds[i] ? tds[i].textContent.trim() : '';
          if (v) o[h] = v;
        });
        rows.push(o);
      }
      return { rows, count: rows.length };
    } catch (err) {
      return { rows: [], count: 0, error: err.message };
    }
  },

  // Susun HTML popup. zoneRes: null = tanpa query zona;
  // { pending } = sedang membaca; { prov, kab } = hasil perintah GetFeatureInfo.
  // Popup portrait dengan tab per layer ATRBPN; tiap pane memuat detail dan sumbernya.
  _zonePopupHtml(active, zoneRes, lat, lng) {
    const esc = (v) => Utils.escapeHtml(String(v));
    const fieldLabels = {
      namobj: 'Jenis Kawasan', keterangan: 'Keterangan', jnsrpr: 'Kategori',
      wadmpr: 'Provinsi', wadmkk: 'Kab/Kota', wadmkc: 'Kecamatan',
      nothpr: 'Dasar Perda', meta: 'Wilayah',
      perda: 'Peraturan Daerah', no_perda: 'Nomor Perda',
      nomor_perda: 'Nomor Perda', tahun_perda: 'Tahun Perda',
      dasar_hukum: 'Dasar Hukum', undang_undang: 'Undang-Undang',
      no_peraturan: 'Nomor Peraturan', jenis_peraturan: 'Jenis Peraturan',
      objectid: 'ID Objek'
    };
    const labelField = (key) => fieldLabels[key.toLowerCase()] ||
      key.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const section = (title, res, fields) => {
      if (!res) return '';
      // Pesan tunggal untuk semua kasus kosong/gagal — hindari crash & tabel
      // kosong saat kabupaten/tsb tidak punya data atau server tak merespons.
      const unavailable = (why) => `<div class="mp-zone-col"><div class="mp-cand">${title}</div><div class="mp-zone-note">⚠ ${why}</div></div>`;
      if (res.pending) return `<div class="mp-zone-col"><div class="mp-cand">${title} — membaca…</div></div>`;
      if (res.error) return unavailable(`Gagal membaca: ${esc(res.error)}`);
      const f = (res.rows || [])[0];
      if (!f) return unavailable('Data tidak tersedia di titik ini');
      const preferred = fields.filter(([key]) => f[key]);
      const known = new Set(preferred.map(([key]) => key.toLowerCase()));
      const extra = Object.entries(f).filter(([key, value]) => value != null && String(value).trim() && !known.has(key.toLowerCase()));
      const rows = preferred.map(([key, label]) => `<div class="mp-detail"><div class="mp-detail-label">${esc(label)}</div><div class="mp-detail-value">${esc(f[key])}</div></div>`)
        .concat(extra.map(([key, value]) => `<div class="mp-detail"><div class="mp-detail-label">${esc(labelField(key))}</div><div class="mp-detail-value">${esc(value)}</div></div>`))
        .join('');
      if (!rows) return unavailable('Data tidak tersedia di titik ini');
      const more = res.count > 1 ? `<div class="mp-detail"><div class="mp-detail-label">Zona lain</div><div class="mp-detail-value">+${res.count - 1}</div></div>` : '';
      return `<div class="mp-zone-col"><div class="mp-cand">${title}</div><div class="mp-fields">${rows}${more}</div></div>`;
    };

    // Kolom zona RTRW SELALU tampil seperti tab Analisa (keputusan 29 Okt
    // 2026) — tidak lagi bergantung pada centang layer di panel ATRBPN;
    // centang hanya mengatur tampilan tile. Data provinsi diverifikasi via
    // GFI JSON zonaprokab.har 22 Okt 2026: namobj/wadmpr/nothpr/meta terisi,
    // sedangkan wadmkk/wadmkc kosong di level provinsi → tidak ikut
    // dirender. WMS bhumi kabkot_merge hanya isi namobj → kolom lain
    // kosong → tak dirender.
    const provSection = section('RTRW Provinsi',
      zoneRes && (zoneRes.pending ? zoneRes : zoneRes.prov),
      [['namobj', 'Jenis Kawasan'], ['wadmpr', 'Provinsi'], ['wadmkk', 'Kab/Kota'],
       ['wadmkc', 'Kecamatan'], ['nothpr', 'Dasar Perda'], ['meta', 'Wilayah']]);
    const kabSection = section('RTRW Kab/Kota',
      zoneRes && (zoneRes.pending ? zoneRes : zoneRes.kab),
      [['namobj', 'Jenis Kawasan'], ['jnsrpr', 'Kategori'], ['wadmpr', 'Provinsi'],
       ['wadmkk', 'Kab/Kota'], ['wadmkc', 'Kecamatan'], ['nothpr', 'Dasar Perda'], ['meta', 'Wilayah']]);
    // Tab LSD & KP2B DIHAPUS dari popup (kesepakatan 25 Okt 2026, ditegaskan
    // lagi 28 Okt): keduanya visual-only — KP2B berasal dari TMS gisliner
    // '235_kp2b' yang tidak punya antarmuka query sama sekali. Rekaman HAR
    // 27 Okt memang menunjukkan situs membaca properti LSD & Kawasan Hutan
    // lewat getPersil (query_layers umum:lsd_merge[,_8_provinsi] &
    // umum:penunjukan_kawasan_hutan — teruji live, jalur ada), TETAPI tabnya
    // tetap tidak dipasang sesuai kesepakatan: hanya Bidang, RTRW Pro, RTRW
    // Kab yang tampil. Layer LSD tetap bisa dicentang di panel ATRBPN, sedang
    // baris KP2B di panel DIHAPUS 31 Okt 2026 (tile '235_kp2b' kosong terus —
    // lihat komentar KP2B di init; zona KP2B masih terbaca via RTRW Kab/Kota).

    // ── Tab Bidang Tanah (25 Okt 2026) ──────────────────────────────
    // Hasil getPersil dari BhumiIdentify; format barisnya mengikuti kartu
    // bidang lama (NIB, luas, tipe hak, desa/kec, akurasi) + tombol
    // bagikan/gambar yang sama. Sengaja memakai .mp-fields/.mp-detail
    // agar identik dengan tab zona lainnya.
    const bidangPane = () => {
      const wrap = (inner) => `<div class="mp-zone-col">${inner}</div>`;
      const note = (t) => wrap(`<div class="mp-cand">Bidang Tanah</div><div class="mp-zone-note">${t}</div>`);
      if (!active.includes('bidang')) return note('Layer Bidang Tanah belum aktif.');
      const res = zoneRes && zoneRes.bidang;
      if (!res || res.pending) return wrap(`<div class="mp-cand">Bidang Tanah — membaca…</div>`);
      if (res.error) return note(`⚠ Gagal membaca: ${esc(res.error)}`);
      const main = res.main || (res.features && res.features[0]);
      if (res.empty || !main) return note('Tidak ada bidang di titik ini');
      const p = main.properties || {};
      const rows = [
        ['NIB', p.nib],
        ['Luas', p.luas ? p.luas + ' m²' : null],
        ['Tipe Hak', p.tipehak],
        ['Desa', p.namadesa],
        ['Kecamatan', p.namakecamatan],
        ['Akurasi', p.akurasibidang]
      ].filter(([, v]) => v != null && v !== '');
      const detail = rows.map(([k, v]) =>
        `<div class="mp-detail"><div class="mp-detail-label">${esc(k)}</div><div class="mp-detail-value">${esc(String(v))}</div></div>`).join('');
      const more = res.count > 1 ? `<div class="mp-cand">${res.count} bidang di titik ini</div>` : '';
      return wrap(`<div class="mp-cand">⬡ Bidang Tanah</div>${more}
        <div class="mp-fields">${detail}</div>
        <button class="mp-share" type="button" onclick="BhumiIdentify.shareLocation(${lat}, ${lng})">🔗 Bagikan lokasi lahan</button>
        <button class="mp-share" type="button" onclick="BhumiIdentify.prepareDrawing()">📝 Gunakan data ini saat menggambar</button>`);
    };

    // ── Tab Analisa (29 Okt 2026) ────────────────────────────────
    // "Analisa Bidang" di situs (modal Profil Informasi Bidang Tanah) =
    // POST /expapi/analisaPersil — lihat analisaImpl di sidecar-inject.js.
    // Balasannya nested {rtrw, znt, lsd, kawasanHutan, tanahUlayat, …};
    // tiap objek dengan found:true dirender GENERIK sebagai satu kartu
    // berisi seluruh field skalarnya, jadi penambahan field oleh situs ikut
    // tampil tanpa mengubah kode ini.
    const analisaPane = () => {
      const wrap = (inner) => `<div class="mp-zone-col">${inner}</div>`;
      const note = (t) => wrap(`<div class="mp-cand">Analisa Bidang</div><div class="mp-zone-note">${t}</div>`);
      const res = zoneRes && zoneRes.analisa;
      if (!res) return note('Analisa belum dimuat.');
      if (res.pending) return wrap('<div class="mp-cand">Analisa Bidang — membaca…</div>');
      if (res.error) return note(`⚠ Gagal membaca: ${esc(res.error)}`);
      const d = res.data;
      if (!d || typeof d !== 'object') return note('Data tidak tersedia di titik ini');

      const namaSeksi = { rtrw: 'RENCANA TATA RUANG', znt: 'ZONA NILAI TANAH' };
      const grupKhusus = ['lsd', 'kawasanHutan', 'tanahUlayat'];
      const label = {
        polaRuang: 'Pola Ruang', jenisPolaRuang: 'Jenis Pola Ruang',
        perda: 'Dasar Ketetapan Hukum', provinsi: 'Provinsi', kabupaten: 'Kab/Kota',
        kecamatan: 'Kecamatan', meta: 'Wilayah', source: 'Sumber',
        estimasiText: 'Rentang Nilai Tanah', nomorZone: 'Nomor Zona',
        tahunDibuat: 'Tahun Zona', namaKantor: 'Kantor Pertanahan',
        luas: 'Luas', status: 'Status', fungsikws: 'Fungsi Kawasan',
        luasHa: 'Luas', keterangan: 'Keterangan', fungsi: 'Fungsi Kawasan'
      };
      const kartu = (key, obj) => {
        if (!obj || typeof obj !== 'object' || obj.found === false) return '';
        // znt: estimasiText sudah memuat rentang — rangeNilai/min/max ganda.
        const lewati = key === 'znt' ? ['found', 'rangeNilai', 'minPerM2', 'maxPerM2'] : ['found'];
        const rows = Object.entries(obj)
          .filter(([k, v]) => !lewati.includes(k) && v != null && typeof v !== 'object' &&
            String(v).trim() !== '' && !(k === 'luas' && Number(v) <= 0))
          .map(([k, v]) => {
            let nilai = String(v);
            if (k === 'luas') nilai = Number(v).toLocaleString('id-ID') + ' m²';
            else if (k === 'luasHa') nilai = Number(v).toLocaleString('id-ID') + ' ha';
            else if (k === 'tahunDibuat') nilai = 'Thn ' + v;
            return `<div class="mp-detail"><div class="mp-detail-label">${esc(label[k] || k)}</div><div class="mp-detail-value">${esc(nilai)}</div></div>`;
          }).join('');
        if (!rows) return '';
        let judul = namaSeksi[key] ||
          (grupKhusus.includes(key) ? 'KETETAPAN KHUSUS — ' + (obj.source || label[key] || key)
            : String(key).replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase());
        if (key === 'znt' && obj.nomorZone) {
          judul += ` • Zona ${obj.nomorZone}${obj.tahunDibuat ? ' • Thn ' + obj.tahunDibuat : ''}`;
        }
        return `<div class="mp-cand">${esc(judul)}</div><div class="mp-fields">${rows}</div>`;
      };
      const isi = (() => {
        // Urut sesuai modal situs: Rencana Tata Ruang → Zona Nilai Tanah →
        // Ketetapan Khusus (…lalu kunci lain yang mungkin ditambah situs).
        const utama = ['rtrw', 'znt', 'lsd', 'kawasanHutan', 'tanahUlayat'];
        const urut = utama.concat(Object.keys(d).filter(k => !utama.includes(k)));
        // rtrw.found kadang false walau sub-kueri RTRW mereka sedang flaky
        // (teruji live 29 Okt: panggilan identik balik true lalu false) →
        // isi kartu Rencana Tata Ruang dari baris zona Kab yang SUDAH ada di
        // tangan (data dasarnya sama: jenis pola, perda, wilayah), supaya
        // profil tetap selengkap yang di situs.
        const rtrwDariZona = () => {
          const f = zoneRes && zoneRes.kab && (zoneRes.kab.rows || [])[0];
          if (!f) return '';
          const rows = [['Pola Ruang', f.namobj], ['Provinsi', f.wadmpr], ['Kab/Kota', f.wadmkk],
            ['Dasar Ketetapan Hukum', f.nothpr], ['Wilayah', f.meta]]
            .filter(([, v]) => v != null && String(v).trim() !== '')
            .map(([k, v]) => `<div class="mp-detail"><div class="mp-detail-label">${esc(k)}</div><div class="mp-detail-value">${esc(String(v))}</div></div>`).join('');
          return rows ? `<div class="mp-cand">RENCANA TATA RUANG</div><div class="mp-fields">${rows}</div>` : '';
        };
        const kartuRtrw = kartu('rtrw', d.rtrw) || rtrwDariZona();
        return [kartuRtrw]
          .concat(urut.filter(k => k !== 'rtrw').map(k => kartu(k, d[k])))
          .filter(Boolean).join('');
      })();
      return isi ? wrap(isi) : note('Tidak ada data analisa di titik ini.');
    };

    // (29 Okt 2026) Catatan "Kawasan Hutan buram / atribut tak terbaca" DIHAPUS
    // dari popup beserta pemicunya — layer hutan tetap bisa dicentang dan
    // digambar, hanya tanpa pesan peringatan di kartu.

    const header = `
      <div class="mp-header">
        <span class="mp-title">🧭 ATRBPN</span>
        <span class="mp-headright">
          <button class="mp-save" type="button" title="Simpan data popup ke berkas .txt" onclick="AtrbpnLayers.exportPopup()">Save</button>
          <button class="mp-close" onclick="MapPopup.hide()" title="Tutup">✕</button>
        </span>
      </div>`;

    // ── Simpan data popup ke .txt ─────────────────────────────────
    // Tombol "Save" di sebelah kiri ✕: sekali klik langsung mengunduh berkas
    // .txt (tanpa menu). Konten diambil dari DOM popup yang sedang tampil —
    // semua tab, termasuk yang tersembunyi — jadi ikut berubah otomatis.

    // Preview sebelum data benar-benar tampil: satu baris loading penuh
    // "Load ATRBPN……" (berkedip, lihat CSS .mp-loading) — dua kolom hanya
    // muncul setelah hasil GFI provinsi & kabupaten masuk.
    const tabDefs = [
      { id: 'bidang', label: 'Bidang', title: 'Bidang Tanah (SHM: NIB & luas)', content: bidangPane() },
      { id: 'rtrp', label: 'RTRW Pro', title: 'RTRW Provinsi', content: provSection || `<div class="mp-zone-col"><div class="mp-cand">RTRW Provinsi</div><div class="mp-zone-note">Layer RTRW Provinsi belum aktif.</div></div>` },
      { id: 'rtrw', label: 'RTRW Kab', title: 'RTRW Kab/Kota', content: kabSection || `<div class="mp-zone-col"><div class="mp-cand">RTRW Kab/Kota</div><div class="mp-zone-note">Layer RTRW Kab/Kota belum aktif.</div></div>` },
      { id: 'analisa', label: 'Analisa', title: 'Analisa Bidang (RTRW, Zona Nilai Tanah, Ketetapan Khusus)', content: analisaPane() },
    ];
    const activeTab = tabDefs.find(tab => active.includes(tab.id))?.id || 'rtrw';
    const tabButtons = tabDefs.map(tab => `<button type="button" class="mp-tab${tab.id === activeTab ? ' active' : ''}" data-mp-tab="${tab.id}" role="tab" aria-selected="${tab.id === activeTab}" title="${tab.title}">${tab.label}</button>`).join('');
    const tabPanes = tabDefs.map(tab => `<div class="mp-tabpane" data-mp-pane="${tab.id}" role="tabpanel"${tab.id === activeTab ? '' : ' hidden'}>${tab.content}</div>`).join('');
    const zones = `<div class="mp-tabs" role="tablist" aria-label="Informasi ATRBPN">${tabButtons}</div><div class="mp-tabpanes">${tabPanes}</div>`;

    return `
      ${header}
      ${zones}
      <div class="mp-coord">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
    `;
  },

  // Kumpulkan isi popup → {coord, tabs:[{judul, bagian:[{seksi, baris:[[label,nilai]]}]}]}
  // Dibaca dari DOM supaya mengikuti persis apa yang tampil di layar.
  _popupData() {
    const el = MapPopup._el;
    if (!el) return null;
    const coordNode = el.querySelector('.mp-coord');
    const coord = coordNode ? coordNode.textContent.trim() : '';
    const tabs = [];
    el.querySelectorAll('[data-mp-pane]').forEach(pane => {
      const id = pane.getAttribute('data-mp-pane');
      const btn = el.querySelector(`[data-mp-tab="${id}"]`);
      const judul = ((btn && btn.textContent) || id).trim();
      const bagian = [];
      let kini = null;
      // Urutan DOM: judul seksi (.mp-cand) lalu baris (.mp-detail) / catatan.
      pane.querySelectorAll('.mp-cand, .mp-detail, .mp-zone-note').forEach(n => {
        if (n.classList.contains('mp-cand')) {
          kini = { seksi: n.textContent.trim(), baris: [] };
          bagian.push(kini);
        } else if (n.classList.contains('mp-detail')) {
          const l = n.querySelector('.mp-detail-label');
          const v = n.querySelector('.mp-detail-value');
          if (!kini) { kini = { seksi: '', baris: [] }; bagian.push(kini); }
          kini.baris.push([(l ? l.textContent.trim() : ''), (v ? v.textContent.trim() : '')]);
        } else {
          const t = n.textContent.trim();
          if (t) {
            if (!kini) { kini = { seksi: '', baris: [] }; bagian.push(kini); }
            kini.baris.push(['Catatan', t]);
          }
        }
      });
      tabs.push({ judul, bagian });
    });
    return { coord, tabs };
  },

  // Unduh berkas: Android memakai jembatan AndroidFileSaver (langsung ke
  // folder Download + Toast), peramban memakai Blob + <a download>.
  _unduh(nama, mime, teks) {
    if (window.AndroidFileSaver && typeof AndroidFileSaver.saveFile === 'function') {
      try {
        const b64 = btoa(unescape(encodeURIComponent(teks)));
        if (AndroidFileSaver.saveFile(nama, mime, b64)) return true;
      } catch (e) { /* jatuh ke jalur blob di bawah */ }
    }
    try {
      const url = URL.createObjectURL(new Blob([teks], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = nama;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
      return true;
    } catch (e) { return false; }
  },

  // Simpan isi popup ke .txt (satu klik, tanpa menu).
  exportPopup() {
    const d = this._popupData();
    if (!d || !d.tabs.length) {
      if (typeof Toast !== 'undefined') Toast.show('Tidak ada data popup untuk disimpan', 'warn');
      return;
    }
    const now = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
    const titik = (d.coord || 'tanpa-koordinat').replace(/[^0-9.-]+/g, '_').replace(/^_|_$/g, '');
    const L = ['AURORAMAPS — DATA ATRBPN',
      'Titik : ' + d.coord,
      'Waktu : ' + now.toLocaleString('id-ID')];
    d.tabs.forEach(t => {
      L.push('', '=== ' + t.judul + ' ===');
      t.bagian.forEach(b => {
        if (b.seksi) L.push('[' + b.seksi + ']');
        b.baris.forEach(([l, v]) => L.push('  ' + (l ? l + ' : ' : '') + v));
      });
    });
    const teks = L.join('\r\n');
    const nama = `auroramaps-${titik}-${stamp}.txt`;
    const ok = this._unduh(nama, 'text/plain;charset=utf-8', teks);
    if (typeof Toast !== 'undefined') {
      Toast.show(ok ? 'Data disimpan: ' + nama : 'Gagal menyimpan berkas', ok ? 'success' : 'error');
    }
  },

  // Pilih basis URL tile Bidang Tanah (lihat komentar di init).
  _resolveBhumiBase() {
    const h = location.hostname;
    // Urutan: ?bhumiWorker (override uji) → worker cloud → localStorage,
    // TETAPI PC lokal (localhost/127.0.0.1) selalu jatuh ke /bhumi-proxy di bawah.
    try {
      const q = new URLSearchParams(location.search).get('bhumiWorker');
      if (q) return q.replace(/\/$/, '');
      const lokal = location.protocol === 'http:' && (h === 'localhost' || h === '127.0.0.1');
      if (!lokal && window.BHUMI_WORKER_URL) return String(window.BHUMI_WORKER_URL).replace(/\/$/, '');
      const ls = lokal ? '' : localStorage.getItem('bhumiWorkerUrl');
      if (ls) return ls.replace(/\/$/, '');
    } catch (e) { /* abaikan */ }
    if (location.protocol === 'http:' && (h === 'localhost' || h === '127.0.0.1')) return '/bhumi-proxy'; // local-server.mjs: inject Referer bhumi + rute /gistaru
    return '';
  },

  // ── Fallback sumber Bidang Tanah ───────────────────────────────────
  // Maju ke sumber berikutnya (BIDANG_SOURCES) bila sumber aktif benar-benar
  // mati: ≥6 tileerror tanpa tile sukses di antaranya (tiap tile sudah
  // di-retry 2x oleh attachTileRetry). Setelah sumber terakhir, PUTAR BALIK
  // ke sumber #1 (cooldown 20 dtk) supaya rantai tidak macet di sumber
  // terburuk saat backend bhumi flaky (500 sesaat lalu pulih). Tile
  // 200-tapi-kosong TIDAK memicu tileerror, jadi sumber yang sehat tidak
  // akan tergantikan selama masih memuat tile.
  _bidangSourceIdx: 0,
  _bidangErrCount: 0,
  _bidangLastWrap: 0,
  _attachBidangFallback(entry, bhumiBase) {
    const layer = entry.layer;
    const applySource = (idx) => {
      const src = BIDANG_SOURCES[idx];
      layer.wmsParams.layers = src.layers;
      layer.setUrl(bhumiBase + src.path); // setUrl → redraw dengan sumber baru
      entry.note = 'sumber: ' + src.path + ' (' + src.layers + ')';
      AppConsole.log(`Sumber tile Bidang Tanah → ${src.path} [${src.layers}]`, 'warn');
    };
    layer.on('tileload', () => { this._bidangErrCount = 0; this._bidangLastWrap = 0; });
    layer.on('tileerror', () => {
      this._bidangErrCount++;
      if (this._bidangErrCount < 6) return;
      this._bidangErrCount = 0;
      const next = (this._bidangSourceIdx + 1) % BIDANG_SOURCES.length;
      if (next === 0) {
        // Sudah keliling penuh SEMUA sumber → kemungkinan besar WAF ATR/BPN
        // yang menutup /mprx & /expapi (berlaku sejak 23 Okt 2026 untuk
        // klien tanpa sesi login), bukan satu endpoint yang mati. Beri tahu
        // SEKALI per 10 menit, kembali ke sumber utama, lalu jeda — jangan
        // spam toast tiap 6 tile error seperti sebelumnya.
        if (Date.now() - this._bidangLastWrap < BIDANG_RETRY_MS) return;
        this._bidangLastWrap = Date.now();
        AppConsole.log('Semua sumber tile Bidang Tanah gagal (kemungkinan WAF ATR/BPN menutup /mprx & /expapi)', 'warn');
        Toast.show('Tile Bidang Tanah sedang ditutup WAF ATR/BPN — dicoba ulang tiap 10 menit. Alternatif sementara: layer "Batas Persil Indonesia".', 'warn');
        this._bidangSourceIdx = 0;
        applySource(0);
        return;
      }
      this._bidangSourceIdx = next;
      applySource(next);
    });
  },

  // ── Fallback sumber tile RTRW Kab/Kota ────────────────────────────────
  // Pemicu: ≥6 tileerror berturut-turut tanpa satu pun tile sukses di
  // antaranya (tiap tile sudah di-retry 2x oleh attachTileRetry). Tile
  // 200-tapi-kosong TIDAK memicu tileerror, jadi sumber yang sehat (mis.
  _rtrwProbed: true,
  // URL probe sumber #0: GetMap 8×8 px (murah) ke WMS gistaru endpoint HAR.
  _probeRtrwUrl() {
    const base = this._gistaruBase();
    if (!base) return '';
    return base + '/interoppublic/api/wms/' + RTRW_UUID +
      '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image%2Fpng&TRANSPARENT=true' +
      '&LAYERS=' + encodeURIComponent(RTRW_LAYER) + '&STYLES=&CRS=EPSG:3857&WIDTH=8&HEIGHT=8&BBOX=0,0,1000,1000';
  },
  async _probeRtrwOk() {
    const url = this._probeRtrwUrl();
    if (!url) return false;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => { try { ctrl && ctrl.abort(); } catch (e) { /* abaikan */ } }, PROBE_TIMEOUT_MS);
    try {
      const r = await fetch(url, ctrl ? { signal: ctrl.signal } : {});
      return !!r.ok;
    } catch (e) { return false; } // gagal / dibatalkan → sumber #0 dianggap mati
    finally { clearTimeout(timer); }
  },
  _apply(key) {
    const entry = this._layers[key];
    if (!entry.layer) return; // layer tak tersedia (tanpa proxy)
    entry.layer.setOpacity(entry.opacity);
    if (entry.on && !this._map.hasLayer(entry.layer)) this._map.addLayer(entry.layer);
    if (!entry.on && this._map.hasLayer(entry.layer)) this._map.removeLayer(entry.layer);
  },

  // #modal-body di-clone agar listener lama ikut hilang — tapi clone juga ikut
  // menyalin atribut data-bound-* milik komponen lain (panel Export, editor
  // fitur) yang menyimpan flag "sudah terikat" tanpa listener-nya. Akibatnya
  // tombol komponen itu mati saat modal dibuka lagi. Buang semua flag itu.
  _dropStaleBindingFlags(el) {
    Object.keys(el.dataset).forEach(k => { if (k.startsWith('bound')) delete el.dataset[k]; });
  },

  showPanel(includeSearch = true, searchMode = 'shm') {
    // Cari bidang → panel tab (Sertifikat Analok · NIB · NIBEL), gaya Sentuh.
    if (includeSearch) { this.showCariBidang(searchMode === 'nib' ? 'nib' : searchMode === 'nibel' ? 'nibel' : 'analok'); return; }
    const rows = Object.keys(this._layers).map(k => {
      const e = this._layers[k];
      const pct = Math.round(e.opacity * 100);
      if (!e.layer) {
        // Layer tak tersedia (Bidang Tanah tanpa proxy): tampilkan disabled + catatan.
        return `
        <label class="atrbpn-row atrbpn-disabled" data-key="${k}">
          <input type="checkbox" disabled/>
          <span class="atrbpn-name">${e.label} <span class="atrbpn-note">(${e.note || 'tak tersedia'})</span></span>
        </label>`;
      }
      return `
        <label class="atrbpn-row" data-key="${k}">
          <input type="checkbox" id="atrbpn-ck-${k}" class="modal-check"${e.on ? ' checked' : ''}/>
          <span class="atrbpn-name">${e.label}</span>
          <input type="range" id="atrbpn-op-${k}" min="10" max="100" value="${pct}"${e.on ? '' : ' disabled'}/>
          <span class="atrbpn-val" id="atrbpn-val-${k}">${pct}%</span>
        </label>`;
    }).join('');

    Modal.open('🧭 ATRBPN',
      `<div class="modal-stack">
        ${rows}
        <div class="exp-actions"><button class="btn btn-primary" data-export-action="ok">OK</button></div>
      </div>`,
      []
    );
    document.querySelector('#modal-container .modal')?.classList.add('modal-narrow');

    let body = document.getElementById('modal-body');
    if (!body) return;
    // Modal reuses the same DOM node. Clone it so every opening gets clean
    // listeners and fresh autocomplete state after a previous search.
    const freshBody = body.cloneNode(true);
    body.replaceWith(freshBody);
    body = freshBody;
    this._dropStaleBindingFlags(body);
    body.dataset.boundAtrbpn = 'false';
    body.addEventListener('click', e => {
      if (e.target.closest('[data-export-action="ok"]')) Modal.close();
    });
    body.addEventListener('change', e => {
      const row = e.target.closest('.atrbpn-row'); if (!row) return;
      const key = row.dataset.key, entry = this._layers[key]; if (!entry?.layer) return;
      if (e.target.id === 'atrbpn-ck-' + key) { entry.on = e.target.checked; document.getElementById('atrbpn-op-' + key).disabled = !entry.on; this._apply(key); }
    });
    body.addEventListener('input', e => {
      const row = e.target.closest('.atrbpn-row'); if (!row) return;
      const key = row.dataset.key, entry = this._layers[key]; if (!entry?.layer || e.target.id !== 'atrbpn-op-' + key) return;
      entry.opacity = +e.target.value / 100; document.getElementById('atrbpn-val-' + key).textContent = e.target.value + '%'; this._apply(key);
    });
  },

  // ── Panel "Cari Bidang": SATU modal berisi 3 tab (gaya Sentuh Tanahku) ──
  // 1) Sertifikat Analok (SHM/HGU) 2) NIB 3) Sertifikat Elektronik (NIBEL).
  // Semua pane tetap di DOM → state tiap tab (kantor, nomor) tersimpan sendiri.
  showCariBidang(tab = 'analok') {
    if (tab !== 'nib' && tab !== 'nibel') tab = 'analok';
    const tabs = [
      ['analok', 'Sertifikat Analok', 'SHM & HGU (sertifikat analok)'],
      ['nib', 'NIB', 'Pencarian Nomor Identifikasi Bidang'],
      ['nibel', 'Sertifikat Elektronik', 'NIBEL (sertifikat elektronik)']
    ];
    const tabBar = tabs.map(([id, label, title]) =>
      `<button type="button" class="atrbpn-tab${tab === id ? ' active' : ''}" data-atrbpn-tab="${id}" title="${title}">${label}</button>`).join('');
    const html = `
        <div class="atrbpn-search-box">
          <div class="atrbpn-tabs">${tabBar}</div>
          <div class="atrbpn-tabpane" data-atrbpn-pane="analok"${tab === 'analok' ? '' : ' hidden'}>${this._cariFormHtml('atrbpn-shm', 'shm')}</div>
          <div class="atrbpn-tabpane" data-atrbpn-pane="nib"${tab === 'nib' ? '' : ' hidden'}>${this._cariFormHtml('atrbpn-nib', 'nib')}</div>
          <div class="atrbpn-tabpane" data-atrbpn-pane="nibel"${tab === 'nibel' ? '' : ' hidden'}>
            <strong>Cari bidang dengan NIBEL</strong>
            <label class="prop-label">NIBEL</label>
            <input id="atrbpn-nibel-value" class="prop-edit-val" inputmode="numeric" placeholder="Masukkan NIBEL"/>
            <button class="btn btn-primary" id="atrbpn-nibel-search">Cari NIBEL</button>
          </div>
        </div>`;
    Modal.open('🔎 Cari Bidang', `<div class="modal-stack">${html}</div>`, []);
    document.querySelector('#modal-container .modal')?.classList.add('modal-narrow');

    let body = document.getElementById('modal-body');
    if (!body) return;
    // Clone node agar tiap buka bersih dari listener tersemat sebelumnya.
    const freshBody = body.cloneNode(true);
    body.replaceWith(freshBody);
    body = freshBody;
    this._dropStaleBindingFlags(body);
    body.dataset.boundAtrbpn = 'search';
    const showTab = id => {
      body.querySelectorAll('.atrbpn-tab').forEach(b => b.classList.toggle('active', b.dataset.atrbpnTab === id));
      body.querySelectorAll('.atrbpn-tabpane').forEach(p => { p.hidden = p.dataset.atrbpnPane !== id; });
    };
    body.querySelectorAll('.atrbpn-tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.atrbpnTab)));
    this._bindCariForm('atrbpn-shm', 'shm');
    this._bindCariForm('atrbpn-nib', 'nib');
    document.getElementById('atrbpn-nibel-search')?.addEventListener('click', () => {
      const value = document.getElementById('atrbpn-nibel-value')?.value.trim();
      Modal.close();
      BhumiIdentify.searchNibel(value).then(features => Toast.show(features.length ? `${features.length} bidang ditemukan` : 'NIBEL tidak ditemukan', features.length ? 'success' : 'warn')).catch(err => Toast.show(err.message, 'error'));
    });
  },

  // Form cari dgn id ber-prefix (tab Sertifikat Analok & NIB isinya sama,
  // beda label & endpoint). Prefix dipisah per tab supaya state tak bercampur.
  _cariFormHtml(p, mode) {
    const isNib = mode === 'nib';
    return `
          <strong id="${p}-title">Cari bidang berdasarkan ${isNib ? 'NIB' : 'SHM'}</strong>
          <label class="prop-label">Status Hak</label>
          <select id="${p}-tipe" class="prop-edit-val"><option value="1">Hak Milik</option><option value="2">Hak Guna Usaha</option><option value="3">Hak Guna Bangunan</option><option value="4">Hak Pakai</option><option value="5">Hak Pengelolaan</option><option value="6">Hak Wakaf</option></select>
          <label class="prop-label">Kabupaten/Kota</label>
          <input id="${p}-kab" class="prop-edit-val" list="${p}-kab-list" placeholder="Ketik nama kabupaten..." autocomplete="off"/>
          <datalist id="${p}-kab-list"></datalist>
          <div id="${p}-desa-wrap"><label class="prop-label">Desa/Kelurahan</label><input id="${p}-desa" class="prop-edit-val" list="${p}-desa-list" placeholder="Pilih kabupaten dulu..." autocomplete="off" disabled/><datalist id="${p}-desa-list"></datalist></div>
          <label class="prop-label" id="${p}-nomor-label">5 digit ${isNib ? 'NIB' : 'terakhir nomor SHM'}</label>
          <input id="${p}-nomor" class="prop-edit-val" inputmode="numeric" maxlength="5" placeholder="Contoh: ${isNib ? '01889' : '02329'}"/>
          <button class="btn btn-primary" id="${p}-search">Cari ${isNib ? 'NIB' : 'SHM'}</button>`;
  },

  _bindCariForm(p, mode) {
    const isNib = mode === 'nib';
    const kabSelect = document.getElementById(p + '-kab');
    if (!kabSelect) return;
    const kabList = document.getElementById(p + '-kab-list');
    const desaSelect = document.getElementById(p + '-desa');
    const desaList = document.getElementById(p + '-desa-list');
    const desaWrap = document.getElementById(p + '-desa-wrap');
    let kabRows = [];
    let desaRows = [];
    const namaKab = x => x.nama || x.name || x.nama_kabkot || x.nam_kabkot || x.label || x.id || x.value;

    // listKabupaten tries the reference endpoint first, then local JS snapshots.
    BhumiIdentify.listKabupaten().then(data => {
      kabRows = Array.isArray(data) ? data : (data?.data || data?.rows || []);
      kabList.innerHTML = kabRows.map(x => `<option value="${Utils.escapeHtml(namaKab(x))}"></option>`).join('');
    }).catch(err => { kabSelect.placeholder = err.message; });

    const syncTipe = () => {
      const v = document.getElementById(p + '-tipe')?.value || '1';
      const tanpaDesa = v === '2' || v === '5';
      if (desaWrap) desaWrap.hidden = tanpaDesa;
      if (tanpaDesa && desaSelect) desaSelect.value = '';
      if (isNib) return;
      const judul = v === '2' ? 'nomor HGU' : v === '5' ? 'nomor Hak Pengelolaan' : 'SHM';
      const kata = v === '2' ? 'nomor HGU' : v === '5' ? 'nomor Hak Pengelolaan' : 'terakhir nomor SHM';
      const singkat = v === '2' ? 'HGU' : v === '5' ? 'Hak Pengelolaan' : 'SHM';
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set(p + '-title', 'Cari bidang berdasarkan ' + judul);
      set(p + '-nomor-label', '5 digit ' + kata);
      set(p + '-search', 'Cari ' + singkat);
      const nomorInput = document.getElementById(p + '-nomor');
      if (nomorInput) nomorInput.placeholder = 'Contoh: ' + (tanpaDesa ? '01889' : '02329');
    };
    document.getElementById(p + '-tipe')?.addEventListener('change', () => {
      syncTipe();
      if (!desaWrap?.hidden && kabSelect.value) kabSelect.dispatchEvent(new Event('change'));
    });
    syncTipe();

    kabSelect.addEventListener('change', async () => {
      const kab = kabRows.find(x => namaKab(x) === kabSelect.value.trim());
      desaRows = [];
      if (desaList) desaList.innerHTML = '';
      if (desaSelect) {
        desaSelect.value = '';
        desaSelect.disabled = true;
      }
      if (!kab || !desaSelect || desaWrap?.hidden) return;
      try {
        const kabId = kab.id || kab.kabkotId || kab.value;
        // listDesa tries /api/desa first, then the local JS snapshots on failure.
        const data = await BhumiIdentify.listDesa(kabId);
        desaRows = Array.isArray(data) ? data : (data?.data || data?.rows || []);
        desaList.innerHTML = desaRows.map(x => `<option value="${Utils.escapeHtml(x.nama || x.name || x.label || x.id || x.value)}"></option>`).join('');
        desaSelect.placeholder = desaRows.length ? 'Ketik nama desa...' : 'Daftar desa tidak tersedia';
        desaSelect.disabled = false;
      } catch (err) {
        desaSelect.placeholder = err.message;
      }
    });

    document.getElementById(p + '-search')?.addEventListener('click', () => {
      const k = kabRows.find(x => namaKab(x) === kabSelect.value.trim());
      if (!k) { Toast.show('Pilih kabupaten/kota dari daftar', 'warn'); return; }
      const tipeVal = document.getElementById(p + '-tipe')?.value || '1';
      const tanpaDesa = tipeVal === '2' || tipeVal === '5';
      const desaName = desaSelect?.value.trim();
      const desaRow = tanpaDesa ? null : desaRows.find(x => (x.nama || x.name || x.label) === desaName);
      const wilayahId = tanpaDesa
        ? (k.id || k.kabkotId || k.value)
        : (desaRow?.id || desaRow?.desaId || desaRow?.value);
      if (!wilayahId) { Toast.show('Pilih desa dari daftar', 'warn'); return; }
      const nomor = document.getElementById(p + '-nomor')?.value.trim();
      if (!/^\d{5}$/.test(nomor || '')) { Toast.show('Isi 5 digit nomornya dulu', 'warn'); return; }
      const tipe = tanpaDesa ? 'hgu_hpl' : tipeVal;
      Modal.close();
      const search = (isNib || tanpaDesa) ? BhumiIdentify.searchNib : BhumiIdentify.searchCertificate;
      search.call(BhumiIdentify, wilayahId, nomor, tipe).then(features => {
        if (features.length) Toast.show(`${features.length} bidang ditemukan`, 'success');
        else Toast.show(`${tanpaDesa ? (tipeVal === '5' ? 'Hak Pengelolaan' : 'HGU') : (isNib ? 'NIB' : 'Bidang')} tidak ditemukan`, 'warn');
      }).catch(err => Toast.show(err.message, 'error'));
    });
  },

  showSearchPanel(type) {
    // Semua jenis pencarian kini membuka panel tab yang sama.
    this.showCariBidang(type === 'nib' ? 'nib' : type === 'nibel' ? 'nibel' : 'analok');
  }
};
