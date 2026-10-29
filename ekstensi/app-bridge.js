// =====================================================
// app-bridge.js — konten script ISOLATED di halaman AuroraMaps
// =====================================================
// Menjembatani page-shim.js (MAIN world) ke background service worker lewat
// window.postMessage → chrome.runtime. Balasan selalu berbentuk
// {ok:true, data} atau {ok:false, error[, bridge:true]} — bridge:true menandai
// bahwa runtime ekstensi sendiri tidak tersedia (mis. ekstensi dimatikan).
(() => {
  const IN = '__amAppCall';
  const OUT = '__amAppReply';

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d[IN] !== 1 || typeof d.id !== 'string') return;
    let answered = false;
    const reply = (obj) => {
      if (answered) return;
      answered = true;
      window.postMessage(Object.assign({ [OUT]: 1, id: d.id }, obj), '*');
    };
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      reply({ ok: false, bridge: true, error: 'runtime ekstensi tidak tersedia' });
      return;
    }
    try {
      chrome.runtime.sendMessage(
        { kind: 'am-call', path: d.path, payload: d.payload || {} },
        (res) => {
          const err = chrome.runtime.lastError;
          if (err || !res) {
            reply({ ok: false, bridge: true, error: err ? err.message : 'background tidak menjawab' });
          } else if (res.ok) {
            reply({ ok: true, data: res.data });
          } else {
            reply({ ok: false, error: res.error || 'galat sidecar' });
          }
        });
    } catch (e) {
      reply({ ok: false, bridge: true, error: String((e && e.message) || e) });
    }
  });
})();
