// =====================================================
// AURORAMAPS BHUMI SIDECAR — host Node (zero dependency)
// =====================================================
// Relai BHUMI untuk MODE LOKAL PC (jalur ekstensi dihapus 26 Okt 2026).
// Menjalankan jendela Chrome
// pendamping yang membuka https://bhumi.atrbpn.go.id/peta, menyisipkan
// sidecar-inject.js ke dalam konteks halaman lewat CDP, lalu menyajikan
// endpoint HTTP di 127.0.0.1:8322 yang dibaca AuroraMaps
// (http://127.0.0.1:8321 / http://localhost:8321).
// Semua request data dijalankan DI DALAM halaman BHUMI lewat
// Runtime.evaluate → ter-stempel Origin/Referer bhumi asli → lolos WAF.
//
// Pakai:
//   node tools/bhumi-bridge/sidecar-host.mjs              (buka Chrome sendiri)
//   node tools/bhumi-bridge/sidecar-host.mjs --attach http://127.0.0.1:9333
//       (pakai Chrome yang sudah berjalan dengan CDP — untuk pengembangan)
//   PORT=8322 --port 8322
//
// Login BHUMI hanya perlu SEKALI di jendela pendamping (profil khusus
// tools/bhumi-bridge/.chrome-bhumi-profile); sesi tersimpan di profil itu.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BHUMI_URL = 'https://bhumi.atrbpn.go.id/peta';
const SELF_CDP_PORT = 9355;
const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const CDP_BASE = flag('--attach', '');
// Mode default: SEMUA tersembunyi — Edge/Chrome berjalan headless (tanpa jendela)
// di latar belakang. `--show` (atau `--jendela`) hanya untuk sekali pakai saat
// perlu login BHUMI secara manual / reCAPTCHA token yang membutuhkan jendela.
const SHOW_WINDOW = args.includes('--show') || args.includes('--jendela');
// PORT sering di-set 0 oleh lingkungan shell → abaikan bila bukan port valid,
// supaya endpoint selalu 127.0.0.1:8322 seperti yang dikonfigurasi klien app.
const HTTP_PORT = (() => {
  const v = Number(flag('--port', process.env.PORT));
  return Number.isInteger(v) && v > 0 && v < 65536 ? v : 8322;
})();
const PROFILE_DIR = path.join(__dirname, '.chrome-bhumi-profile');
const INJECT_SRC = fs.readFileSync(path.join(__dirname, 'sidecar-inject.js'), 'utf8');

// Whitelist ganda (server + halaman) — sama dengan ekstensi AuroraMaps lama.
// /expapi/umum/wms = gambar bidang transparan (overlay hasil klik identify).
const TILE_PATHS = ['/mprx/service', '/expapi/bhumigeos/umum/wms', '/expapi/bhumigs/umum/wms', '/expapi/umum/wms'];
const GISTARU_ORIGIN = 'https://gistaru-app.atrbpn.go.id';
const SEARCH_PATHS = ['/expapi/getBidang', '/expapi/getBidang2'];

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ── Browser pendamping (Chromium) ───────────────────────────────────────────
// Utama: Edge bawaan Windows (selalu ada di Win10/11 — tanpa syarat Chrome
// terpasang); cadangan: Chrome. Keduanya Chromium → protokol CDP sama persis.
const BROWSER_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];
function launchBrowser() {
  const exe = BROWSER_PATHS.find(p => fs.existsSync(p));
  if (!exe) throw new Error('Edge/Chrome tidak ditemukan — pakai --attach <url-cdp> untuk browser yang sudah jalan.');
  const invisible = SHOW_WINDOW ? [] : [
    '--headless=new',      // tanpa jendela apa pun — seluruhnya di latar belakang
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1280,800'
  ];
  const child = spawn(exe, [
    ...invisible,
    `--user-data-dir=${PROFILE_DIR}`,
    `--remote-debugging-port=${SELF_CDP_PORT}`,
    '--enable-unsafe-extension-debugging',
    '--no-first-run',
    '--no-default-browser-check',
    BHUMI_URL
  ], { detached: true, stdio: 'ignore' });
  child.unref();
  log('Browser pendamping diluncurkan:', path.basename(exe),
    SHOW_WINDOW ? '(jendela terlihat)' : '(headless — tidak terlihat)', '— profil', PROFILE_DIR);
}

let cdpBase = CDP_BASE;
let cdpBaseP = null; // memoisasi supaya timer 5 dtk tidak meluncurkan Chrome ganda
async function _ensureCdpBase() {
  if (cdpBase) {
    try { await fetch(cdpBase + '/json/version'); return; } catch (_) { /* bawah */ }
    if (CDP_BASE) throw new Error('CDP ' + CDP_BASE + ' tidak merespons.');
  }
  cdpBase = `http://127.0.0.1:${SELF_CDP_PORT}`;
  try { await fetch(cdpBase + '/json/version'); return; } catch (_) { /* bawah */ }
  launchBrowser();
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try { await fetch(cdpBase + '/json/version'); return; } catch (_) { /* retry */ }
  }
  throw new Error('Browser pendamping gagal menyala (CDP tidak siap dalam 30 dtk).');
}
function ensureCdpBase() {
  // Cache hanya selama proses berjalan; setelah selesai (sukses ATAU gagal)
  // dibersihkan supaya panggilan berikutnya benar-benar memeriksa ulang —
  // tanpa ini, browser pendamping yang dimatikan tidak akan pernah dibuka
  // kembali (dulu: "reconnect gagal" terus-menerus tiap 5 dtk).
  if (!cdpBaseP) {
    cdpBaseP = _ensureCdpBase().finally(() => { cdpBaseP = null; });
  }
  return cdpBaseP;
}

async function ensureTab() {
  const list = await (await fetch(cdpBase + '/json/list')).json();
  let t = list.find(x => x.type === 'page' && x.url.startsWith('https://bhumi.atrbpn.go.id/'));
  if (t) return t;
  const r = await fetch(`${cdpBase}/json/new?${encodeURIComponent(BHUMI_URL)}`, { method: 'PUT' });
  if (!r.ok) throw new Error('Gagal membuka tab BHUMI: HTTP ' + r.status);
  const created = await r.json();
  log('tab BHUMI dibuka:', created.id);
  return created;
}

// ── Klien CDP (WebSocket bawaan Node ≥21) ───────────────────────────────────
function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pend = new Map();
    const send = (method, params = {}, timeoutMs = 65000) => new Promise((res, rej) => {
      const my = ++id;
      const to = setTimeout(() => { pend.delete(my); rej(new Error('CDP timeout: ' + method)); }, timeoutMs);
      pend.set(my, { res, rej, to });
      ws.send(JSON.stringify({ id: my, method, params }));
    });
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (!m.id || !pend.has(m.id)) return;
      const p = pend.get(m.id);
      pend.delete(m.id);
      clearTimeout(p.to);
      if (m.error) p.rej(new Error(JSON.stringify(m.error)));
      else p.res(m.result);
    };
    ws.onopen = () => resolve({ ws, send });
    ws.onerror = () => reject(new Error('CDP ws error ke ' + wsUrl));
  });
}

let session = null; // {ws, send}
let connecting = null; // koneksi yang sedang berjalan — cegah injeksi ganda
let hintedLogin = false; // peringatan "belum login" cukup sekali
async function ensureSession() {
  if (session) return session;
  if (connecting) return connecting;
  connecting = (async () => {
    await ensureCdpBase(); // pastikan CDP hidup (buka browser pendamping bila perlu)
    const tab = await ensureTab();
    const s = await connectCdp(tab.webSocketDebuggerUrl);
    await s.send('Page.enable');
    // Berlaku untuk navigasi berikutnya (setara content-script document_start).
    await s.send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT_SRC });
    // Sisipkan juga ke dokumen yang sedang tampil (guard idempotent di dalam skrip).
    await s.send('Runtime.evaluate', { expression: INJECT_SRC, timeout: 15000 }).catch(() => {});
    s.ws.onclose = () => { if (session === s) { session = null; log('ws tab BHUMI tertutup'); } };
    session = s;
    log('sidecar terpasang di tab', tab.id.slice(0, 8), tab.url.slice(0, 60));
    // WAF ATR/BPN menolak UA yang memuat "HeadlessChrome" (teruji: 403 untuk semua
    // tile di mode headless, 200 di jendela normal) → netralkan lewat CDP.
    // Client Hints (sec-ch-ua) tidak ikut "Headless", jadi tetap konsisten.
    if (!SHOW_WINDOW) {
      const uaR = await s.send('Runtime.evaluate', {
        expression: 'navigator.userAgent', returnByValue: true, timeout: 8000
      }).catch(() => null);
      const ua = uaR && uaR.result && uaR.result.value;
      if (typeof ua === 'string' && ua.includes('HeadlessChrome')) {
        await s.send('Network.enable').catch(() => {});
        const bersih = ua.replace('HeadlessChrome', 'Chrome');
        await s.send('Network.setUserAgentOverride', { userAgent: bersih }).catch(() => {});
        log('UA headless dinetralkan →', bersih.slice(0, 72) + '...');
      }
    }
    // Karena pendamping kini headless (tak terlihat), status login hanya bisa
    // diketahui lewat log — beri tahu sekali bila belum login.
    if (!SHOW_WINDOW && !hintedLogin) {
      const st = await s.send('Runtime.evaluate', {
        expression: `(async () => {
          for (let i = 0; i < 30; i++) { if (window.AuroraBhumiSidecar) break; await new Promise(r => setTimeout(r, 500)); }
          if (!window.AuroraBhumiSidecar) return null;
          // Token bisa baru ditulis halaman BHUMI beberapa detik setelah muat →
          // pantau sampai 15 dtk sebelum menyimpulkan belum login.
          for (let i = 0; i < 30; i++) {
            const st = await window.AuroraBhumiSidecar.status();
            if (st && st.loggedIn) return st;
            await new Promise(r => setTimeout(r, 500));
          }
          return window.AuroraBhumiSidecar.status();
        })()`,
        awaitPromise: true, returnByValue: true, timeout: 25000
      }).catch(() => null);
      const v = st && st.result && st.result.value;
      if (v && v.loggedIn === false) {
        hintedLogin = true;
        log('CATATAN: belum login BHUMI — jalankan sekali dengan --show untuk login (klik & cari bidang butuh sesi).');
      }
    }
    return s;
  })().finally(() => { connecting = null; });
  return connecting;
}

// Polling reconnect sederhana.
setInterval(() => {
  ensureSession().catch(err => log('reconnect gagal:', err.message));
}, 5000).unref?.();
ensureSession().catch(err => log('init:', err.message));

// ── Jaga sesi: token loginApi hanya berumur ±15 menit ───────────────────────────────────
// Halaman pendamping TIDAK menjalankan penjadwal refresh milik situs, jadi
// begitu token basi semua permintaan identify/search/tile membalas 401/403 →
// popup bidang tampil TANPA SHM & luas. Pemulihan yang teruji andal adalah
// MUAT ULANG halaman: alur login milik situs berjalan sendiri saat halaman
// dibuka dan menulis token baru (±15 menit). Karena itu ada dua lapis:
//   1. penyegaran preventif — token tinggal < MIN_SISA detik → reload dulu,
//      sebelum ada permintaan yang gagal;
//   2. pemulihan on-demand — permintaan gagal 401/403 dan sesi mati → reload,
//      lalu PERMINTAAN ITU DIULANGI sekali.
const MIN_SISA = (() => {
  const v = Number(process.env.SIDECAR_MIN_SISA);
  return Number.isFinite(v) && v > 0 ? v : 150;
})();
let reloadP = null;   // reload yang sedang berjalan (antrean bersama)
let inFlight = 0;     // jumlah permintaan yang sedang diproses

const statusNow = async () => {
  try { return await callSidecar('status', {}, 8000); } catch (_) { return null; }
};

function reloadTab(alasan) {
  if (reloadP) return reloadP; // yang lain tinggal menunggu reload yang sama
  reloadP = (async () => {
    try {
      const s = await ensureSession();
      // Patokan kesegaran SEBELUM reload: token baru pasti berumur penuh
      // (±900 dtk) sedangkan token lama terus mengecil. Tanpa patokan ini,
      // pemeriksaan pertama (±1 dtk setelah reload) bisa sudah "lolos" dengan
      // token lama yang belum tentu diganti halaman → dianggap pulih padahal
      // belum, lalu permintaan berikutnya gagal 401 lagi.
      const sebelum = await statusNow();
      const sisaSebelum = sebelum && Number.isFinite(Number(sebelum.sisa)) ? Number(sebelum.sisa) : null;
      log('memuat ulang tab BHUMI —', alasan);
      await s.send('Page.reload', { ignoreCache: false });
      for (let i = 0; i < 45; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const st = await statusNow();
        const sisa = st && Number.isFinite(Number(st.sisa)) ? Number(st.sisa) : null;
        const segar = st && st.loggedIn && (sisaSebelum === null
          ? sisa !== null
          : sisa !== null && sisa > sisaSebelum + 20);
        if (segar) { log('sesi pulih (sisa ' + sisa + ' dtk)'); return true; }
      }
      log('PERINGATAN: sesi belum pulih dalam 45 dtk — jalankan ulang sidecar dengan --show untuk login BHUMI.');
      return false;
    } catch (e) {
      log('reload gagal:', e.message);
      return false;
    } finally { reloadP = null; }
  })();
  return reloadP;
}

// Penyegaran preventif tiap 30 dtk — dilewati bila sedang ada permintaan
// (kecuali token tinggal < 45 dtk: lebih baik potong daripada 401).
setInterval(async () => {
  if (reloadP) return;
  const st = await statusNow();
  if (!st || !st.sidecar) return;
  const sisa = Number(st.sisa);
  if (st.loggedIn === false) { await reloadTab('token basi'); return; }
  if (Number.isFinite(sisa) && sisa < MIN_SISA && (inFlight === 0 || sisa < 45)) {
    await reloadTab('token tinggal ' + sisa + ' dtk');
  }
}, 30000).unref?.();

// Permintaan data + pemulihan sesi otomatis.
async function callWithRecovery(method, arg, timeoutMs) {
  inFlight++;
  try {
    if (reloadP) await reloadP; // tunggu reload selesai supaya konteks halaman siap
    try { return await callSidecar(method, arg, timeoutMs); }
    catch (e) {
      const msg = String((e && e.message) || e);
      if (!/40[13]|loginApi|reCAPTCHA|token|sesi/i.test(msg)) throw e;
      const st = await statusNow();
      if (st && st.loggedIn) throw e; // sesi sehat → bukan masalah sesi
      const ok = await reloadTab('pemulihan setelah galat: ' + msg);
      if (!ok) {
        throw new Error(msg + ' — sesi BHUMI belum pulih; jalankan sidecar dengan --show bila perlu login ulang.');
      }
      return await callSidecar(method, arg, timeoutMs); // ulangi sekali
    }
  } finally { inFlight--; }
}

// ── Evaluasi di halaman ─────────────────────────────────────────────────────
function evalMessage(exc) {
  const d = (exc && exc.exception && (exc.exception.description || exc.exception.value)) || exc.text || 'galat';
  // Ambil baris pertama saja — sisanya stack CDP yang membingungkan user.
  return String(d).split('\n')[0].replace(/^Error:\s*/, '');
}
async function evalInPage(expression, timeoutMs) {
  const s = await ensureSession();
  const r = await s.send('Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true, timeout: timeoutMs },
    Math.min(timeoutMs + 5000, 70000));
  if (r.exceptionDetails) throw new Error(evalMessage(r.exceptionDetails));
  const v = r.result && r.result.value;
  if (v === undefined || v === null) {
    throw new Error('Skrip sidecar belum aktif di halaman BHUMI — pastikan tab https://bhumi.atrbpn.go.id/peta terbuka.');
  }
  return v;
}
const callSidecar = (method, arg, timeoutMs) =>
  evalInPage(`window.AuroraBhumiSidecar && window.AuroraBhumiSidecar.${method}(${JSON.stringify(arg)})`, timeoutMs);

// ── HTTP server (loopback only + CORS untuk origin localhost) ───────────────
const isLoopback = (addr) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(addr);
// ── Origin yang boleh memakai sidecar selain localhost ─────────────────────
// 29 Okt 2026: halaman GitHub Pages (https://riacaya.github.io) kini DIIZINKAN
// supaya versi hosting bisa cek bidang/zona/analisa dari PC yang sidecar-nya
// sedang berjalan — sebelumnya CORS hanya menerima localhost sehingga probe
// dari github.io selalu gagal dan fitur CTA mati.
// Risiko: semua halaman di origin itu (repo milik akun yang sama) bisa
// menggerakkan sidecar — hanya repo sendiri, jadi diterima; JANGAN menambah
// origin pihak ketiga. Header Access-Control-Allow-Private-Network dibutuhkan
// Chrome (Private Network Access): fetch https → 127.0.0.1 wajib preflight
// ini sebelum request diizinkan.
const ALLOWED_ORIGINS = ['https://riacaya.github.io'];
// Dapat ditambah TANPA mengubah kode: buat berkas sidecar-origins.json di
// folder ini (berisi array string, mis. ["https://namablog.blogspot.com"])
// lalu restart sidecar. Dipakai untuk halaman Blogger/domain sendiri yang
// host-nya bukan github.io — sisipkan origin persis (skema + host, tanpa
// path). Berkas rusak/tidak ada → abaikan, tetap pakai daftar default.
try {
  const file = path.join(__dirname, 'sidecar-origins.json');
  if (fs.existsSync(file)) {
    const extra = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(extra)) {
      for (const o of extra) {
        const v = String(o || '').trim().replace(/\/+$/, '');
        if (/^https?:\/\//.test(v) && !ALLOWED_ORIGINS.includes(v)) ALLOWED_ORIGINS.push(v);
      }
    }
    log('Origin tambahan dari sidecar-origins.json:', ALLOWED_ORIGINS.slice(1).join(', ') || '(tidak ada)');
  }
} catch (e) {
  log('sidecar-origins.json tidak terbaca (' + e.message + ') — memakai daftar default.');
}
function corsHeaders(req) {
  const o = req.headers.origin || '';
  const oke = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) || ALLOWED_ORIGINS.includes(o);
  if (!oke) return {};
  const h = {
    'Access-Control-Allow-Origin': o,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type'
  };
  // Preflight PNA Chrome (permintaan dari origin publik ke loopback).
  if (req.headers['access-control-request-private-network']) {
    h['Access-Control-Allow-Private-Network'] = 'true';
  }
  return h;
}
const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(res.req) });
  res.end(JSON.stringify(obj));
};
const readBody = (req, max = 1024 * 512) => new Promise((resolve, reject) => {
  let n = 0;
  const chunks = [];
  req.on('data', c => {
    n += c.length;
    if (n > max) { reject(new Error('Body terlalu besar.')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
    catch (_) { reject(new Error('Body bukan JSON valid.')); }
  });
  req.on('error', reject);
});

const server = http.createServer(async (req, res) => {
  res.req = req;
  if (!isLoopback(req.socket.remoteAddress)) { json(res, 403, { error: 'Hanya loopback.' }); return; }
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }
  try {
    if (req.method === 'GET' && url.pathname === '/status') {
      if (reloadP) await reloadP; // jangan sentuh halaman saat sedang dimuat ulang
      const s = await callSidecar('status', {}, 8000);
      json(res, 200, s);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/search') {
      const { path: p, body } = await readBody(req);
      if (!SEARCH_PATHS.includes(p)) { json(res, 403, { error: 'Endpoint pencarian ditolak.' }); return; }
      json(res, 200, await callWithRecovery('search', { path: p, body }, 35000));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/identify') {
      const { body } = await readBody(req);
      json(res, 200, await callWithRecovery('identify', { body }, 50000));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/analisa') {
      // Profil Informasi Bidang Tanah (tombol "Analisa Bidang" di situs):
      // /expapi/analisaPersil dengan auth-ticket ECDH — lihat analisaImpl
      // di sidecar-inject.js. Body dibatasi {latitude,longitude,luas} saja.
      const { body } = await readBody(req);
      const b = (body && typeof body === 'object') ? body : {};
      const safe = {
        latitude: Number(b.latitude),
        longitude: Number(b.longitude),
        luas: Number.isFinite(Number(b.luas)) ? Number(b.luas) : 0
      };
      if (!Number.isFinite(safe.latitude) || !Number.isFinite(safe.longitude)) {
        json(res, 400, { error: 'Parameter koordinat tidak valid.' });
        return;
      }
      json(res, 200, await callWithRecovery('analisa', { body: safe }, 45000));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/tile') {
      const { url: tileUrl } = await readBody(req);
      let u = null;
      try { u = new URL(String(tileUrl)); } catch (_) { /* tolak di bawah */ }
      const ok = u && ((u.origin === 'https://bhumi.atrbpn.go.id' && TILE_PATHS.includes(u.pathname)) ||
        (u.origin === GISTARU_ORIGIN && u.pathname.startsWith('/interoppublic/api/wms/')));
      if (!ok) { json(res, 403, { error: 'URL tile ditolak.' }); return; }
      json(res, 200, await callWithRecovery('tile', { url: tileUrl }, 25000));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/gfi') {
      const { url: gfiUrl } = await readBody(req);
      let u = null;
      try { u = new URL(String(gfiUrl)); } catch (_) { /* tolak di bawah */ }
      // Whitelist sama dengan sidecar-inject.js: WMS gistaru (RTRW Pro) +
      // WMS rtrw bhumi (RTRW Kab) — GetFeatureInfo zona di popup ATRBPN.
      const ok = u && ((u.origin === 'https://bhumi.atrbpn.go.id' && u.pathname === '/expapi/rtrw/wms') ||
        (u.origin === GISTARU_ORIGIN && u.pathname.startsWith('/interoppublic/api/wms/')));
      if (!ok) { json(res, 403, { error: 'URL GFI ditolak.' }); return; }
      json(res, 200, await callWithRecovery('gfi', { url: gfiUrl }, 25000));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/token-sync') {
      const { force } = await readBody(req);
      json(res, 200, await callSidecar('tokenSync', { force: !!force }, 30000));
      return;
    }
    json(res, 404, { error: 'Rute tidak dikenal.' });
  } catch (e) {
    json(res, 502, { error: String((e && e.message) || e) });
  }
});

server.listen(HTTP_PORT, '127.0.0.1', () => {
  log(`BHUMI sidecar siap → http://127.0.0.1:${HTTP_PORT} (CDP: ${cdpBase || 'menunggu...'})`);
  log(SHOW_WINDOW
    ? 'Jendela terlihat — login BHUMI sekali di sini, sesi tersimpan di profil.'
    : 'Mode default: headless tanpa jendela. Butuh login? Jalankan ulang dengan --show. Berhentikan proses ini = sidecar offline.');
});
server.on('error', (e) => { log('HTTP server gagal:', e.message); process.exit(1); });

process.on('SIGINT', () => { log('berhenti.'); server.close(); process.exit(0); });