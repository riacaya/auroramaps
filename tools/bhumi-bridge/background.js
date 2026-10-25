const relayPending = new Map();   // identify & search: requestId → {appTabId, bhumiTabId, timer, kind}
const RELAY_TIMEOUT_MS = 35000;

function safeIdentifyError(error) {
  const status = Number(error?.status);
  if (status === 401) return 'Identifikasi butuh login BHUMI (HTTP 401) — login di tab BHUMI lalu klik bidang lagi.';
  return status ? `BHUMI tidak mengembalikan data persil (HTTP ${status}).` :
    'BHUMI tidak mengembalikan data persil. Pastikan peta BHUMI sudah siap dan akun aktif.';
}

function safeSearchError(error) {
  const status = Number(error?.status);
  if (status) return `Pencarian ditolak tab BHUMI (HTTP ${status}). Pastikan BHUMI sudah login dan peta siap.`;
  return typeof error?.message === 'string' && error.message ?
    error.message : 'Pencarian di tab BHUMI gagal. Pastikan BHUMI sudah login dan peta siap.';
}

function findBhumiTab(sender) {
  return chrome.tabs.query({ url: 'https://bhumi.atrbpn.go.id/*' }).then(tabs => {
    if (!tabs.length) return null;
    return tabs.find(t => t.windowId === sender.tab.windowId) || tabs[0];
  });
}

function replyToApp(tabId, requestId, payload) {
  chrome.tabs.sendMessage(tabId, { type: 'result', requestId, ...payload }).catch(() => {});
}

// Relai umum identify & search ke tab BHUMI: request dijalankan sebagai fetch
// dari dalam halaman BHUMI (sesi + token halaman itu), tab TIDAK dinavigasi
// ulang lagi (alur lama menunggu situs memanggil getPersil dari URL parameter
// dan terbukti tidak pernah terpicu → timeout 60 detik).
function relayToBhumiTab(sender, sendResponse, requestId, tabMessage, kind, timeoutText) {
  findBhumiTab(sender).then((bhumiTab) => {
    if (!bhumiTab) {
      sendResponse({ error: 'Buka tab bhumi.atrbpn.go.id (peta) di browser ini, lalu coba lagi.' });
      return;
    }
    const old = relayPending.get(requestId);
    if (old) clearTimeout(old.timer);
    const timer = setTimeout(() => {
      const item = relayPending.get(requestId);
      if (!item) return;
      relayPending.delete(requestId);
      replyToApp(item.appTabId, requestId, { error: timeoutText });
    }, RELAY_TIMEOUT_MS);
    relayPending.set(requestId, { appTabId: sender.tab.id, bhumiTabId: bhumiTab.id, timer, kind });
    chrome.tabs.sendMessage(bhumiTab.id, { ...tabMessage, requestId }).catch(() => {
      const item = relayPending.get(requestId);
      if (!item) return;
      clearTimeout(item.timer);
      relayPending.delete(requestId);
      replyToApp(item.appTabId, requestId,
        { error: 'Tab BHUMI tidak merespons; muat ulang peta BHUMI lalu coba lagi.' });
    });
    sendResponse({ accepted: true });
  }).catch(() => sendResponse({ error: 'Tidak dapat menghubungi tab BHUMI.' }));
}

const appOriginOk = (url) =>
  url.startsWith('http://127.0.0.1:8321/') || url.startsWith('http://localhost:8321/') ||
  url.startsWith('https://riacaya.github.io/');

// Relai tile persil: ambil gambar WMS dari dalam tab BHUMI (same-site, satu-
// satunya jalur yang tidak diblokir WAF) lalu kembalikan bytes-nya ke app.
const BHUMI_ORIGIN = 'https://bhumi.atrbpn.go.id';
const GISTARU_ORIGIN = 'https://gistaru-app.atrbpn.go.id';
const TILE_PATHS = ['/mprx/service', '/expapi/bhumigeos/umum/wms', '/expapi/bhumigs/umum/wms', '/expapi/umum/wms'];
// Tile RTRW Provinsi diambil dari WMS gistaru lewat tab BHUMI (Referer bhumi
// wajib; host cloud tidak terjangkau — lihat endpoint.md / catatan 14 Okt 2026).
const tileUrlOk = (parsed) =>
  (parsed.origin === BHUMI_ORIGIN && TILE_PATHS.includes(parsed.pathname)) ||
  (parsed.origin === GISTARU_ORIGIN && parsed.pathname.startsWith('/interoppublic/api/wms/'));
const TILE_TIMEOUT_MS = 25000;
const tilePending = new Map(); // requestId → {appTabId, bhumiTabId, timer, url}

function replyTileToApp(tabId, requestId, payload) {
  chrome.tabs.sendMessage(tabId, { type: 'tile-result', requestId, ...payload }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Identifikasi bidang (getPersil): jalankan auth-ticket + getPersil di dalam
  // tab BHUMI lalu kirim fiturnya kembali. Tanpa login, tab BHUMI membalas 401
  // dan pesannya diteruskan apa adanya ke AuroraMaps.
  if (message?.type === 'identify') {
    if (!appOriginOk(sender.url || '')) {
      sendResponse({ error: 'Permintaan hanya diterima dari AuroraMaps lokal.' }); return;
    }
    const requestId = message.requestId;
    const body = message.body;
    if (typeof requestId !== 'string' ||
        !body || !Number.isFinite(body.latitude) || !Number.isFinite(body.longitude) ||
        !Number.isFinite(body.x) || !Number.isFinite(body.y) || typeof body.bbox !== 'string') {
      sendResponse({ error: 'Parameter koordinat tidak valid.' }); return;
    }
    relayToBhumiTab(sender, sendResponse, requestId, { type: 'identify', body }, 'identify',
      'Waktu tunggu identifikasi di tab BHUMI habis. Pastikan peta BHUMI sudah siap.');
    return true;
  }

  // Pencarian bidang (getBidang/getBidang2): jalur sama dengan identifikasi.
  if (message?.type === 'search') {
    if (!appOriginOk(sender.url || '')) {
      sendResponse({ error: 'Permintaan hanya diterima dari AuroraMaps lokal.' }); return;
    }
    const requestId = message.requestId;
    const path = String(message.path || '');
    const body = message.body;
    if (typeof requestId !== 'string' ||
        (path !== '/expapi/getBidang' && path !== '/expapi/getBidang2') ||
        !body || typeof body !== 'object' || JSON.stringify(body).length > 8000) {
      sendResponse({ error: 'Permintaan pencarian tidak diizinkan.' }); return;
    }
    relayToBhumiTab(sender, sendResponse, requestId, { type: 'search', path, body }, 'search',
      'Waktu tunggu pencarian di tab BHUMI habis. Pastikan peta BHUMI sudah siap.');
    return true;
  }

  // Sinkron token BHUMI (loginApi + reCAPTCHA halaman) — dipicu AuroraMaps
  // saat app login supaya pencarian/identifikasi punya token segar.
  if (message?.type === 'token-sync') {
    if (!appOriginOk(sender.url || '')) {
      sendResponse({ error: 'Permintaan hanya diterima dari AuroraMaps lokal.' }); return;
    }
    const requestId = message.requestId;
    if (typeof requestId !== 'string') {
      sendResponse({ error: 'Parameter sinkron token tidak valid.' }); return;
    }
    findBhumiTab(sender).then((bhumiTab) => {
      if (!bhumiTab) { sendResponse({ error: 'Buka tab bhumi.atrbpn.go.id (peta) di browser ini.' }); return; }
      const old = relayPending.get(requestId);
      if (old) clearTimeout(old.timer);
      const timer = setTimeout(() => {
        const item = relayPending.get(requestId);
        if (!item) return;
        relayPending.delete(requestId);
        chrome.tabs.sendMessage(item.appTabId, { type: 'token-result', requestId,
          status: 'Tab BHUMI tidak merespons (timeout sinkron token).' }).catch(() => {});
      }, RELAY_TIMEOUT_MS);
      relayPending.set(requestId, { appTabId: sender.tab.id, bhumiTabId: bhumiTab.id, timer, kind: 'token' });
      chrome.tabs.sendMessage(bhumiTab.id, { type: 'token-sync', requestId, force: !!message.force }).catch(() => {
        const item = relayPending.get(requestId);
        if (!item) return;
        clearTimeout(item.timer);
        relayPending.delete(requestId);
        chrome.tabs.sendMessage(item.appTabId, { type: 'token-result', requestId,
          status: 'Tab BHUMI tidak merespons; muat ulang peta BHUMI lalu coba lagi.' }).catch(() => {});
      });
      sendResponse({ accepted: true });
    }).catch(() => sendResponse({ error: 'Tidak dapat menghubungi tab BHUMI.' }));
    return true;
  }

  // Relai tile persil (whitelist ketat: 3 rute BIDANG_SOURCES saja, GET saja).
  if (message?.type === 'tile') {
    const appUrl = sender.url || '';
    if (!appOriginOk(appUrl)) {
      sendResponse({ error: 'Permintaan hanya diterima dari AuroraMaps lokal.' }); return;
    }
    const requestId = message.requestId;
    const url = String(message.url || '');
    let parsed = null;
    try { parsed = new URL(url); } catch (_) { /* bukan URL valid */ }
    if (typeof requestId !== 'string' || !parsed || !tileUrlOk(parsed)) {
      sendResponse({ error: 'URL tile tidak diizinkan.' }); return;
    }
    findBhumiTab(sender).then((bhumiTab) => {
      if (!bhumiTab) { sendResponse({ error: 'Buka tab BHUMI (peta) di browser ini.' }); return; }
      const old = tilePending.get(requestId);
      if (old) clearTimeout(old.timer);
      const timer = setTimeout(() => {
        const item = tilePending.get(requestId);
        if (!item) return;
        tilePending.delete(requestId);
        replyTileToApp(item.appTabId, requestId, { url, error: 'Tab BHUMI tidak merespons (timeout tile).' });
      }, TILE_TIMEOUT_MS);
      tilePending.set(requestId, { appTabId: sender.tab.id, bhumiTabId: bhumiTab.id, timer, url });
      chrome.tabs.sendMessage(bhumiTab.id, { type: 'tile', requestId, url }).catch(() => {
        const item = tilePending.get(requestId);
        if (!item) return;
        clearTimeout(item.timer);
        tilePending.delete(requestId);
        replyTileToApp(item.appTabId, requestId, { url, error: 'Tab BHUMI tidak merespons; muat ulang peta BHUMI lalu coba lagi.' });
      });
      sendResponse({ accepted: true });
    }).catch(() => sendResponse({ error: 'Tidak dapat menghubungi tab BHUMI.' }));
    return true;
  }

  if (message?.type === 'bhumi-tile') {
    if (!sender.url?.startsWith('https://bhumi.atrbpn.go.id/')) return;
    const item = tilePending.get(message.requestId);
    if (!item || item.bhumiTabId !== sender.tab?.id) return;
    clearTimeout(item.timer);
    tilePending.delete(message.requestId);
    replyTileToApp(item.appTabId, message.requestId,
      { url: item.url, base64: message.base64, mime: message.mime, error: message.error });
    return;
  }

  if (message?.type === 'bhumi-result') {
    if (!sender.url?.startsWith('https://bhumi.atrbpn.go.id/')) return;
    const features = Array.isArray(message.features) ? message.features.slice(0, 30) : [];
    const item = relayPending.get(message.requestId);
    if (!item || item.bhumiTabId !== sender.tab?.id) return;
    clearTimeout(item.timer);
    relayPending.delete(message.requestId);
    const text = message.error
      ? (item.kind === 'search' ? safeSearchError(message.error) : safeIdentifyError(message.error))
      : undefined;
    replyToApp(item.appTabId, message.requestId, { features, error: text });
  }

  if (message?.type === 'bhumi-token') {
    if (!sender.url?.startsWith('https://bhumi.atrbpn.go.id/')) return;
    const item = relayPending.get(message.requestId);
    if (!item || item.bhumiTabId !== sender.tab?.id) return;
    clearTimeout(item.timer);
    relayPending.delete(message.requestId);
    chrome.tabs.sendMessage(item.appTabId, { type: 'token-result', requestId: message.requestId,
      status: message.status, cached: message.cached }).catch(() => {});
  }
});