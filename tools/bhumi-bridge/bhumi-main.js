(() => {
  const bridgeId = new URL(location.href).searchParams.get('auroraBridge');
  const isIdentifyBridge = !!bridgeId && /^[\w-]{20,80}$/.test(bridgeId);
  let delivered = false;
  let persilResponseSeen = false;

  const emitResult = (requestId, payload) => {
    window.postMessage({ type: 'AURORAMAPS_BHUMI_PAGE_RESULT', requestId, ...payload }, location.origin);
  };
  // Hasil identify hanya dikirim bila tab memang dinavigasi dengan auroraBridge.
  const emit = (payload) => {
    if (delivered || !isIdentifyBridge) return;
    delivered = true;
    emitResult(bridgeId, payload);
  };

  // ── Dekripsi statis OpenSSL (EVP_BytesToKey MD5) ─────────────────────
  // Port dari src/js/bhumiIdentify.js — passphrase 's3CRetCR1pT0'.
  // Situs mendekripsi envelope ini dengan CryptoJS, jadi hook
  // SubtleCrypto.decrypt di bawah tidak pernah terpicu untuk kasus statis;
  // tanpa dekripsi di sini respons getPersil terenkripsi DIBUANG dan
  // identifikasi menggantung sampai timeout 60 detik.
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
  }
  function concatBytes(...arrs) {
    let n = 0; for (const a of arrs) n += a.length;
    const out = new Uint8Array(n);
    let p = 0; for (const a of arrs) { out.set(a, p); p += a.length; }
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

  // Envelope {encrypted,data} TANPA ecdh → dekripsi statis lalu kirim hasil.
  // Kasus ecdh dibiarkan agar situs mendekripsinya sendiri (terjaring hook
  // SubtleCrypto.decrypt di bawah).
  const handleEncryptedEnvelope = (data) => {
    if (!(data && data.encrypted && data.data) || data.ecdh) return;
    decryptStatic(data.data).then(text => {
      const fc = JSON.parse(text);
      if (Array.isArray(fc && fc.features)) emit({ features: fc.features.slice(0, 30) });
    }).catch(() => { /* bukan envelope statis / korup — biarkan alur situs */ });
  };

  // ── Tangkap Authorization milik situs (pasif, tidak pernah dikirim balik
  //    ke AuroraMaps selain untuk request pencarian di tab ini) ───────────
  let savedAuth = '';
  const rememberAuth = (raw) => {
    const v = typeof raw === 'string' ? raw
      : (raw && typeof raw.get === 'function' ? (raw.get('Authorization') || raw.get('authorization')) : '');
    if (v && /^bearer\s+\S+/i.test(v)) savedAuth = v;
  };
  const storedAuth = () => {
    if (savedAuth) return savedAuth;
    const JWT = /ey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/;
    try {
      const stores = [window.localStorage, window.sessionStorage];
      for (const store of stores) {
        for (let i = 0; i < store.length; i++) {
          const val = store.getItem(store.key(i));
          if (!val || val.length > 8000) continue;
          const m = val.match(JWT);
          if (m) { savedAuth = 'Bearer ' + m[0]; return savedAuth; }
        }
      }
    } catch (_) { /* store bisa diblokir situs */ }
    return '';
  };

  // ── Pencarian bidang dari AuroraMaps ─────────────────────────────────
  const flattenSearch = (data) => Array.isArray(data)
    ? data.flatMap(x => (x == null ? [] :
        (Array.isArray(x.features) ? x.features : (x.type === 'FeatureCollection' ? [] : x))))
    : (data && Array.isArray(data.features) ? data.features : []);

  const handleSearch = async ({ requestId, path, body }) => {
    if (path !== '/expapi/getBidang' && path !== '/expapi/getBidang2') {
      emitResult(requestId, { error: { message: 'Endpoint pencarian ditolak.' } });
      return;
    }
    try {
      const headers = { 'Content-Type': 'application/json' };
      let auth = savedAuth || storedAuth();
      if (auth) headers.Authorization = auth;
      let res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'include' });
      if (res.status === 401 && savedAuth) {
        // Authorization hasil tangkapan hook bisa basi (token lama yang sempat
        // dipakai halaman) → buang, pakai token segar dari storage, coba lagi.
        savedAuth = '';
        auth = storedAuth();
        if (auth) headers.Authorization = auth; else delete headers.Authorization;
        res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'include' });
      }
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch (_) { /* balasan non-JSON */ }
      if (!res.ok) {
        emitResult(requestId, { error: { status: res.status } });
        return;
      }
      if (data && data.encrypted && data.data && !data.ecdh) {
        try {
          data = JSON.parse(await decryptStatic(data.data));
        } catch (_) {
          emitResult(requestId, { error: { message: 'Balasan pencarian terenkripsi dan tidak dapat dibuka.' } });
          return;
        }
      }
      emitResult(requestId, { features: flattenSearch(data).slice(0, 30) });
    } catch (e) {
      emitResult(requestId, { error: { message: (e && e.message) || 'fetch gagal' } });
    }
  };

  // ── Identifikasi bidang (getPersil) dari AuroraMaps ──────────────────────
  // Alur lama menavigasi tab BHUMI ke /peta?bbox=…&auroraBridge=… lalu menunggu
  // situs sendiri memanggil getPersil — teruji 24 Okt 2026 tidak pernah terpicu
  // (timeout 60 detik). Kini request dijalankan sendiri di halaman ini:
  // auth-ticket → getPersil dengan header ECDH + token halaman bila ada.
  // Tanpa login, tab BHUMI membalas 401 dan pesannya diteruskan ke AuroraMaps.
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
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', material));
    return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
  }

  const handleIdentify = async ({ requestId, body }) => {
    try {
      const ticketRes = await fetch('/expapi/auth-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (!ticketRes.ok) { emitResult(requestId, { error: { status: ticketRes.status } }); return; }
      const ticket = await ticketRes.json();
      if (!ticket || !ticket.ticketId || !ticket.challengeSeed) {
        emitResult(requestId, { error: { message: 'auth-ticket BHUMI tidak lengkap.' } });
        return;
      }
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
      let auth = savedAuth || storedAuth();
      if (auth) headers.Authorization = auth;
      let res = await fetch('/expapi/getPersil', {
        method: 'POST', headers, credentials: 'include', body: JSON.stringify(body)
      });
      if (res.status === 401 && savedAuth) {
        // Sama seperti pencarian: token hasil tangkapan hook bisa basi →
        // buang dan coba lagi dengan token dari storage halaman.
        savedAuth = '';
        auth = storedAuth();
        if (auth) headers.Authorization = auth; else delete headers.Authorization;
        res = await fetch('/expapi/getPersil', {
          method: 'POST', headers, credentials: 'include', body: JSON.stringify(body)
        });
      }
      if (!res.ok) { emitResult(requestId, { error: { status: res.status } }); return; }
      const data = await res.json();
      let fc = data;
      if (data && data.encrypted && data.data) {
        const passphrase = data.ecdh && data.serverPubKey
          ? await ecdhPassphrase(data.serverPubKey, keyPair.privateKey, ticket.challengeSeed)
          : '';
        fc = JSON.parse(await decryptStatic(data.data, passphrase));
      }
      // Rekaman situs: geometry null, poligon ada di field "bbox" (GeoJSON
      // geometry) → disalin ke geometry supaya highlight & popup tetap jalan.
      const features = ((fc && fc.features) || []).map(f => {
        if (f && (!f.geometry || !f.geometry.coordinates) && f.bbox && f.bbox.coordinates) {
          return Object.assign({}, f, { geometry: f.bbox });
        }
        return f;
      }).slice(0, 30);
      emitResult(requestId, { features });
    } catch (e) {
      emitResult(requestId, { error: { message: (e && e.message) || 'Identifikasi gagal di tab BHUMI.' } });
    }
  };

  // ── Relai tile persil dari AuroraMaps (24 Okt 2026) ─────────────────────
  // WAF ATR/BPN menolak permintaan cross-site & non-browser, jadi tile WMS
  // diambil dari DALAM halaman BHUMI ini lalu dikembalikan sebagai base64.
  // Hanya tiga endpoint BIDANG_SOURCES yang diizinkan; balasan wajib gambar.
  const TILE_PATHS = ['/mprx/service', '/expapi/bhumigeos/umum/wms', '/expapi/bhumigs/umum/wms', '/expapi/umum/wms'];
  // RTRW Provinsi: WMS gistaru (CORS terbuka, tapi WAJIB Referer bhumi —
  // browser mengirim origin halaman ini otomatis). Tanpa sesi login pun 200.
  const GISTARU_ORIGIN = 'https://gistaru-app.atrbpn.go.id';
  const TILE_MAX_BYTES = 2000000;
  const emitTile = (requestId, payload) => {
    window.postMessage({ type: 'AURORAMAPS_BHUMI_PAGE_TILE_RESULT', requestId, ...payload }, location.origin);
  };
  const toBase64 = (buf) => {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 32768) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    }
    return btoa(bin);
  };
  const handleTile = async ({ requestId, url }) => {
    try {
      const u = new URL(String(url), location.origin);
      const isBhumi = u.origin === location.origin && TILE_PATHS.includes(u.pathname);
      const isGistaru = u.origin === GISTARU_ORIGIN && u.pathname.startsWith('/interoppublic/api/wms/');
      if (!isBhumi && !isGistaru) {
        emitTile(requestId, { url, error: 'URL tile ditolak.' });
        return;
      }
      // gistaru: ACAO '*' tanpa Allow-Credentials → wajib credentials:'omit'.
      const res = await fetch(u.href, { credentials: isGistaru ? 'omit' : 'include' });
      const mime = String(res.headers.get('content-type') || '').split(';')[0].trim();
      if (!res.ok) { emitTile(requestId, { url, error: 'HTTP ' + res.status }); return; }
      if (mime && !mime.startsWith('image/')) {
        emitTile(requestId, { url, error: 'Balasan bukan gambar (' + mime + ')' });
        return;
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > TILE_MAX_BYTES) { emitTile(requestId, { url, error: 'Tile terlalu besar.' }); return; }
      emitTile(requestId, { url, base64: toBase64(buf), mime: mime || 'image/png' });
    } catch (e) {
      emitTile(requestId, { url, error: (e && e.message) || 'fetch tile gagal' });
    }
  };

  // ── Sinkron token BHUMI (24 Okt 2026) ───────────────────────────────────
  // Replika alur token milik situs (chunk 8815: POST /expapi/loginApi
  // {recaptchaToken} → disimpan sebagai localStorage.tokens). Dipicu dari
  // AuroraMaps saat app login supaya pencarian/identifikasi langsung punya
  // token segar. Token lama yang masih berlaku TIDAK disentuh (hemat kuota
  // reCAPTCHA); paksa menyegarkan hanya bila force=true / token kedaluwarsa.
  const RECAPTCHA_SITE_KEY = '6LeHjccpAAAAAIuu12A2UZPZ-11sp6STRRlsx6BX';
  const emitToken = (requestId, payload) => {
    window.postMessage({ type: 'AURORAMAPS_BHUMI_PAGE_TOKEN_RESULT', requestId, ...payload }, location.origin);
  };
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
  // Baca token tersimpan + cek masa berlaku JWT (exp) tanpa menampilkan nilai.
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
  const handleTokenSync = async ({ requestId, force }) => {
    try {
      if (!force && storedTokenFresh()) { emitToken(requestId, { status: 'ok', cached: true }); return; }
      const captcha = await captchaToken('login');
      if (!captcha) {
        emitToken(requestId, { status: 'reCAPTCHA tidak tersedia — selesaikan captcha di peta BHUMI bila muncul, lalu ulangi.' });
        return;
      }
      const res = await fetch('/expapi/loginApi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recaptchaToken: captcha }),
        credentials: 'include'
      });
      if (!res.ok) { emitToken(requestId, { status: 'loginApi HTTP ' + res.status }); return; }
      const data = await res.json();
      const token = typeof data === 'string' ? data : (data && (data.token || data.jwt)) || '';
      if (!token || !/^eyJ/.test(String(token))) {
        emitToken(requestId, { status: 'loginApi membalas token tidak valid.' });
        return;
      }
      try { localStorage.setItem('tokens', String(token)); } catch (_) { /* store diblokir */ }
      savedAuth = ''; // buang captured auth basi — storedAuth() akan baca token baru
      emitToken(requestId, { status: 'ok' });
    } catch (e) {
      emitToken(requestId, { status: String((e && e.message) || e) });
    }
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data || {};
    if (typeof data.requestId !== 'string') return;
    if (data.type === 'AURORAMAPS_BHUMI_PAGE_IDENTIFY') { handleIdentify(data); return; }
    if (data.type === 'AURORAMAPS_BHUMI_PAGE_SEARCH') { handleSearch(data); return; }
    if (data.type === 'AURORAMAPS_BHUMI_PAGE_TILE') handleTile(data);
    if (data.type === 'AURORAMAPS_BHUMI_PAGE_TOKEN_SYNC') handleTokenSync(data);
  });

  // ── Intercap respons getPersil milik situs ───────────────────────────
  const originalJson = Response.prototype.json;
  Response.prototype.json = async function () {
    const url = String(this.url || '');
    const isPersil = /\/expapi\/getPersil(?:\?|$)/.test(url);
    const status = this.status;
    const data = await originalJson.call(this);
    if (!isPersil) return data;
    persilResponseSeen = true;
    if (!this.ok) { emit({ error: { status } }); return data; }
    if (data && data.encrypted && data.data) { handleEncryptedEnvelope(data); return data; }
    const fc = data?.featureCollection || data;
    if (Array.isArray(fc?.features)) emit({ features: fc.features.slice(0, 30) });
    else if (data?.error || data?.message) emit({ error: { status: status || 200 } });
    return data;
  };

  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : String(input?.url || '');
    if (/\/expapi\/getPersil(?:\?|$)/.test(url)) persilResponseSeen = true;
    try { if (init && init.headers) rememberAuth(init.headers); } catch (_) { /* header aneh */ }
    return originalFetch.call(this, input, init);
  };

  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__auroraPersilRequest = /\/expapi\/getPersil(?:\?|$)/.test(String(url));
    return originalXhrOpen.call(this, method, url, ...rest);
  };

  const originalXhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try { if (String(name).toLowerCase() === 'authorization') rememberAuth(value); } catch (_) { /* abaikan */ }
    return originalXhrSetHeader.call(this, name, value);
  };

  const originalXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (this.__auroraPersilRequest) {
      this.addEventListener('load', () => {
        persilResponseSeen = true;
        try {
          const data = this.responseType === 'json' ? this.response : JSON.parse(this.responseText);
          if (this.status >= 200 && this.status < 300) {
            if (data && data.encrypted && data.data) { handleEncryptedEnvelope(data); return; }
            const fc = data?.featureCollection || data;
            if (Array.isArray(fc?.features)) emit({ features: fc.features.slice(0, 30) });
          } else if (this.status < 200 || this.status >= 300) emit({ error: { status: this.status } });
        } catch (_) { /* respons terenkripsi non-JSON → lihat hook decrypt */ }
      }, { once: true });
    }
    return originalXhrSend.apply(this, args);
  };

  const originalDecrypt = SubtleCrypto.prototype.decrypt;
  SubtleCrypto.prototype.decrypt = async function (...args) {
    const result = await originalDecrypt.apply(this, args);
    if (!persilResponseSeen) return result;
    try {
      const text = new TextDecoder().decode(result);
      if (text.length < 2 || text.length > 2_000_000 || text[0] !== '{') return result;
      const fc = JSON.parse(text);
      if (Array.isArray(fc?.features)) emit({ features: fc.features.slice(0, 30) });
    } catch (_) { /* response may be encrypted/non-JSON data */ }
    return result;
  };
})();
