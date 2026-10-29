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
  window.__AuroraMapsEkstensi = { pasang: true, versi: '1.2.0' };

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

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── Pemulihan otomatis ─────────────────────────────────────────────────
  // Masalah lama: begitu SATU panggilan bridge gagal, sidecar ditandai mati
  // dan TIDAK PERNAH pulih sampai user memuat ulang halaman GitHub (keluhan
  // "harus refresh github"). Kini kegagalan menjadwalkan probe ulang tiap
  // 5 dtk (maks 5 menit) sehingga halaman sembuh sendiri tanpa refresh.
  let recTimer = null;
  function scheduleRecovery() {
    if (recTimer) return;
    let n = 0;
    recTimer = setInterval(() => {
      n++;
      const self = window.AuroraBhumiSidecarClient;
      if (!self || !self.__amExtPatched || n > 60) {
        clearInterval(recTimer); recTimer = null; return;
      }
      Promise.resolve(self._probe())
        .then((ok) => { if (ok) { clearInterval(recTimer); recTimer = null; } })
        .catch(() => { /* coba lagi pada interval berikutnya */ });
    }, 5000);
  }

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
          // Bridge gagal → matikan mode sidecar sementara, jadwalkan
          // pemulihan otomatis, lalu COBA ULANG sekali setelah jeda pendek.
          // Penyebab tersering: tab BHUMI sedang dimuat ulang oleh keepalive
          // sehingga balasan terlambat — dengan retry ini user tidak perlu
          // memuat ulang halaman GitHub hanya karena satu panggilan gagal.
          self._set(false);
          scheduleRecovery();
          return sleep(4000)
            .then(() => call(path, payload, timeoutMs))
            .then((v) => { self._set(true); return v; })
            .catch((e2) => {
              scheduleRecovery();
              throw (e2 && e2.__bridge) ? new Error(PESAN_TANPA_EKSTENSI) : e2;
            });
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
          if (!(data && data.sidecar)) scheduleRecovery();
        } catch (e) {
          self._set(false);
          scheduleRecovery();
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
