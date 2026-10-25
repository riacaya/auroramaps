(() => {
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data || {};
    if (typeof data.requestId !== 'string') return;
    if (data.type === 'AURORAMAPS_BHUMI_PAGE_RESULT') {
      chrome.runtime.sendMessage({ type: 'bhumi-result', requestId: data.requestId,
        features: data.features, error: data.error }, () => void chrome.runtime.lastError);
      return;
    }
    if (data.type === 'AURORAMAPS_BHUMI_PAGE_TILE_RESULT') {
      // Bytes tile (base64) diteruskan ke background lalu ke halaman AuroraMaps.
      chrome.runtime.sendMessage({ type: 'bhumi-tile', requestId: data.requestId, url: data.url,
        base64: data.base64, mime: data.mime, error: data.error }, () => void chrome.runtime.lastError);
      return;
    }
    if (data.type === 'AURORAMAPS_BHUMI_PAGE_TOKEN_RESULT') {
      // Hasil sinkron token (loginApi) diteruskan ke background → AuroraMaps.
      chrome.runtime.sendMessage({ type: 'bhumi-token', requestId: data.requestId,
        status: data.status, cached: data.cached }, () => void chrome.runtime.lastError);
    }
  });
  // Permintaan dari background diteruskan ke skrip MAIN world (bhumi-main.js)
  // yang menjalankan fetch di konteks halaman BHUMI.
  chrome.runtime.onMessage.addListener((message) => {
    if (typeof message?.requestId !== 'string') return;
    if (message.type === 'identify') {
      window.postMessage({ type: 'AURORAMAPS_BHUMI_PAGE_IDENTIFY', requestId: message.requestId,
        body: message.body }, location.origin);
      return;
    }
    if (message.type === 'search') {
      window.postMessage({ type: 'AURORAMAPS_BHUMI_PAGE_SEARCH', requestId: message.requestId,
        path: message.path, body: message.body }, location.origin);
      return;
    }
    if (message.type === 'tile') {
      window.postMessage({ type: 'AURORAMAPS_BHUMI_PAGE_TILE', requestId: message.requestId,
        url: message.url }, location.origin);
      return;
    }
    if (message.type === 'token-sync') {
      window.postMessage({ type: 'AURORAMAPS_BHUMI_PAGE_TOKEN_SYNC', requestId: message.requestId,
        force: message.force }, location.origin);
    }
  });
})();