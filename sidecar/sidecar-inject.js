// =====================================================
// AURORAMAPS BHUMI SIDECAR — skrip yang DISISIPKAN ke halaman BHUMI
// lewat CDP (tools/bhumi-bridge/sidecar-host.mjs).
// =====================================================
// Berjalan di dalam konteks halaman https://bhumi.atrbpn.go.id/peta
// (MAIN world) sehingga setiap fetch ter-stempel Origin/Referer bhumi
// asli → lolos WAF ATR/BPN. Menyediakan API berbasis Promise:
//   window.AuroraBhumiSidecar.search({path, body})   → {features:[...]}
//   window.AuroraBhumiSidecar.identify({body})       → {features:[...]}
//   window.AuroraBhumiSidecar.tile({url})            → {base64, mime}
//   window.AuroraBhumiSidecar.gfi({url})             → {text} (GetFeatureInfo RTRW)
//   window.AuroraBhumiSidecar.tokenSync({force})     → {status:'ok'|..., cached}
//   window.AuroraBhumiSidecar.status()               → {sidecar, loggedIn}
// Logika disalin dari ekstensi AuroraMaps lama (bhumi-main.js, kini dihapus):
// dekripsi statis OpenSSL, alur auth-ticket ECDH, whitelist tile, dan
// sinkron token loginApi + reCAPTCHA (chunk 8815 milik situs BHUMI).
(() => {
  const SIDECAR_V = 10;
  // Idempotent untuk navigasi ulang, TETAPI versi lama (tanpa v) harus
  // diganti saat sidecar di-restart — kalau tidak, kode lama yang tetap
  // berjalan di tab yang tak dimuat ulang (guard 'return' lama dulu membuat
  // perbaikan tak pernah sampai ke tab yang sedang terbuka).
  if (window.AuroraBhumiSidecar && window.AuroraBhumiSidecar.v === SIDECAR_V) return;

  // ── Whitelist (sama dengan ekstensi AuroraMaps lama) ─────────────────────
  // /expapi/umum/wms = gambar bidang transparan (overlay klik identify).
  const TILE_PATHS = ['/mprx/service', '/expapi/bhumigeos/umum/wms', '/expapi/bhumigs/umum/wms', '/expapi/umum/wms'];
  const GISTARU_ORIGIN = 'https://gistaru-app.atrbpn.go.id';
  const SEARCH_PATHS = ['/expapi/getBidang', '/expapi/getBidang2'];
  const TILE_MAX_BYTES = 2000000;

  // ── Dekripsi statis OpenSSL (EVP_BytesToKey MD5), passphrase
  //    's3CRetCR1pT0' — passphrase peninggalan ekstensi lama ──────────────────
  function safeAdd(x, y) { const l = (x & 0xffff) + (y & 0xffff); const m = (x >> 16) + (y >> 16) + (l >> 16); return (m << 16) | (l & 0xffff); }
  function rotl(x, c) { return (x << c) | (x >>> (32 - c)); }
  const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22, 5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20, 4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23, 6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  const K = [0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391];
  const F = [(b,c,d)=>(b&c)|(~b&d), (b,c,d)=>(b&d)|(c&~d), (b,c,d)=>b^c^d, (b,c,d)=>c^(b|~d)];
  const G = [(i)=>i, (i)=>(5*i+1)%16, (i)=>(3*i+5)%16, (i)=>(7*i)%16];
  function md5Bytes(bytes) {
    const x = [];
    for (let i = 0; i + 3 < bytes.length; i += 4) x[i >> 2] = bytes[i] | (bytes[i+1] << 8) | (bytes[i+2] << 16) | (bytes[i+3] << 24);
    if (bytes.length % 4) {
      let w = 0;
      for (let i = 0; i < (bytes.length % 4); i++) w |= bytes[i] << (i * 8);
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
  }
  function concatBytes(...arrs) {
    let n = 0; for (const a of arrs) n += a.length;
    const out = new Uint8Array(n);
    let p = 0;
    for (const a of arrs) { out.set(a, p); p += a.length; }
    return out;
  }
  async function decryptStatic(encB64, passphrase = 's3CRetCR1pT0') {
    const bin = atob(encB64);
    const full = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) full[i] = bin.charCodeAt(i);
    if (full.length < 16) throw new Error('data terlalu pendek');
    const salt = full.slice(8, 16);
    const ct = full.slice(16);
    const pass = new TextEncoder().encode(passphrase);
    let derived = new Uint8Array(0);
    let prev = new Uint8Array(0);
    while (derived.length < 48) {
      prev = md5Bytes(concatBytes(prev, pass, salt));
      derived = concatBytes(derived, prev);
    }
    const key = derived.slice(0, 32), iv = derived.slice(32, 48);
    const keyObj = await crypto.subtle.importKey('raw', key, { name: 'AES-CBC' }, false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, keyObj, ct);
    return new TextDecoder().decode(pt);
  }
  async function ecdhPassphrase(serverPubKeyHex, privateKey, challengeSeed) {
    const hex = String(serverPubKeyHex || '');
    const pairs = hex.match(/.{2}/g) || [];
    const bytes = new Uint8Array(pairs.map(x => parseInt(x, 16)));
    const publicKey = await crypto.subtle.importKey('raw', bytes,
      { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const secret = new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'ECDH', public: publicKey }, privateKey, 256));
    const sharedHex = Array.from(secret, b => b.toString(16).padStart(2, '0')).join('');
    const material = new TextEncoder().encode(sharedHex + ':' + challengeSeed);
    const digest = await crypto.subtle.digest('SHA-256', material);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── Token Authorization (salinan pasif dari halaman) ──────────────────────
  // AUTH TANPA PREFIX: sejak pembaruan 26 Okt 2026 situs BHUMI mengirim
  //   Authorization: <JWT mentah>   (BUKAN "Bearer <JWT>")
  // pada getBidang — teruji: raw → 200, "Bearer " + raw → 401 Unauthorized.
  // Karena itu nilai yang disimpan SELALU berupa JWT mentah tanpa prefix.
  let savedAuth = '';
  const JWT_RE = /ey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/;
  const stripBearer = (v) => String(v || '').replace(/^bearer\s+/i, '').trim();
  const rememberAuth = (raw) => {
    const v = typeof raw === 'string' ? raw
      : (raw && typeof raw.get === 'function' ? (raw.get('Authorization') || raw.get('authorization')) : '');
    const token = stripBearer(v);
    if (v && /^bearer\s+\S+/i.test(v) && JWT_RE.test(token)) savedAuth = token;
    else if (v && JWT_RE.test(v) && !/^https?:/i.test(v)) savedAuth = token; // situs mengirim JWT mentah
  };
  const storedAuth = () => {
    if (savedAuth) return savedAuth;
    try {
      const stores = [window.localStorage, window.sessionStorage];
      for (const store of stores) {
        for (let i = 0; i < store.length; i++) {
          const val = store.getItem(store.key(i));
          if (!val || val.length > 8000) continue;
          const m = val.match(JWT_RE);
          if (m) { savedAuth = m[0]; return savedAuth; } // mentah, tanpa "Bearer "
        }
      }
    } catch (_) { /* store diblokir */ }
    return '';
  };
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    try { if (init && init.headers) rememberAuth(init.headers); } catch (_) { /* header aneh */ }
    return originalFetch.call(this, input, init);
  };
  const originalXhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try { if (String(name).toLowerCase() === 'authorization') rememberAuth(value); } catch (_) { /* abaikan */ }
    return originalXhrSetHeader.call(this, name, value);
  };

  const flattenSearch = (data) => Array.isArray(data)
    ? data.flatMap(x => (x == null ? [] :
        (Array.isArray(x.features) ? x.features : (x.type === 'FeatureCollection' ? [] : x))))
    : (data && Array.isArray(data.features) ? data.features : []);

  // ── search: getBidang / getBidang2 (alur sama dengan ekstensi lama) ─────
  async function searchImpl({ path, body }) {
    if (!SEARCH_PATHS.includes(path)) throw new Error('Endpoint pencarian ditolak.');
    if (!body || typeof body !== 'object' || JSON.stringify(body).length > 8000) {
      throw new Error('Body pencarian tidak valid.');
    }
    const headers = { 'Content-Type': 'application/json', 'x-timestamp': Date.now().toString() };
    let auth = savedAuth || storedAuth();
    if (auth) headers.Authorization = auth;
    let res = await originalFetch(path, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'include' });
    if (res.status === 401 && savedAuth) {
      savedAuth = ''; // token tangkapan hook bisa basi → pakai token storage
      auth = storedAuth();
      if (auth) headers.Authorization = auth; else delete headers.Authorization;
      res = await originalFetch(path, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'include' });
    }
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) { /* balasan non-JSON */ }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (data && data.encrypted && data.data && !data.ecdh) {
      try { data = JSON.parse(await decryptStatic(data.data)); }
      catch (_) { throw new Error('Balasan pencarian terenkripsi dan tidak dapat dibuka.'); }
    }
    return { features: flattenSearch(data).slice(0, 30) };
  }

  // ── identify: auth-ticket + getPersil ber-ecdh ────────────────────────────
  async function identifyImpl({ body }) {
    if (!body || !Number.isFinite(body.latitude) || !Number.isFinite(body.longitude) ||
        !Number.isFinite(body.x) || !Number.isFinite(body.y) || typeof body.bbox !== 'string') {
      throw new Error('Parameter koordinat tidak valid.');
    }
    const ticketRes = await originalFetch('/expapi/auth-ticket', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include'
    });
    if (!ticketRes.ok) throw new Error('HTTP ' + ticketRes.status);
    const ticket = await ticketRes.json();
    if (!ticket || !ticket.ticketId || !ticket.challengeSeed) throw new Error('auth-ticket BHUMI tidak lengkap.');
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const pub = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
    const clientPubKey = Array.from(pub, b => b.toString(16).padStart(2, '0')).join('');
    const headers = {
      'Content-Type': 'application/json',
      'X-Client-Pubkey': clientPubKey,
      'X-Ticket-Id': ticket.ticketId,
      'X-Timestamp': String(Date.now())
    };
    const auth = savedAuth || storedAuth();
    if (auth) headers.Authorization = auth;
    const res = await originalFetch('/expapi/getPersil', {
      method: 'POST', headers, credentials: 'include', body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    let fc = data;
    if (data && data.encrypted && data.data) {
      const passphrase = data.ecdh && data.serverPubKey
        ? await ecdhPassphrase(data.serverPubKey, keyPair.privateKey, ticket.challengeSeed)
        : '';
      fc = JSON.parse(await decryptStatic(data.data, passphrase));
    }
    const features = ((fc && fc.features) || []).map(f => {
      if (f && (!f.geometry || !f.geometry.coordinates) && f.bbox && f.bbox.coordinates) {
        return Object.assign({}, f, { geometry: f.bbox });
      }
      return f;
    }).slice(0, 30);
    return { features };
  }

  // ── analisa: "Analisa Bidang" = Profil Informasi Bidang Tanah ──────────────
  // POST /expapi/analisaPersil (tercatat di HAR klikbidang-bhumi 27 Okt 2026)
  // memakai pola auth yang SAMA dengan getPersil: auth-ticket → ECDH P-256 →
  // header x-client-pubkey / x-ticket-id / x-timestamp, balasan terenkripsi
  // AES-ECDH lalu dibuka di sini. Body persis pola situs:
  //   {latitude, longitude, luas}
  // Balasan (setelah decrypt) berisi profil lengkap yang di modal situs:
  // Rencana Tata Ruang (KP2B + dasar ketetapan), Zona Nilai Tanah, dan
  // Ketetapan Khusus. JSON dikembalikan APA ADANYA — render ada di sisi app
  // (atrbpnLayers.js, tab Analisa) supaya ikut berubah bila situs menambah field.
  async function analisaImpl({ body }) {
    if (!body || !Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)) {
      throw new Error('Parameter analisa tidak valid.');
    }
    const payload = {
      latitude: body.latitude,
      longitude: body.longitude,
      luas: Number.isFinite(body.luas) ? body.luas : 0
    };
    const ticketRes = await originalFetch('/expapi/auth-ticket', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include'
    });
    if (!ticketRes.ok) throw new Error('HTTP ' + ticketRes.status);
    const ticket = await ticketRes.json();
    if (!ticket || !ticket.ticketId || !ticket.challengeSeed) throw new Error('auth-ticket BHUMI tidak lengkap.');
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const pub = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
    const clientPubKey = Array.from(pub, b => b.toString(16).padStart(2, '0')).join('');
    const headers = {
      'Content-Type': 'application/json',
      'X-Client-Pubkey': clientPubKey,
      'X-Ticket-Id': ticket.ticketId,
      'X-Timestamp': String(Date.now())
    };
    const auth = savedAuth || storedAuth();
    if (auth) headers.Authorization = auth;
    const res = await originalFetch('/expapi/analisaPersil', {
      method: 'POST', headers, credentials: 'include', body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data && data.encrypted && data.data) {
      const passphrase = data.ecdh && data.serverPubKey
        ? await ecdhPassphrase(data.serverPubKey, keyPair.privateKey, ticket.challengeSeed)
        : '';
      return { data: JSON.parse(await decryptStatic(data.data, passphrase)) };
    }
    return { data };
  }

  // ── tile: whitelist + ambil gambar dalam halaman → base64 ─────────────────
  async function tileImpl({ url }) {
    let u;
    try { u = new URL(String(url), location.origin); } catch (_) { throw new Error('URL tile tidak valid.'); }
    const isBhumi = u.origin === location.origin && TILE_PATHS.includes(u.pathname);
    const isGistaru = u.origin === GISTARU_ORIGIN && u.pathname.startsWith('/interoppublic/api/wms/');
    if (!isBhumi && !isGistaru) throw new Error('URL tile ditolak.');
    const res = await originalFetch(u.href, { credentials: isGistaru ? 'omit' : 'include' });
    const mime = String(res.headers.get('content-type') || '').split(';')[0].trim();
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (mime && !mime.startsWith('image/')) throw new Error('Balasan bukan gambar (' + mime + ')');
    const buf = await res.arrayBuffer();
    if (buf.byteLength > TILE_MAX_BYTES) throw new Error('Tile terlalu besar.');
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 32768) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    }
    return { base64: btoa(bin), mime: mime || 'image/png' };
  }

  // ── gfi: GetFeatureInfo zona RTRW (gistaru & bhumi) di dalam halaman ──────
  // Tab popup RTRW Pro/Kab membaca zona lewat GetFeatureInfo. Dari halaman app
  // (file:// Android maupun cross-site) request itu ditolak WAF (403) atau
  // gagal CORS — jadi URL-nya dijalankan DI SINI, dari konteks halaman BHUMI
  // (Referer/Origin asli). Whitelist sempit: WMS gistaru + WMS rtrw bhumi.
  const GFI_MAX_BYTES = 512000;
  async function gfiImpl({ url }) {
    let u;
    try { u = new URL(String(url), location.origin); } catch (_) { throw new Error('URL GFI tidak valid.'); }
    const isBhumi = u.origin === location.origin && u.pathname === '/expapi/rtrw/wms';
    const isGistaru = u.origin === GISTARU_ORIGIN && u.pathname.startsWith('/interoppublic/api/wms/');
    if (!isBhumi && !isGistaru) throw new Error('URL GFI ditolak.');
    const res = await originalFetch(u.href, { credentials: isGistaru ? 'omit' : 'include' });
    const text = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (text.length > GFI_MAX_BYTES) throw new Error('Balasan GFI terlalu besar.');
    return { text };
  }

  // ── tokenSync: replika alur "Saya Setuju" (chunk 8815) ────────────────────
  const RECAPTCHA_SITE_KEY = '6LeHjccpAAAAAIuu12A2UZPZ-11sp6STRRlsx6BX';
  let recaptchaLoading = null;
  const captchaToken = (action) => new Promise((resolveOuter) => {
    const ready = async () => {
      if (!window.grecaptcha) {
        if (!recaptchaLoading) recaptchaLoading = new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://www.google.com/recaptcha/api.js?render=' + RECAPTCHA_SITE_KEY;
          s.async = true;
          s.onload = res;
          s.onerror = () => { recaptchaLoading = null; rej(new Error('grecaptcha gagal dimuat')); };
          document.head.appendChild(s);
        });
        await recaptchaLoading;
      }
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action })
          .then(resolveOuter).catch(() => resolveOuter(''));
      });
    };
    ready().catch(() => resolveOuter(''));
  });
  const storedTokenFresh = () => {
    let raw = '';
    try { raw = localStorage.getItem('tokens') || ''; } catch (_) { return false; }
    let t = raw;
    try { const o = JSON.parse(raw); if (o && (o.token || o.jwt)) t = o.token || o.jwt; } catch (_) { /* string mentah */ }
    const m = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/.exec(String(t));
    if (!m) return false;
    try {
      const p = JSON.parse(atob(m[0].split('.')[1].replace(/-/g, '_').replace(/\+/g, '/')));
      return !p.exp || p.exp * 1000 > Date.now() + 60000;
    } catch (_) { return true; }
  };
  async function tokenSync({ force } = {}) {
    if (!force && storedTokenFresh()) return { status: 'ok', cached: true };
    const captcha = await captchaToken('login');
    if (!captcha) return { status: 'reCAPTCHA tidak tersedia — selesaikan captcha di peta BHUMI bila muncul, lalu ulangi.' };
    const res = await originalFetch('/expapi/loginApi', {
      method: 'POST',
      // x-timestamp: pola chunk 693 situs (helper Wz) — ikut disertakan supaya
      // permintaan identik dengan rekaman HAR 26 Okt 2026.
      headers: { 'Content-Type': 'application/json', 'x-timestamp': Date.now().toString() },
      body: JSON.stringify({ recaptchaToken: captcha }),
      credentials: 'include'
    });
    if (!res.ok) return { status: 'loginApi HTTP ' + res.status };
    const data = await res.json();
    const token = typeof data === 'string' ? data : (data && (data.token || data.jwt)) || '';
    if (!token || !/^eyJ/.test(String(token))) return { status: 'loginApi membalas token tidak valid.' };
    try { localStorage.setItem('tokens', String(token)); } catch (_) { /* store diblokir */ }
    savedAuth = '';
    return { status: 'ok' };
  }

  // ── Penjaga sesi: token loginApi berumur pendek ────────────────────────────
  // Token di localStorage basi dalam hitungan MENIT (terukur: ±15 menit); begitu
  // basi, identify & search membalas 401 ATAU 403 dan tile 403 → tab Bidang
  // tampil tanpa SHM & luas (padahal situs BHUMI sendiri masih menampilkan
  // data — di sana penjadwal refresh milik situs, chunk 8815, terus berjalan;
  // halaman pendamping headless tidak menjalankannya). Karena itu kesegaran
  // dicek di sini, setiap panggilan:
  //   1. token basi → sinkron dulu (loginApi + reCAPTCHA, tanpa paksa)
  //   2. tetap 401/403 → sinkron paksa lalu ULANGI sekali
  // Antrean bersama (syncFlight) mencegah puluhan tile serentak memicu
  // loginApi/rate-limit yang sama.
  let syncFlight = null;
  const freshSync = (force) => {
    if (!syncFlight) {
      syncFlight = tokenSync({ force: !!force })
        .catch(e => ({ status: String((e && e.message) || e) }))
        .finally(() => { syncFlight = null; });
    }
    return syncFlight;
  };
  // ── "Saya Setuju" otomatis ───────────────────────────────────────────────────
  // Disclaimer situs HANYA tampil saat sesi/token mati, dan tombolnya
  // menjalankan alur login asli milik situs (chunk 8815 → loginApi 200 —
  // teruji lebih andal daripada jalur buatan kita yang pernah kena 403).
  // Jendela pendamping berjalan headless (tak terlihat), jadi tidak ada
  // tangan yang bisa mengkliknya → klik otomatis:
  //   • pengamat DOM + pemeriksaan berkala: tombol muncul → langsung diklik
  //   • dipakai juga sebagai langkah PERTAMA pemulihan sesi (recoverSession)
  let agreeAt = 0;
  const agreeBtn = () => {
    try {
      return [...document.querySelectorAll('button, a')].find(el => {
        const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
        if (!/^(saya setuju|setuju|agree|i agree|saya mengerti|understand)$/i.test(t)) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0; // tampil (display:none → 0)
      });
    } catch (_) { return null; } // dokumen belum siap
  };
  const clickAgree = () => {
    if (Date.now() - agreeAt < 8000) return false; // cegah loginApi dobel
    const btn = agreeBtn();
    if (!btn) return false;
    agreeAt = Date.now();
    try { btn.click(); } catch (_) { return false; }
    return true;
  };
  // Pemeriksaan ringan tiap 2 dtk (querySelector saja — tanpa jaringan).
  setInterval(() => { try { clickAgree(); } catch (_) { /* abaikan */ } }, 2000);
  // Pengamat DOM: event-driven, jadi TIDAK kena throttling timer pada jendela
  // tersembunyi/minimize (Chromium memperlambat interval sampai 60 dtk di
  // latar belakang) — tombol disclaimer muncul → langsung diklik tanpa
  // menunggu interval berikutnya. Debounce 150 ms supaya lambang peta yang
  // banyak berubah tidak memicu querySelectorAll berlebihan.
  try {
    let antri = false;
    const obFire = () => {
      if (antri) return;
      antri = true;
      setTimeout(() => { antri = false; try { clickAgree(); } catch (_) { /* abaikan */ } }, 150);
    };
    const mulai = () => {
      if (!document.body) { setTimeout(mulai, 500); return; }
      new MutationObserver(obFire).observe(document.body, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class']
      });
    };
    mulai();
  } catch (_) { /* abaikan */ }
  clickAgree();

  // Pemulihan sesi berlapis:
  //   1. token masih segar → tidak usah apa-apa
  //   2. tombol disclaimer tampil → klik (alur asli situs) lalu tunggu token
  //      baru sampai 7,5 dtk
  //   3. belum juga segar → loginApi + reCAPTCHA milik kita
  async function recoverSession(force) {
    if (!force && storedTokenFresh()) return { status: 'ok', cached: true };
    if (clickAgree()) {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 250));
        if (storedTokenFresh()) return { status: 'ok', via: 'disclaimer' };
      }
    }
    return freshSync(force);
  }
  async function withAuthRetry(run, retryRe) {
    if (!storedTokenFresh()) await recoverSession(false).catch(() => null);
    try {
      return await run();
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (!retryRe.test(msg)) throw e;
      const s = await recoverSession(true);
      if (s && s.status && s.status !== 'ok') throw new Error(String(s.status));
      return run();
    }
  }
  const search = (arg) => withAuthRetry(() => searchImpl(arg), /HTTP 40[13]/);
  const identify = (arg) => withAuthRetry(() => identifyImpl(arg), /HTTP 40[13]/);
  const tile = (arg) => withAuthRetry(() => tileImpl(arg), /HTTP 40[13]/);
  const gfi = (arg) => withAuthRetry(() => gfiImpl(arg), /HTTP 40[13]/);
  const analisa = (arg) => withAuthRetry(() => analisaImpl(arg), /HTTP 40[13]/);

  // Sisa umur token (detik, null bila tak diketahui) — dilaporkan ke host
  // supaya sesi bisa disegarkan SEBELUM basi (token hanya berumur ±15 menit).
  const tokenSisa = () => {
    let raw = '';
    try { raw = localStorage.getItem('tokens') || ''; } catch (_) { return null; }
    const m = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/.exec(raw);
    if (!m) return null;
    try {
      const p = JSON.parse(atob(m[0].split('.')[1].replace(/-/g, '_').replace(/\+/g, '/')));
      return p.exp ? Math.round(p.exp - Date.now() / 1000) : null;
    } catch (_) { return null; }
  };
  const status = () => ({
    sidecar: true,
    v: SIDECAR_V,
    loggedIn: storedTokenFresh(),
    sisa: tokenSisa(),
    url: location.href
  });

  window.AuroraBhumiSidecar = { search, identify, tile, gfi, tokenSync, status, analisa };
})();