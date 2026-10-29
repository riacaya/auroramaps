// =====================================================
// bhumi-page.js — konten script ISOLATED di halaman BHUMI
// =====================================================
// Menjembatani chrome.runtime (dari background) ke world MAIN lewat
// window.postMessage (lihat bhumi-main-adapter.js). Juga melayani "ping"
// keepalive: balasan status halaman membuktikan tab masih hidup DAN
// sidecar-inject.js masih terpasang.
const IN = '__amBhumiCall';
const OUT = '__amBhumiReply';

function callMain(path, payload, timeoutMs = 65000) {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener('message', onMsg);
      resolve(v);
    };
    const timer = setTimeout(
      () => finish({ ok: false, error: 'adapter halaman BHUMI tidak merespons' }),
      timeoutMs);
    const onMsg = (e) => {
      if (e.source !== window) return;
      const d = e.data;
      if (!d || d[OUT] !== 1 || d.id !== id) return;
      finish(d);
    };
    window.addEventListener('message', onMsg);
    window.postMessage({ [IN]: 1, id, path, payload }, '*');
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.kind) return;
  if (msg.kind === 'ping') {
    callMain('/status', {}, 9000)
      .then((res) => sendResponse(res && res.ok ? res : null));
    return true;
  }
  if (msg.kind !== 'bhumi-call') return;
  callMain(msg.path, msg.payload || {}).then(sendResponse);
  return true; // balasan async
});
