// =====================================================
// AURORAMAPS — SINKRON TOKEN BHUMI (24 Okt 2026)
// =====================================================
// Situs BHUMI mengelola token di localStorage "tokens" lewat alur yang
// terekam di chunk 8815 (halaman BHUMI): POST /expapi/loginApi
// {recaptchaToken} (reCAPTCHA, action "login") → balasan disimpan apa
// adanya sebagai token. Ruang /expapi tertutup untuk klien lintas-origin
// (WAF ATR/BPN) — satu-satunya jalur yang masih hidup adalah fetch dari
// DALAM halaman BHUMI yang sudah login, yaitu sidecar lokal
// (tools/bhumi-bridge, lihat sidecar-inject.js → tokenSync).
//
// Modul ini hanya pengirim permintaan: dipanggil otomatis saat App.init
// (app login / sesi dibuka ulang) dan saat pencarian kena HTTP 401
// (bhumiIdentify._searchFeatures) supaya token segar tersedia sebelum user
// mencari bidang. Sidecar sendiri juga menjaga kesegaran token di dalam
// halaman (auto-refresh + auto-klik "Saya Setuju"), jadi modul ini pelengkap.
// Jalur pesan ekstensi AuroraMaps Bridge dihapus 26 Okt 2026.
const AuroraBhumiAuth = {
  _inflight: null,
  _lastOk: 0,

  // Kembalikan Promise 'ok' | 'cached' | 'fail' | 'timeout'. Fire-and-forget
  // aman: bila sidecar tidak ada, hanya menulis catatan ke panel log.
  ensure(force) {
    if (!force && this._inflight) return this._inflight;
    if (!force && Date.now() - this._lastOk < 6 * 3600e3) return Promise.resolve('cached');
    // Probe sidecar pertama (dijalankan saat DOM siap) belum tentu selesai
    // saat App.init memanggil ensure() → tunggu maks 3 dtk supaya keputusan
    // "sidecar ada / tidak" tidak salah dan memicu peringatan yang keliru.
    const sc = window.AuroraBhumiSidecarClient;
    const ready = (sc && sc.state() === null) ? sc.ready(3000) : Promise.resolve(true);
    this._inflight = ready.then(() => this._run(force)).finally(() => { this._inflight = null; });
    return this._inflight;
  },

  _run(force) {
    // Satu-satunya jalur: sidecar lokal (tools/bhumi-bridge) — loginApi +
    // reCAPTCHA dijalankan dari dalam tab BHUMI pendamping lewat CDP.
    const sc = window.AuroraBhumiSidecarClient;
    if (!(sc && sc.availableSync())) {
      AppConsole.log('Sinkron token: sidecar BHUMI tidak terjangkau — jalankan jalankan-auroramaps.bat (atau jalankan-sidecar.bat).', 'warn');
      return Promise.resolve('timeout');
    }
    return sc.tokenSync(force).then((r) => {
      if (r && r.status === 'ok') {
        this._lastOk = Date.now();
        if (r.cached) return 'cached';
        AppConsole.log('Token BHUMI disegarkan lewat sidecar lokal — pencarian & identifikasi siap.', 'info');
        return 'ok';
      }
      AppConsole.log('Sinkron token via sidecar gagal: ' + ((r && r.status) || 'tanpa balasan'), 'warn');
      return 'fail';
    }).catch(() => {
      AppConsole.log('Sinkron token via sidecar tidak terjangkau — jalankan jalankan-auroramaps.bat.', 'warn');
      return 'timeout';
    });
  }
};
// const top-level skrip klasik TIDAK menjadi properti window — ekspos
// eksplisit supaya app.js / bhumiIdentify.js bisa memakai window.AuroraBhumiAuth.
window.AuroraBhumiAuth = AuroraBhumiAuth;