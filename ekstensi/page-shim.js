// =====================================================
// page-shim.js — berjalan di WORLD MAIN halaman AuroraMaps
// (github.io / blogspot) pada document_start
// =====================================================
// Menambal window.AuroraBhumiSidecarClient sehingga seluruh fitur app
// (identify, search, tile, gfi, analisa, token-sync, status) dialihkan ke
// ekstensi ini, MENGGINAKAN ANTARMUKA PERSIS seperti sidecar PC:
//   - _post(path, payload, timeoutMs) → {…} | lempar Error(sama seperti 502)
//   - _probe() → true/false → state()/availableSync()/ready() tetap berlaku
// Karena hanya objek itu yang di-patch, src/ TIDAK berubah sama sekali —
// windows-app, APK, dan versi tanpa ekstensi tetap berjalan seperti sediakala.
(() => {
  // Penanda "ekstensi aktif" untuk halaman — dibaca app.js (initTombolEkstensi)
  // untuk menyembunyikan tombol "Pasang ekstensi" di header bila semuanya sehat,
  // dan menampilkannya kembali bila ekstensi tidak ada/rusak.
  window.__AuroraMapsEkstensi = { pasang: true, versi: '1.1.0' };

  const IN = '__amAppCall';
  const OUT = '__amAppReply';
  let seq = 0;
  const pending = new Map();

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d[OUT] !== 1 || typeof d.id !== 'string') return;
    const p = pending.get(d.id);
    if (!p) return;
    pending.delete(d.id);
    clearTimeout(p.timer);
    p.resolve(d);
  });

  // Panggil lewat bridge; timeout → err.__bridge (artinya: ekstensi tak ada).
  function call(path, payload, timeoutMs) {
    return new Promise((resolve, reject) => {
      const id = (++seq) + '-' + Date.now().toString(36);
      const timer = setTimeout(() => {
        pending.delete(id);
        const err = new Error('bridge tidak merespons');
        err.__bridge = true;
        reject(err);
      }, timeoutMs || 45000);
      pending.set(id, {
        timer,
        resolve: (d) => {
          if (d.ok) { resolve(d.data); return; }
          const err = new Error(d.error || 'galat bridge');
          if (d.bridge) err.__bridge = true;
          reject(err);
        }
      });
      window.postMessage({ [IN]: 1, id, path, payload: payload || {} }, '*');
    });
  }

  const PESAN_TANPA_EKSTENSI =
    'Sidecar BHUMI tidak aktif di ekstensi — aktifkan "AuroraMaps BHUMI Bridge" ' +
    'di chrome://extensions lalu muat ulang halaman ini.';

  function patch() {
    const sc = window.AuroraBhumiSidecarClient;
    if (!sc) return false;
    if (sc.__amExtPatched) return true;
    if (typeof sc._post !== 'function' || typeof sc._probe !== 'function') return false;
    sc.__amExtPatched = true;

    // ── _post: ganti fetch loopback dengan jembatan ekstensi ─────────────
    sc._post = function (path, payload, timeoutMs) {
      const self = this;
      return call(path, payload, timeoutMs).catch((e) => {
        if (e && e.__bridge) {
          // Ekstensi tidak ada/pasif → tiru perilaku fetch gagal pada klien
          // asli: matikan mode sidecar + pesan yang bisa ditindaklanjuti.
          self._set(false);
          throw new Error(PESAN_TANPA_EKSTENSI);
        }
        // Galat dari sisi sidecar (setara HTTP 502 pada jalur PC): teruskan
        // apa adanya TANPA mematikan mode sidecar — sama seperti klien asli.
        throw e;
      });
    };

    // ── _probe: ganti fetch /status dengan bridge ────────────────────────
    sc._probe = function () {
      const self = this;
      if (self._probeP) return self._probeP;
      if (Date.now() - self._checkedAt < 2000) return Promise.resolve(self._ok === true);
      self._checkedAt = Date.now();
      self._probeP = (async () => {
        try {
          const data = await call('/status', {}, 6000);
          self._set(!!(data && data.sidecar));
        } catch (e) {
          self._set(false);
        } finally {
          self._probeP = null;
        }
        return self._ok === true;
      })();
      return self._probeP;
    };

    // Probe segera: patch terpasang SETELAH objek dibuat, jadi probe pertama
    // (yang menembus loopback) kemungkinan sudah gagal — ulangi sekarang.
    if (sc.state && sc.state() === null) {
      Promise.resolve().then(() => sc._probe()).catch(() => {});
    }
    return true;
  }

  // Objek dibuat saat bhumiSidecar.js dimuat (setelah document_start) →
  // tunggu dengan polling; 600 × 100 ms = 60 detik cukup untuk halaman berat.
  patch();
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (patch() || tries >= 600) clearInterval(timer);
  }, 100);
})();
