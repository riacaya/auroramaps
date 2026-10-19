// =====================================================
// AuroraMaps · config.js — Config & State
// =====================================================
'use strict';

// =====================================================
// CONFIG
// =====================================================

// --- Bidang Tanah (persil bhumi) di versi single-file/blog ---
// Tile bhumi hanya bisa dimuat lewat proxy (WAF butuh Referer .atrbpn.go.id).
// Versi lokal (localhost) otomatis pakai /bhumi-proxy; untuk blog, deploy
// Cloudflare Worker lalu isi URL-nya di sini:
//   wrangler deploy .freebuff/bhumi-tile-worker.js --name bhumi-tile-proxy
//   → https://bhumi-tile-proxy.<akun>.workers.dev
// (Alternatif tanpa edit file: tambah ?bhumiWorker=<url> di URL halaman, atau
// localStorage.setItem('bhumiWorkerUrl', '<url>'). Lihat atrbpn.md.)
// ✅ Ter-deploy 18 Agu 2026 — aktif untuk semua versi (blog pakai ini).
window.BHUMI_WORKER_URL = 'https://orange-smoke-f6f5.riacaya99.workers.dev';

// ── Login dari Google Spreadsheet (opsional) ───────────────────────────
// Daftar user/password disimpan di Google Drive Spreadsheet, dan app
// membacanya SEGAR (tanpa cache) tiap kali tombol OK login ditekan —
// menambah/menghapus/mengganti user cukup edit sheet, tanpa ubah kode.
//
// Cara pakai:
//   1. Buat sheet dgn kolom A = username, kolom B = password (header boleh).
//   2. File → Share → Publish to web → pilih sheet → CSV → Publish.
//   3. Tempel link-nya di bawah (link edit / link publish juga boleh —
//      app mengubahnya otomatis ke URL CSV).
// ── Sumber akun login ───────────────────────────────────────────────
// Login diverifikasi SERVER lewat Apps Script (action=login) — password
// dibandingkan di sana, jadi sheet TIDAK harus publik. Setelah skrip
// apps-script/AuroraMapsUsers.gs di-redeploy, jadikan sheet PRIVATE:
//   Share → General access → Restricted (hapus "Publish to web" bila ada).
// URL di bawah hanya cadangan gviz (aktif otomatis bila script lama).
// (Alternatif tanpa edit file: localStorage.setItem('auroramapsLoginSheet', '<url>').)
window.LOGIN_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1wI0ENl2RzrmvprzVyaomIsNmCJzYNJR9KqpWbjTg8kA/edit?usp=sharing';

// ── Batas sesi idle (login ulang otomatis) ─────────────────────────────
// Berapa MENIT tanpa aktivitas (klik/geser/ketik) sebelum sesi berakhir
// dan pengguna harus login ulang ke sheet. 0 = nonaktif (sesi selamanya).
// Timer di-reset otomatis tiap ada aktivitas di peta/aplikasi.
// Override per perangkat tanpa ubah kode:
//   localStorage.setItem('auroramapsSessionMinutes', '15')  // atau '0' utk mati
window.LOGIN_SESSION_MINUTES = 60;

// ── Endpoint Apps Script: manajemen user ──────────────────────────────
// Panel "Administrator" (tombol header PC / baris menu HP #mm-admin) memakai
// endpoint ini untuk membaca daftar user, mengganti/reset password (sandi
// baru di-hash SHA-256 oleh server), dan menghapus id. gviz hanya bisa
// BACA, jadi tulis dilakukan Apps Script. Semua aksi admin via POST body
// — kredensial tidak pernah dikirim lewat URL.
// Skrip: apps-script/AuroraMapsUsers.gs (petunjuk deploy ada di file itu).
// Kosongkan → tombol panel tetap ada tapi membuka error konfigurasi.
window.USER_ADMIN_API_URL = 'https://script.google.com/macros/s/AKfycbw87Ek_iPxSRwdHV79wImgpNbYPAbja47pAjSB54_exMLxYCX2aobWZz-lBCT8Ctqy6uA/exec';

const Config = {
  version: '1.0.0',
  defaultCenter: [20, 0],
  defaultZoom: 3,
  maxHistorySize: 50,
  autoSaveInterval: 30000,
  offline: {
    minZoom: 14,
    surveyZoom: 16,
    maxZoom: 17,
    maxDownloadTiles: 2500
  },
  toastDuration: 3500,
  colors: [
    '#3b82f6','#22c55e','#ef4444','#f59e0b','#8b5cf6',
    '#06b6d4','#ec4899','#14b8a6','#f97316','#84cc16'
  ],
  baseLayers: {
    // ── Probe 5 Okt 2026 (tile nyata vs placeholder, 2 lokasi) ──────────────
    // OSM: konten s/d z19 (z20+ server balas 400). Esri World_Imagery &
    // World_Topo_Map: konten s/d z19 (z20+ = placeholder 2521B).
    // Semua provider di bawah GRATIS tanpa API key.
    //
    // Peta jalan (street): OpenStreetMap standard — data asli s/d z19,
    // z20-22 di-upscale Leaflet. Kunci lama 'osm' masih diterima (alias di
    // MapManager.switchBasemap) agar proyek tersimpan lama tetap terbaca.
    street: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
      maxZoom: 22,
      maxNativeZoom: 19
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri',
      maxZoom: 22,
      // Esri World Imagery punya data asli s/d z19 (terverifikasi: z19 =
      // citra detail; z20+ = tile placeholder kosong 2521B).
      maxNativeZoom: 19
    },
    // Peta topo: Esri World Topographic Map (endpoint yang sama dipakai
    // basemap GISTARU di data/gistaru.atrbpn.go.id.har). Data asli s/d z19 —
    // pengganti OpenTopoMap yang berhenti di z17 (z18+ = tile kosong 4343B).
    topo: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri, HERE, Garmin, FAO, NOAA, USGS, OpenStreetMap contributors',
      maxZoom: 22,
      maxNativeZoom: 19
    },
    // Peta gelap: Esri Dark Gray Canvas, tanpa autentikasi domain atau API key.
    // Data detail area ini tersedia sampai z16; z17+ berupa placeholder.
    dark: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri, HERE, Garmin, © OpenStreetMap contributors, GIS user community',
      maxZoom: 22,
      maxNativeZoom: 16
    }
  }
};
// =====================================================
// STATE
// =====================================================
const State = {
  layers: [],
  selectedLayer: null,
  selectedFeature: null,
  selectedFeatureLayer: null,
  drawingLayer: null,
  activeDrawTool: null,
  activeDrawType: null,
  activeMeasureTool: null,
  isEditMode: false,
  theme: 'senja',
  history: [],
  historyIndex: -1,
  bookmarks: [],
  coordLog: [],
  fileHistory: [],
  colorIndex: 0,
  currentBasemap: 'street',
  lastFPS: 0,
  frameCount: 0,
  lastFPSTime: performance.now(),
  expandedLayers: {},
  drawTargetLayerId: null,
};
