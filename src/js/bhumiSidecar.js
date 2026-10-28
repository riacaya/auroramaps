// =====================================================
// AURORAMAPS — klien Sidecar BHUMI lokal (25 Okt 2026)
// =====================================================
// Relai AuroraMaps BHUMI untuk MODE LOKAL PC (pengganti ekstensi lama — jalur ekstensi dihapus 26 Okt 2026).
// Host Node (tools/bhumi-bridge/sidecar-host.mjs) menjalankan jendela Chrome
// pendamping yang membuka https://bhumi.atrbpn.go.id/peta dan menyisipkan
// sidecar-inject.js ke dalam konteks halaman lewat CDP, lalu menyajikan API
// loopback di http://127.0.0.1:8322. Modul ini mendeteksi sidecar itu dan
// dipakai atrbpnLayers.js (tile), bhumiIdentify.js (identify/search), serta
// bhumiAuthSync.js (sinkron token) sebagai jalur PRIORITAS — bila sidecar
// tidak ada, ketiganya jatuh kembali ke jalur proxy lama tanpa
// perubahan perilaku.
//
// Kenapa loopback: CORS server hanya mengabulkan origin localhost/127.0.0.1,
// jadi dari https://riacaya.github.io deteksi otomatis gagal → mode hosting
// tetap memakai jalur proxy cloud (tanpa sidecar lokal).
const AuroraBhumiSidecarClient = {
  BASE: 'http://127.0.0.1:8322',
  _ok: null,          // null = belum dicek, true = sidecar hidup, false = tidak ada
  _probeP: null,      // promise probe yang sedang berjalan
  _checkedAt: 0,
  _logging: false,
  _started: false,

  // Dipakai secara sinkron dari jalur relai/bridge: hanya membaca cache
  // hasil probe (probe berjalan di latar belakang tiap 5 dtk selama belum ada).
  availableSync() {
    return this._ok === true;
  },

  // null = belum ada hasil probe, true/false = hasil probe terakhir.
  state() {
    return this._ok;
  },

  // Tunggu hasil probe pertama (maks maxWaitMs) → true/false. Dipakai jalur
  // yang hanya punya satu kesempatan memilih (token saat App.init, klik
  // identifikasi) supaya tidak jatuh ke jalur proxy hanya karena probe
  // belum selesai berjalan.
  ready(maxWaitMs = 3000) {
    if (this._ok !== null) return Promise.resolve(this._ok === true);
    return Promise.race([
      this._probe(),
      new Promise(r => setTimeout(() => r(this._ok === true), maxWaitMs))
    ]);
  },

  start() {
    if (this._started) return;
    this._started = true;
    const loop = async () => {
      await this._probe();
      const delay = this._ok === true ? 30000 : 5000;
      setTimeout(loop, delay);
    };
    loop();
  },

  async _probe() {
    if (this._probeP) return this._probeP; // probe lain sedang berjalan
    if (Date.now() - this._checkedAt < 2000) return this._ok === true;
    this._checkedAt = Date.now();
    this._probeP = (async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2500);
        const res = await fetch(this.BASE + '/status', { cache: 'no-store', signal: ctrl.signal });
        clearTimeout(t);
        const data = await res.json();
        this._set(!!(res.ok && data && data.sidecar));
      } catch (e) {
        this._set(false);
      } finally {
        this._probeP = null;
      }
      return this._ok === true;
    })();
    return this._probeP;
  },

  _set(value) {
    if (this._ok === value) return;
    this._ok = value;
    if (value && !this._logging) {
      this._logging = true;
      // AppConsole adalah const top-level di feedback.js — tidak menempel di
      // window, jadi diperiksa dengan typeof sebelum dipanggil.
      if (typeof AppConsole !== 'undefined') {
        AppConsole.log('Sidecar BHUMI lokal aktif (127.0.0.1:8322) — tile, klik & cari bidang siap.', 'info');
      }
    }
  },

  // Semua endpoint memakai POST JSON + timeout sendiri; galat server diteruskan
  // apa adanya (mis. "HTTP 401" agar bhumiIdentify memicu sinkron token).
  async _post(path, payload, timeoutMs) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(this.BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
        signal: ctrl.signal
      });
    } catch (e) {
      clearTimeout(t);
      this._set(false);
      throw new Error('Sidecar BHUMI tidak terjangkau — jalankan tools/bhumi-bridge/jalankan-sidecar.bat lalu buka tab BHUMI di jendela Chrome pendamping.');
    }
    clearTimeout(t);
    let data = null;
    try { data = await res.json(); } catch (e) { /* balasan bukan JSON */ }
    if (!res.ok) throw new Error((data && data.error) || ('Sidecar HTTP ' + res.status));
    return data || {};
  },

  // → {base64, mime}
  tile(url) {
    return this._post('/tile', { url }, 30000);
  },
  // → {text} — GetFeatureInfo zona RTRW, dijalankan di halaman BHUMI pendamping
  // (Referer asli) sehingga lolos WAF yang menolak fetch dari halaman app.
  gfi(url) {
    return this._post('/gfi', { url }, 30000);
  },
  // → {features:[...]}
  search(path, body) {
    return this._post('/search', { path, body }, 40000);
  },
  // → {features:[...]}
  identify(body) {
    return this._post('/identify', { body }, 55000);
  },
  // → {status:'ok'|pesan, cached}
  tokenSync(force) {
    return this._post('/token-sync', { force: !!force }, 35000);
  },
  // → {sidecar, loggedIn, url}
  status() {
    return this._post('/status', {}, 8000);
  }
};

window.AuroraBhumiSidecarClient = AuroraBhumiSidecarClient;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AuroraBhumiSidecarClient.start(), { once: true });
} else {
  AuroraBhumiSidecarClient.start();
}