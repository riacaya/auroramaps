// =====================================================
// AuroraMaps · bhumiIdentify.js — Identifikasi bidang tanah via bhumi API
// Klik pada layer Bidang Tanah → tampilkan NIB, luas, gambar bidang + titik sudut
// MD5 + AES decryption ported from analisa/nib/nib.html
// =====================================================
'use strict';

const BhumiIdentify = {
  _token: null,
  _tokenExp: 0,
  _proxyBase: '',
  _desaBaruP: null,        // memo assets/desanew.js (hasil download)
  _hlLayers: null,
  _searchLayer: null,

  init() {
    this._proxyBase = this._resolveProxy();
    MapManager.map.on('click', (e) => this._onMapClick(e));
  },

  // ── Proxy resolution ──
  _resolveProxy() {
    try {
      const q = new URLSearchParams(location.search).get('bhumiWorker');
      if (q) return q.replace(/\/+$/, '');
      // Saat berjalan di PC melalui local-server.mjs, gunakan relay lokal
      // yang juga dipakai layer ATR/BPN. Jangan biarkan URL Worker global
      // pada config.js mengambil alih request identifikasi bidang tanah.
      const lokal = location.protocol === 'http:' &&
        (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
      if (lokal) return '/bhumi-proxy';
      if (window.BHUMI_WORKER_URL) return String(window.BHUMI_WORKER_URL).replace(/\/+$/, '');
      const ls = localStorage.getItem('bhumiWorkerUrl');
      if (ls) return ls.replace(/\/+$/, '');
    } catch (e) { /* ignore */ }
    return 'https://orange-smoke-f6f5.riacaya99.workers.dev';
  },

  // ── Token Management ──
  async _ensureToken() {
    if (this._token && Date.now() < this._tokenExp) return this._token;
    // loginApi BHUMI sekarang mensyaratkan token reCAPTCHA v3 yang hanya
    // dapat diterbitkan pada domain yang diizinkan pemilik site key. Uji dari
    // AuroraMaps localhost ditolak Google; kredensial contoh sebelumnya juga
    // selalu gagal verifikasi CAPTCHA. Jangan kirim request palsu atau membuat
    // token sendiri karena hanya ATR/BPN yang dapat mengizinkan domain ini.
    throw new Error('Login pencarian bidang BHUMI memerlukan reCAPTCHA dari domain yang diizinkan ATR/BPN. Domain AuroraMaps ini belum diizinkan; minta ATR/BPN menambahkan domain app atau menyediakan endpoint autentikasi resmi.');
  },

  // ── MD5 (exact copy from nib.html) ──
  _md5Bytes(bytes) {
    function safeAdd(x, y) { const l = (x & 0xffff) + (y & 0xffff); const m = (x >> 16) + (y >> 16) + (l >> 16); return (m << 16) | (l & 0xffff); }
    function rotl(x, c) { return (x << c) | (x >>> (32 - c)); }
    const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22, 5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20, 4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23, 6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
    const K = [0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391];
    const F = [(b,c,d)=>(b&c)|(~b&d), (b,c,d)=>(b&d)|(c&~d), (b,c,d)=>b^c^d, (b,c,d)=>c^(b|~d)];
    const G = [(i)=>i, (i)=>(5*i+1)%16, (i)=>(3*i+5)%16, (i)=>(7*i)%16];
    const x = [];
    for (let i = 0; i + 3 < bytes.length; i += 4) x[i >> 2] = bytes[i] | (bytes[i+1] << 8) | (bytes[i+2] << 16) | (bytes[i+3] << 24);
    if (bytes.length % 4) {
      let w = 0;
      for (let i = bytes.length - (bytes.length % 4); i < bytes.length; i++) w |= bytes[i] << ((i % 4) * 8);
      x[bytes.length >> 2] = w;
    }
    const len = bytes.length * 8;
    x[len >> 5] |= 0x80 << (len % 32);
    x[(((len + 64) >>> 9) << 4) + 14] = len;
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (let i = 0; i < x.length; i += 16) {
      let A = a0, B = b0, C = c0, D = d0;
      for (let j = 0; j < 64; j++) {
        const round = j >> 4;
        const Fv = F[round](B, C, D);
        const g = i + G[round](j);
        const tmp = D;
        D = C; C = B;
        B = safeAdd(B, rotl(safeAdd(safeAdd(A, Fv), safeAdd(x[g], K[j])), S[j]));
        A = tmp;
      }
      a0 = safeAdd(a0, A); b0 = safeAdd(b0, B); c0 = safeAdd(c0, C); d0 = safeAdd(d0, D);
    }
    const out = new Uint8Array(16);
    const ws = [a0, b0, c0, d0];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) out[i * 4 + j] = (ws[i] >>> (j * 8)) & 0xff;
    return out;
  },

  _concatBytes(...arrs) {
    let n = 0; for (const a of arrs) n += a.length;
    const out = new Uint8Array(n);
    let p = 0; for (const a of arrs) { out.set(a, p); p += a.length; }
    return out;
  },

  _base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },

  async _decryptBhumi(encB64, passphrase = '') {
    const PASS = passphrase || 's3CRetCR1pT0';
    const full = this._base64ToBytes(encB64);
    if (full.length < 16) throw new Error('data terlalu pendek');
    const salt = full.slice(8, 16);
    const ct = full.slice(16);
    const pass = new TextEncoder().encode(PASS);
    let derived = new Uint8Array(0);
    let prev = new Uint8Array(0);
    while (derived.length < 48) {
      prev = this._md5Bytes(this._concatBytes(prev, pass, salt));
      derived = this._concatBytes(derived, prev);
    }
    const key = derived.slice(0, 32), iv = derived.slice(32, 48);
    const keyObj = await crypto.subtle.importKey('raw', key, { name: 'AES-CBC' }, false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, keyObj, ct);
    return new TextDecoder().decode(pt);
  },

  // ── API Call ──
  async _newIdentifySession() {
    const [keyPair, ticketRes] = await Promise.all([
      crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']),
      fetch(this._proxyBase + '/expapi/auth-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    ]);
    if (!ticketRes.ok) throw new Error('BHUMI auth-ticket: HTTP ' + ticketRes.status);
    const ticket = await ticketRes.json();
    if (!ticket?.ticketId || !ticket?.challengeSeed) throw new Error('BHUMI auth-ticket tidak lengkap');
    const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
    const clientPubKey = Array.from(publicKey, b => b.toString(16).padStart(2, '0')).join('');
    return { keyPair, ticketId: ticket.ticketId, challengeSeed: ticket.challengeSeed, clientPubKey };
  },

  async _ecdhPassphrase(serverPubKey, privateKey, challengeSeed) {
    const bytes = new Uint8Array((serverPubKey.match(/.{2}/g) || []).map(x => parseInt(x, 16)));
    const publicKey = await crypto.subtle.importKey('raw', bytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256));
    const sharedHex = Array.from(secret, b => b.toString(16).padStart(2, '0')).join('');
    const material = new TextEncoder().encode(`${sharedHex}:${challengeSeed}`);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', material));
    return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
  },

  async _gfiFeatures(body) {
    // Alur terbaru BHUMI (bidtan.har): auth-ticket + ECDH P-256 untuk setiap
    // getPersil. Header challenge diteruskan melalui proxy; respons dienkripsi
    // dengan kunci turunan ECDH dan challengeSeed.
    const session = await this._newIdentifySession();
    const res = await fetch(this._proxyBase + '/expapi/getPersil', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Pubkey': session.clientPubKey,
        'X-Ticket-Id': session.ticketId,
        'X-Timestamp': String(Date.now())
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    let fc;
    if (data && data.encrypted && data.data) {
      const passphrase = data.ecdh && data.serverPubKey
        ? await this._ecdhPassphrase(data.serverPubKey, session.keyPair.privateKey, session.challengeSeed)
        : '';
      fc = JSON.parse(await this._decryptBhumi(data.data, passphrase));
    } else {
      fc = data;
    }
    const features = (fc && fc.features) || [];
    // Respons getPersil (rekaman situs 5 Okt 2026, bidang.har): geometry null,
    // poligon justru ada di field "bbox" (berbentuk GeoJSON geometry, bukan
    // array bbox standar). Salin ke geometry supaya L.geoJSON (hit-layer &
    // fitBounds) dan popup tetap berfungsi; bbox array standar diabaikan.
    return features.map(f => {
      if ((!f.geometry || !f.geometry.coordinates) && f.bbox && f.bbox.coordinates) {
        f = Object.assign({}, f, { geometry: f.bbox });
      }
      return f;
    });
  },

  // Search a Bhumi parcel by village and the last five certificate digits.
  async searchCertificate(desaId, nomor, tipehak = '') {
    this._ensureBidangVisible();
    if (!desaId) throw new Error('Pilih kabupaten dulu');
    const value = String(nomor || '').replace(/\D/g, '');
    if (!/^\d{5}$/.test(value)) throw new Error('Nomor hak harus 5 digit');
    await this._ensureToken();
    const res = await fetch(this._proxyBase + '/expapi/getBidang', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: this._token },
      body: JSON.stringify({ desaId, nomor: value, search: 'nomorhak', tipehak })
    });
    if (!res.ok) throw new Error('Pencarian SHM gagal: HTTP ' + res.status);
    const data = await res.json();
    // Balasan 'tidak ditemukan' = [{type:'FeatureCollection', features:null}]
    // — jangan biarkan wrapper null ikut masuk (L.geoJSON crash di .length).
    const features = Array.isArray(data) ? data.flatMap(x => (x == null ? [] : (Array.isArray(x.features) ? x.features : (x.type === 'FeatureCollection' ? [] : x)))) : (data?.features || []);
    if (!features.length) return [];
    const first = features.find(f => f?.geometry) || features[0];
    const c = first.geometry?.coordinates?.[0]?.[0];
    if (Array.isArray(c) && c.length >= 2) {
      const [lng, lat] = c;
      if (this._searchLayer) { this._searchLayer.remove(); this._searchLayer = null; }
      const bounds = L.geoJSON(first).getBounds();
      const center = bounds.getCenter();
      if (tipehak === 'hgu_hpl') MapManager.map.setView(center, Math.max(MapManager.map.getZoom(), 17));
      else MapManager.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 20 });
      await this.identify(center.lat, center.lng);
    }
    return features;
  },

  async searchNib(desaId, nomor, tipehak = '') {
    this._ensureBidangVisible();
    if (!desaId) throw new Error('Pilih kabupaten dulu');
    const value = String(nomor || '').replace(/\D/g, '');
    if (!/^\d{5}$/.test(value)) throw new Error('NIB harus 5 digit');
    await this._ensureToken();
    const res = await fetch(this._proxyBase + '/expapi/getBidang', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: this._token },
      body: JSON.stringify({ desaId, nomor: value, search: 'nib', tipehak })
    });
    if (!res.ok) throw new Error('Pencarian NIB gagal: HTTP ' + res.status);
    const data = await res.json();
    const features = Array.isArray(data) ? data.flatMap(x => (x == null ? [] : (Array.isArray(x.features) ? x.features : (x.type === 'FeatureCollection' ? [] : x)))) : (data?.features || []);
    if (!features.length) return [];
    const bounds = L.geoJSON(features[0]).getBounds();
    const center = bounds.getCenter();
    if (tipehak === 'hgu_hpl') MapManager.map.setView(center, Math.max(MapManager.map.getZoom(), 17));
      else MapManager.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 20 });
      await this.identify(center.lat, center.lng);
      return features;
  },

  async searchNibel(nibel) {
    this._ensureBidangVisible();
    const value = String(nibel || '').trim();
    if (!value) throw new Error('NIBEL wajib diisi');
    await this._ensureToken();
    const res = await fetch(this._proxyBase + '/expapi/getBidang2', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: this._token },
      body: JSON.stringify({ nibel: value })
    });
    if (!res.ok) throw new Error('Pencarian NIBEL gagal: HTTP ' + res.status);
    const data = await res.json();
    const features = Array.isArray(data) ? data.flatMap(x => (x == null ? [] : (Array.isArray(x.features) ? x.features : (x.type === 'FeatureCollection' ? [] : x)))) : (data?.features || []);
    if (!features.length) return [];
    const bounds = L.geoJSON(features[0]).getBounds();
    MapManager.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 20 });
    const center = bounds.getCenter();
    await this.identify(center.lat, center.lng);
    return features;
  },

  async _admin(path) {
    // Timeout 4 dtk: /api/kabkot & /api/desa sering 500 atau MENGGANTUNG
    // lewat proxy (terbukti 5 Okt 2026) — jangan menahan dropdown menunggu
    // respons yang tidak pernah datang. Array kosong = gagal → lanjut fallback.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch(this._proxyBase + path, { signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (!Array.isArray(json) || !json.length) throw new Error('data kosong');
      return json;
    } finally { clearTimeout(timer); }
  },

  // Snapshot wilayah lokal dimuat sebagai JavaScript agar aman untuk file://
  // di browser biasa maupun Android WebView. Kunci AURORA_DATA tetap memakai
  // nama JSON lama supaya struktur datanya tidak perlu berubah.
  async _snapshot(path) {
    return this._snapshotScript(path);
  },

  // <script src="assets/<file>.js"> → window.AURORA_DATA['<file>.json'].
  _snapshotScript(path) {
    const store = window.AURORA_DATA || (window.AURORA_DATA = {});
    const key = path.split('/').pop().replace(/\.js$/i, '').replace(/\.json$/i, '') + '.json';
    const localSrc = path.indexOf('/') === -1
      ? 'assets/' + path.replace(/\.json$/i, '.js')
      : path.replace(/\.json$/i, '.js');
    const assetBase = String(window.AURORA_ASSET_BASE_URL || '').replace(/\/+$/, '');
    const src = assetBase ? assetBase + '/' + localSrc : localSrc;
    return new Promise((resolve, reject) => {
      if (store[key] !== undefined) { resolve(store[key]); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => {
        s.remove();
        if (store[key] !== undefined) resolve(store[key]);
        else reject(new Error('data ' + key + ' tidak ditemukan di ' + src));
      };
      s.onerror = () => { s.remove(); reject(new Error('data lokal tidak dapat dimuat: ' + src)); };
      document.head.appendChild(s);
    });
  },

  // DUA berkas data wilayah di assets/ (hasil builder data/bikin-assets.mjs):
  //   kab.js  {kabkot, kabkode, kemendagri, kantah, sentuh}
  //   desa.js {statis, kemendagri, harvest}
  async _kabData() {
    if (!this._kabDataP) this._kabDataP = this._snapshot('kab.json');
    return this._kabDataP;
  },

  async _desaData() {
    if (!this._desaDataP) this._desaDataP = this._snapshot('desa.json');
    return this._desaDataP;
  },

  // Peta id hex32 BHUMI → kode numerik 4 digit (kab.json → kabkode, 502 entri).
  async _kabkode() {
    return (await this._kabData()).kabkode;
  },

  // Daftar kantor pertanahan (486, geonode BHUMI) — tiap entri membawa prov,
  // kode kab Kemendagri, id hex BHUMI (dan KantorId Sentuh bila ada).
  async listKantah() {
    if (!this._kantahList) this._kantahList = (await this._kabData()).kantah || [];
    return this._kantahList;
  },

  // Daftar kab/kot — rantai fallback:
  //   1) API BHUMI /api/kabkot (500/menggantung sejak 5 Okt 2026)
  //   2) assets/kabkotnew.js — hasil download (data/download-kabkot-desa.html)
  //      → id hex32 BHUMI + kode numerik 4 digit (kabkode) tetap terbawa
  //   3) kab.js → kabkot — cadangan lama (isi sama, lebih tua)
  //   4) kab.js → kemendagri — kode numerik Kemendagri (514 kab, id 4 digit)
  //   5) kab.js → sentuh — 448 kantor Sentuh (legacy/Kantah)
  async listKabupaten() {
    let rows = null;
    try {
      rows = await this._admin('/api/kabkot?kode_propinsi=33');
    } catch (e) { /* fallback */ }
    if (!rows) {
      try {
        const baru = await this._snapshot('kabkotnew.json');
        if (Array.isArray(baru) && baru.length) rows = baru;
      } catch (e) { /* belum didownload → lanjut */ }
    }
    let kab = null;
    try { kab = await this._kabData(); } catch (e) { /* kab.js tak terbaca */ }
    if (!rows && kab && Array.isArray(kab.kabkot) && kab.kabkot.length) rows = kab.kabkot;
    if (rows) {
      const km = (kab && kab.kabkode) || {};
      return rows.map(r => ({
        id: r.value || r.id,
        value: r.value,
        label: r.label,
        nama: r.nama || r.label || r.name || r.value,
        kode: r.kode || km[r.value] || km[String(r.value || '').toUpperCase()] || undefined,
      }));
    }
    if (kab && Array.isArray(kab.kemendagri) && kab.kemendagri.length) {
      return kab.kemendagri.map(([kode, nama]) => ({ id: kode, value: kode, nama: nama, label: nama, kode: kode }));
    }
    if (kab && Array.isArray(kab.sentuh) && kab.sentuh.length) {
      this._kantorNama = Object.create(null);
      return kab.sentuh.map(k => {
        this._kantorNama[k.KantorId] = k.Nama;
        return { id: k.KantorId, nama: k.Nama, alamat: k.Alamat, _sumber: 'sentuh' };
      });
    }
    throw new Error('Daftar kabupaten tidak tersedia');
  },

  // Daftar desa — rantai fallback (urut sama dgn auroramaps.txt):
  //   1) API BHUMI /api/desa (500/menggantung)
  //   2) assets/desanew.js — hasil download (data/download-kabkot-desa.html):
  //      id hex BHUMI asli utk SEMUA kab → request SHM/NIB/NIBEL tetap valid
  //      walau /api/desa lagi 500
  //   3) desa.js → harvest — panen UI Sentuh (kunci = nama kantor; bila ada)
  //   4) desa.js → statis['<hex>'] — 3 kab dari HAR: Sukoharjo,
  //      Wonogiri, Bolmong Timur — id hex32 asli BHUMI → pencarian tetap valid
  //   5) desa.js → kemendagri — desa berprefix id kab 4 digit (10 digit)
  // Tanpa data sama sekali → [] (panel lanjut; NIB/HGU lintas kabupaten
  // tetap jalan, SHM tetap butuh desa terpilih).
  async listDesa(kabkotId) {
    if (!kabkotId) return [];
    try {
      return await this._admin('/api/desa?kabkotId=' + encodeURIComponent(kabkotId));
    } catch (e) { /* fallback */ }
    // Tier unduhan: dimemoize — sekali gagal tak diulang (404 cepat).
    try {
      if (!this._desaBaruP) this._desaBaruP = this._snapshot('desanew.json');
      const baru = await this._desaBaruP;
      const id = String(kabkotId);
      const daftar = Array.isArray(baru) ? baru
        : (baru[id] || baru[id.toLowerCase()] || baru[id.toUpperCase()]);
      if (Array.isArray(daftar) && daftar.length) {
        return daftar.map(d => (typeof d === 'string'
          ? { id: d, value: d, label: d }
          : { id: d.id || d.desaId || d.value, value: d.value || d.id || d.nama, label: d.label || d.nama || d.value }));
      }
    } catch (e) { /* file belum ada → lanjut */ }
    let lokal = null;
    try { lokal = await this._desaData(); } catch (e) { /* assets/desa.js tak terbaca */ }
    if (lokal) {
      const namaKantor = (this._kantorNama && this._kantorNama[kabkotId]) || '';
      const hasil = lokal.harvest || null;
      if (hasil) {
        const rec = hasil[namaKantor] || hasil[kabkotId];
        const daftar = rec && (rec.desa || rec);
        if (Array.isArray(daftar) && daftar.length) {
          return daftar.map(d => (typeof d === 'string'
            ? { id: d, value: d, label: d }
            : { id: d.id || d.value, value: d.value || d.id || d.nama, label: d.label || d.nama || d.value }));
        }
      }
      const st = lokal.statis && lokal.statis[String(kabkotId).toLowerCase()];
      if (Array.isArray(st) && st.length) return st;
    }
    // id hex BHUMI → kode 4 digit via kab.js → desa numerik berprefix sama
    let prefix = String(kabkotId);
    if (!/^\d{4}$/.test(prefix)) {
      try {
        const km = await this._kabkode();
        prefix = km[kabkotId] || km[String(kabkotId).toUpperCase()] || '';
      } catch (e) { prefix = ''; }
    }
    if (/^\d{4}$/.test(prefix) && lokal) {
      try {
        const kem = Array.isArray(lokal.kemendagri) ? lokal.kemendagri : [];
        const rows = kem.filter(d => d[0].indexOf(prefix) === 0);
        if (rows.length) return rows.map(([kode, nama]) => ({ id: kode, value: kode, label: nama }));
      } catch (e) { /* lanjut */ }
    }
    return [];
  },

  // AKTIF lagi (5 Okt 2026): server bhumi pulih — klik bidang diverifikasi
  // live dari rekaman situs C:\Users\rc99\Downloads\bidang.har:
  //   POST /expapi/auth-ticket → POST /expapi/getPersil (ECDH headers)
  //   → 200 {encrypted,ecdh,serverPubKey,data} → dekripsi
  //   ECDH passphrase → FeatureCollection; highlight via
  //   GET /expapi/umum/wms?layer=Persil&filter=<persilpasifid>&BBOX=…
  // Saat layer bidang aktif, klik peta DITANGANI DI SINI (AtrbpnLayers
  // menyerahkan popup zona RTR/RW ke handler ini — lihat _onMapClick).
  _clickIdentifyEnabled: true,

  // ── Map Click Handler ──
  _onMapClick(e) {
    if (!this._clickIdentifyEnabled) return;
    if (State.activeDrawType) return; // skip saat mode drawing
    const bidangEntry = AtrbpnLayers._layers?.bidang;
    if (!bidangEntry || !bidangEntry.on || !bidangEntry.layer || !MapManager.map.hasLayer(bidangEntry.layer)) return;
    if (!this._proxyBase) return;
    this.identify(e.latlng.lat, e.latlng.lng);
  },

  _ensureBidangVisible() {
    const entry = AtrbpnLayers._layers?.bidang;
    if (!entry?.layer) return;
    entry.on = true;
    entry.layer.setOpacity(entry.opacity);
    if (!MapManager.map.hasLayer(entry.layer)) entry.layer.addTo(MapManager.map);
  },

  async identify(lat, lng) {
    if (!isFinite(lat) || !isFinite(lng)) return;
    if (!this._proxyBase) {
      Toast.show('Proxy bhumi tidak tersedia', 'warn');
      return;
    }

    Toast.show('Mengidentifikasi bidang\u2026', 'info');
    try {
      const span = 0.001;
      const features = await this._gfiFeatures({
        service_layer_name: 'umum:Persil',
        width: 256, height: 256,
        bbox: [lng - span, lat - span, lng + span, lat + span].map(v => v.toFixed(6)).join(','),
        x: 128, y: 128,
        query_layers: 'umum:Persil',
        url: '/expapi/getPersil',
        service: '/bhumigs/umum'
      });

      if (!features.length) {
        Toast.show('Tidak ada bidang di titik ini', 'warn');
        this._hidePanel();
        return;
      }

      const f = features.find(x => x.properties && x.properties.nib) || features[0];
      this._showInfo(f, features.length, lat, lng);
      this._drawPolygon(features, lat, lng);
      Toast.show(`NIB ${f.properties?.nib || '?'} \u2014 ${f.properties?.luas || '?'} m\u00B2`, 'success');
    } catch (e) {
      Toast.show('Gagal identifikasi: ' + e.message, 'error');
    }
  },

  // ── Info Panel (via MapPopup) ──
  _showInfo(f, count, lat, lng) {
    this._currentFeature = { feature: f, lat, lng };
    AutoSave.lastBhumi = { feature: f, features: this._lastFeatures || [f], count, lat, lng };
    AutoSave.save();
    const p = f.properties || {};
    const rows = [
      ['NIB', p.nib],
      ['Luas', p.luas ? p.luas + ' m\u00B2' : null],
      ['Tipe Hak', p.tipehak],
      ['Desa', p.namadesa],
      ['Kecamatan', p.namakecamatan],
      ['Akurasi', p.akurasibidang],
    ].filter(([, v]) => v != null && v !== '');

    const candidates = count > 1
      ? `<div class="mp-cand">${count} bidang di titik ini</div>`
      : '';

    MapPopup.show(`
      <div class="mp-header">
        <span class="mp-title">\u2B21 Bidang Tanah</span>
        <button class="mp-close" onclick="MapPopup.hide()">\u2715</button>
      </div>
      ${candidates}
      <table>
        ${rows.map(([k, v]) => `<tr><th>${k}</th><td>${Utils.escapeHtml(String(v))}</td></tr>`).join('')}
      </table>
      <div class="mp-coord">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
      <button class="mp-share" type="button" onclick="BhumiIdentify.shareLocation(${lat}, ${lng})">🔗 Bagikan lokasi lahan</button>
      <button class="mp-share" type="button" onclick="BhumiIdentify.prepareDrawing()">📝 Gunakan data ini saat menggambar</button>
    `);
  },

  prepareDrawing() {
    if (!this._currentFeature) return;
    const { feature, lat, lng } = this._currentFeature;
    const p = feature.properties || {};
    State.pendingBhumiProperties = {
      name: `Bidang ${p.nib || 'ATR/BPN'}`, nib: p.nib || '', luas: p.luas || '',
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
    };
    MapPopup.hide();
    if (window.innerWidth <= 768) {
      const add = document.getElementById('mb-add-point');
      add?.classList.add('pending-bhumi-draw');
      Toast.show('Data bidang disimpan sementara. Tekan tombol + di bawah peta untuk menggambar.', 'info');
      return;
    }
    MapManager.startDraw('poly');
    Toast.show('Gambar batas bidang. Setelah selesai, data akan masuk ke panel edit.', 'info');
  },

  async shareLocation(lat, lng) {
    const coord = `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coord)}`;
    const shareData = { title: 'Lokasi lahan - AuroraMaps', text: `Lokasi lahan ${coord}`, url };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(url.href); Toast.show('Link lokasi disalin', 'success'); }
    } catch (e) {
      if (e.name !== 'AbortError') Toast.show('Gagal membagikan lokasi', 'error');
    }
  },

  _hidePanel() {
    MapPopup.hide();
    this._clearPolygon();
  },



  // ── Draw: WMS imageOverlay (presisi) ──
  async _drawPolygon(featureOrFeatures, lat, lng) {
    this._lastFeatures = Array.isArray(featureOrFeatures) ? featureOrFeatures : [featureOrFeatures];
    this._clearPolygon();
    const features = Array.isArray(featureOrFeatures) ? featureOrFeatures : [featureOrFeatures];
    if (!features.length) return;
    const map = MapManager.map;
    const workerBase = this._proxyBase || 'https://orange-smoke-f6f5.riacaya99.workers.dev';
    this._hlLayers = [];

    // WMS tiles are visual-only, so add an invisible hit-test polygon above
    // them to make clicking the highlighted HPA field reopen its popup.
    const hitLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
      pane: 'bidangPane',
      style: { color: 'transparent', weight: 12, opacity: 0, fillColor: 'transparent', fillOpacity: 0 },
      onEachFeature: (feature, vectorLayer) => vectorLayer.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        const point = event.latlng;
        this._showInfo(feature, features.length, point.lat, point.lng);
      })
    }).addTo(map);
    this._hlLayers.push(hitLayer);

    // WMS imageOverlay — tampilkan gambar bidang dari bhumi
    features.forEach(f => {
      const pid = f?.properties?.persilpasifid;
      if (!pid) return;
      const Tile = L.GridLayer.extend({
        createTile: function(coords) {
          const img = document.createElement('img'), b = this._tileCoordsToBounds(coords);
          const sw = L.Projection.SphericalMercator.project(b.getSouthWest());
          const ne = L.Projection.SphericalMercator.project(b.getNorthEast());
          const bbox = [sw.x, sw.y, ne.x, ne.y].map(v => v.toFixed(3)).join(',');
          img.alt = ''; img.width = 512; img.height = 512;
          img.src = workerBase + '/expapi/umum/wms?layer=Persil&filter=' + encodeURIComponent(pid) + '&transparent=true&format=image/png&BBOX=' + bbox + '&WIDTH=512&HEIGHT=512';
          return img;
        }
      });
      const layer = new Tile({ tileSize: 512, maxZoom: 22, maxNativeZoom: 20, opacity: 0.6, pane: 'bidangPane' }).addTo(map);
      this._hlLayers.push(layer);
    });
  },

  _clearPolygon() {
    if (this._hlLayers) {
      this._hlLayers.forEach(l => l.remove());
      this._hlLayers = null;
    }
  },

  // ── Pause/resume overlay saat mode drawing aktif ──
  _overlayWasVisible: false,

  pauseOverlay() {
    if (!this._hlLayers || !this._hlLayers.length) return;
    this._overlayWasVisible = true;
    this._hlLayers.forEach(l => l.remove());
  },

  resumeOverlay() {
    if (!this._overlayWasVisible) return;
    this._overlayWasVisible = false;
    // Re-add layers to map — they were removed but still exist
    if (this._hlLayers) this._hlLayers.forEach(l => l.addTo(MapManager.map));
  }
};
