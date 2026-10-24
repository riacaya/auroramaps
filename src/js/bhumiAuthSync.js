// =====================================================
// AURORAMAPS — SINKRON TOKEN BHUMI (24 Okt 2026)
// =====================================================
// Situs BHUMI mengelola token di localStorage "tokens" lewat alur yang
// terekam di chunk 8815 (bhumi-js/8815-01efa966110a0d2a.js):
//   POST /expapi/loginApi {recaptchaToken} (reCAPTCHA render-only, action
//   "login") → balasan disimpan apa adanya sebagai token.
// Ruang /expapi tertutup untuk klien lintas-origin (WAF ATR/BPN) — satu-
// satunya jalur yang masih hidup adalah fetch dari DALAM halaman BHUMI yang
// sudah login, yaitu jalur ekstensi AuroraMaps BHUMI Bridge (lihat
// tools/bhumi-bridge/bhumi-main.js → handleTokenSync).
//
// Modul ini hanya pengirim permintaan: dipanggil otomatis saat App.init
// (app login / sesi dibuka ulang) dan saat pencarian kena HTTP 401
// (bhumiIdentify._searchFeatures) supaya token segar tersedia sebelum user
// mencari bidang.
const AuroraBhumiAuth = {
  _inflight: null,
  _lastOk: 0,

  // Kembalikan Promise 'ok' | 'cached' | 'fail' | 'timeout'. Fire-and-forget
  // aman: bila tab BHUMI tidak ada, hanya menulis catatan ke panel log.
  ensure(force) {
    if (!force && this._inflight) return this._inflight;
    if (!force && Date.now() - this._lastOk < 6 * 3600e3) return Promise.resolve('cached');
    this._inflight = this._run(force).finally(() => { this._inflight = null; });
    return this._inflight;
  },

  _run(force) {
    return new Promise((resolve) => {
      const requestId = 'tok-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now());
      const onMsg = (event) => {
        if (event.source !== window || event.origin !== location.origin) return;
        const data = event.data || {};
        if (data.requestId !== requestId || data.type !== 'AURORAMAPS_BHUMI_TOKEN_RESULT') return;
        window.removeEventListener('message', onMsg);
        clearTimeout(timer);
        if (data.status === 'ok') {
          this._lastOk = Date.now();
          if (!data.cached) AppConsole.log('Token BHUMI disegarkan lewat tab BHUMI — pencarian & identifikasi siap.', 'info');
          resolve(data.cached ? 'cached' : 'ok');
        } else {
          AppConsole.log('Sinkron token BHUMI gagal: ' + data.status, 'warn');
          resolve('fail');
        }
      };
      const timer = setTimeout(() => {
        window.removeEventListener('message', onMsg);
        AppConsole.log('Sinkron token BHUMI: tab BHUMI tidak merespons — buka tab bhumi.atrbpn.go.id yang login, lalu coba lagi.', 'warn');
        resolve('timeout');
      }, 15000);
      window.addEventListener('message', onMsg);
      window.postMessage({ type: 'AURORAMAPS_BHUMI_TOKEN_SYNC', requestId, force: !!force }, location.origin);
    });
  }
};
