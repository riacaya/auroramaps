(() => {
  const allowed = new Set(['http://127.0.0.1:8321', 'http://localhost:8321', 'https://riacaya.github.io']);
  if (!allowed.has(location.origin)) return;
  const SEARCH_PATHS = new Set(['/expapi/getBidang', '/expapi/getBidang2']);
  // Relai tile Bidang Tanah (24 Okt 2026): hanya tiga endpoint WMS persil
  // yang diteruskan; tujuannya menampilkan layer tile, bukan proxy umum.
  const BHUMI_ORIGIN = 'https://bhumi.atrbpn.go.id';
  const GISTARU_ORIGIN = 'https://gistaru-app.atrbpn.go.id';
  const TILE_PATHS = new Set(['/mprx/service', '/expapi/bhumigeos/umum/wms', '/expapi/bhumigs/umum/wms', '/expapi/umum/wms']);
  const allowedTileUrl = (value) => {
    try {
      const u = new URL(value);
      if (u.origin === BHUMI_ORIGIN) return TILE_PATHS.has(u.pathname);
      // RTRW Provinsi: WMS gistaru hanya menerima Referer bhumi → dilewatkan
      // lewat tab BHUMI (host cloud tidak terjangkau, lihat endpoint.md).
      return u.origin === GISTARU_ORIGIN && u.pathname.startsWith('/interoppublic/api/wms/');
    } catch (_) { return false; }
  };
  const postTileResult = (requestId, payload) => {
    window.postMessage({ type: 'AURORAMAPS_BHUMI_TILE_RESULT', requestId, ...payload }, location.origin);
  };
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data || {};
    if (data.type === 'AURORAMAPS_BHUMI_TILE') {
      if (typeof data.requestId !== 'string') return;
      const url = typeof data.url === 'string' ? data.url : '';
      // URL di luar whitelist TIDAK di-ACK → app langsung jatuh ke jalur biasa.
      if (!allowedTileUrl(url)) return;
      window.postMessage({ type: 'AURORAMAPS_BHUMI_TILE_ACK', requestId: data.requestId }, location.origin);
      chrome.runtime.sendMessage({ type: 'tile', requestId: data.requestId, url }, (response) => {
        if (chrome.runtime.lastError) {
          postTileResult(data.requestId, { url, error: 'Ekstensi gagal menghubungi tab BHUMI.' });
          return;
        }
        if (response && !response.accepted && response.error) postTileResult(data.requestId, { url, error: response.error });
      });
      return;
    }
    if (data.type === 'AURORAMAPS_BHUMI_TOKEN_SYNC') {
      if (typeof data.requestId !== 'string') return;
      chrome.runtime.sendMessage({ type: 'token-sync', requestId: data.requestId, force: !!data.force }, (response) => {
        if (chrome.runtime.lastError) {
          window.postMessage({ type: 'AURORAMAPS_BHUMI_TOKEN_RESULT', requestId: data.requestId,
            status: 'Ekstensi gagal menghubungi background.' }, location.origin);
          return;
        }
        if (response && !response.accepted && response.error) {
          window.postMessage({ type: 'AURORAMAPS_BHUMI_TOKEN_RESULT', requestId: data.requestId,
            status: response.error }, location.origin);
        }
      });
      return;
    }
    const isIdentify = data.type === 'AURORAMAPS_BHUMI_IDENTIFY';
    const isSearch = data.type === 'AURORAMAPS_BHUMI_SEARCH';
    if (!isIdentify && !isSearch) return;
    if (typeof data.requestId !== 'string') return;
    const body = data.body;
    if (isIdentify) {
      if (!body || JSON.stringify(body).length > 12000 ||
          !Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)) return;
    } else {
      // Pencarian: hanya endpoint getBidang/getBidang2 yang diteruskan.
      if (!SEARCH_PATHS.has(data.path) || !body || typeof body !== 'object' ||
        JSON.stringify(body).length > 8000) return;
    }
    window.postMessage({ type: 'AURORAMAPS_BHUMI_BRIDGE_ACK', requestId: data.requestId }, location.origin);
    const request = isIdentify
      ? { type: 'identify', requestId: data.requestId, body }
      : { type: 'search', requestId: data.requestId, path: data.path, body };
    chrome.runtime.sendMessage(request, (response) => {
      if (chrome.runtime.lastError) {
        window.postMessage({ type: 'AURORAMAPS_BHUMI_BRIDGE_RESULT', requestId: data.requestId,
          error: 'Ekstensi gagal menghubungi tab BHUMI.' }, location.origin);
        return;
      }
      if (response?.error) window.postMessage({ type: 'AURORAMAPS_BHUMI_BRIDGE_RESULT',
        requestId: data.requestId, error: response.error }, location.origin);
    });
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'tile-result' && typeof message.requestId === 'string') {
      postTileResult(message.requestId, { url: message.url, base64: message.base64,
        mime: message.mime, error: message.error });
      return;
    }
    if (message?.type === 'token-result' && typeof message.requestId === 'string') {
      window.postMessage({ type: 'AURORAMAPS_BHUMI_TOKEN_RESULT', requestId: message.requestId,
        status: message.status, cached: message.cached }, location.origin);
      return;
    }
    if (message?.type !== 'result' || typeof message.requestId !== 'string') return;
    window.postMessage({ type: 'AURORAMAPS_BHUMI_BRIDGE_RESULT', requestId: message.requestId,
      features: message.features, error: message.error }, location.origin);
  });
})();
