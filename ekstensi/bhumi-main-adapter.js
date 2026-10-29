// =====================================================
// bhumi-main-adapter.js — berjalan di WORLD MAIN halaman BHUMI
// =====================================================
// sidecar-inject.js mengekspos window.AuroraBhumiSidecar (harus di MAIN world
// agar sama persis dengan perilaku sidecar PC: hook window.fetch, akses
// localStorage 'tokens', grecaptcha, klik "Saya Setuju" — semuanya tidak
// terlihat dari isolated world). Konten script isolated (bhumi-page.js) tidak
// bisa memanggil fungsi MAIN world secara langsung, jadi jembatannya
// window.postMessage dua arah dengan korelasi id.
(() => {
  const IN = '__amBhumiCall';
  const OUT = '__amBhumiReply';
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d[IN] !== 1 || typeof d.id !== 'string') return;
    const reply = (obj) => window.postMessage(Object.assign({ [OUT]: 1, id: d.id }, obj), '*');
    const api = window.AuroraBhumiSidecar;
    if (!api) { reply({ ok: false, error: 'skrip sidecar belum aktif di halaman BHUMI' }); return; }
    const p = d.payload || {};
    const MAP = {
      '/status': () => api.status(),
      '/search': () => api.search({ path: p.path, body: p.body }),
      '/identify': () => api.identify({ body: p.body }),
      '/tile': () => api.tile({ url: p.url }),
      '/gfi': () => api.gfi({ url: p.url }),
      '/analisa': () => api.analisa({ body: p.body }),
      '/token-sync': () => api.tokenSync({ force: !!p.force })
    };
    const fn = MAP[d.path];
    if (!fn) { reply({ ok: false, error: 'Rute tidak dikenal: ' + d.path }); return; }
    Promise.resolve()
      .then(fn)
      .then((data) => reply({ ok: true, data: data }))
      .catch((err) => reply({ ok: false, error: String((err && err.message) || err) }));
  });
})();
