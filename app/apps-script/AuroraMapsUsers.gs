// =====================================================
// AuroraMaps · AuroraMapsUsers.gs
// API manajemen user untuk Google Spreadsheet login AuroraMaps.
// Aksi: ping · login · register · loglogin · list · add · update · reset · delete
// Auth: akun dengan Status "Administrator" — divalidasi terhadap isi sheet.
//        (kecuali ping, login, register & loglogin yang tanpa auth admin)
// =====================================================
//
// CARA DEPLOY (±3 menit)
//   1. Buka spreadsheet login → menu Ekstensi (Extensions) → Apps Script.
//   2. Hapus isi Code.gs, tempel SELURUH file ini, simpan (Ctrl+S).
//   3. Deploy → New deployment → ikon gerigi ⚙ → Web app:
//        Description    : AuroraMaps Users
//        Execute as     : Me (email Anda)
//        Who has access : Anyone
//      → Deploy → salin URL yang berakhiran /exec.
//   4. Tempel URL itu ke window.USER_ADMIN_API_URL di src/js/config.js.
//   5. Uji dari browser: <URL>?action=ping  →  {"ok":true,"msg":"…siap"}
//
// CARA PANGGIL (dari sisi app / browser)
//   • POST (SATU-SATUNYA untuk aksi admin):  Content-Type: text/plain
//        fetch(URL, { method:'POST', headers:{'Content-Type':'text/plain'},
//                     body: JSON.stringify({ action:'list', admin, adminKey }) })
//   • GET hanya: ping, register, loglogin (tanpa kredensial).
//     Aksi admin via GET ditolak server — adminKey tidak boleh di URL.
//     "login" juga HANYA POST (membawa password di body, bukan query).
//   • Aksi: ping, login{id,key}, list, add{id,key,status},
//           update{id,newId?,key?,status?}, reset{id,key}, delete{id}
//
// CATATAN
//   • Header baris 1 WAJIB: ID, Key, Status (sesuai format sheet AuroraMaps).
//   • Perbandingan username/password tidak case-sensitive utk username,
//     persis (case-sensitive) utk password — sama seperti login di app.
//   • Pelindung: admin terakhir tidak bisa dihapus/diturunkan; percobaan
//     gagal 5× dikunci 5 menit (CacheService).
//   • Bila sheet punya sheet bernama "Log", tiap aksi dicatat di sana.
// =====================================================

// ---- konfigurasi ----
const SHEET_ID = '1wI0ENl2RzrmvprzVyaomIsNmCJzYNJR9KqpWbjTg8kA'; // spreadsheet login AuroraMaps
const SHEET_NAME = '';        // kosongkan = sheet pertama (sama dgn yang dibaca gviz)
const LOG_SHEET = 'Log';      // diabaikan bila tidak ada
const ADMIN_STATUSES = ['administrator', 'admin'];
const REG_LIMIT = 10;            // maksimal pendaftaran per jendela
const REG_WINDOW_SEC = 600;      // jendela pendaftaran (detik)
const MAX_FAIL = 5;           // percobaan gagal sebelum dikunci
const FAIL_WINDOW_SEC = 300;  // durasi kunci (detik)
const HEAD_ID = ['id', 'user', 'username', 'pengguna'];
const HEAD_KEY = ['key', 'pass', 'password', 'sandi', 'kunci'];
const DEFAULT_STATUS = 'User';
const LOGIN_COL = 4;            // kolom "Login Terakhir" (D) - header dibuat otomatis
const LOGIN_HEAD = 'Login Terakhir';
const ACCESS_COL = 5;           // kolom "Akses" (E) - active/block, header dibuat otomatis
const ACCESS_HEAD = 'Akses';

// =====================================================
// ENTRY POINT
// =====================================================
function doGet(e) {
  var p = (e && e.parameter) || {};
  // GET HANYA untuk aksi tanpa kredensial (ping · register · loglogin).
  // Aksi admin (list/add/update/reset/delete/migrate) wajib POST body JSON
  // supaya adminKey & password tidak pernah muncul di URL/log browser.
  var action = String(p.action || 'ping').toLowerCase();
  if (['ping', 'register', 'loglogin'].indexOf(action) < 0) {
    return out_({ ok: false, error: 'Aksi "' + action + '" hanya menerima POST (kredensial tidak boleh lewat URL).' });
  }
  return run_(p, p.callback);
}

function doPost(e) {
  var p = {};
  try {
    p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return out_({ ok: false, error: 'Body harus JSON valid.' });
  }
  if (!p || typeof p !== 'object') p = {};
  return run_(p, p.callback);
}

function run_(p, cb) {
  var action = String(p.action || 'ping').toLowerCase();
  try {
    if (action === 'ping') {
      return out_({ ok: true, msg: 'AuroraMaps user API siap', time: new Date().toISOString() }, cb);
    }
    // Pendaftaran publik dari layar login — TANPA auth admin,
    // tapi selalu ber-Status "User" (tidak pernah Administrator).
    if (action === 'register') {
      var regRes = actRegister_(readUsers_(), p);
      log_(String(p.id || '-'), action, String(p.id || ''), !!regRes.ok, regRes.error || '');
      return out_(regRes, cb);
    }
    // Verifikasi login (id + password) di SERVER — dipanggil layar login
    // sebelum sheet dijadikan private. Tanpa auth admin, tapi rate-limited
    // (5 gagal → kunci 5 menit) dan hanya membalas { ok, status } —
    // password/hash TIDAK pernah dikembalikan.
    if (action === 'login') {
      var lgRes = actLogin_(readUsers_(), p);
      log_(String(p.id || '-'), action, String(p.id || ''), !!lgRes.ok, lgRes.ok ? '' : lgRes.error);
      return out_(lgRes, cb);
    }
    // Catat login terakhir — TANPA auth admin (login sudah diverifikasi app);
    // hanya menulis stempel waktu ke kolom LOGIN_COL, tak menyentuh ID/Key/Status.
    if (action === 'loglogin') {
      var llRes = actLogLogin_(readUsers_(), p);
      log_(String(p.id || '-'), action, String(p.id || ''), !!llRes.ok, llRes.error || '');
      return out_(llRes, cb);
    }
    var users = readUsers_();
    var admin = auth_(users, p);
    if (!admin.ok) {
      log_(String(p.admin || '-'), action, String(p.id || ''), false, admin.error);
      return out_({ ok: false, error: admin.error }, cb);
    }
    var res;
    switch (action) {
      case 'list':
        res = {
          ok: true,
          // jumlah password lama yg masih plaintext (belum di-hash)
          plain: users.filter(function (u) { return !isHash_(u.key); }).length,
          users: users.map(function (u) {
            return { id: u.id, status: u.status, hasKey: !!u.key, access: u.access || 'active' };
          })
        };
        break;
      case 'migrate': res = actMigrate_(users); break;
      case 'add':    res = actAdd_(users, p); break;
      case 'update':
      case 'reset':  res = actUpdate_(users, p, action === 'reset'); break;
      case 'access': res = actAccess_(users, p); break;
      case 'delete': res = actDelete_(users, p); break;
      default:       res = { ok: false, error: 'Aksi tidak dikenal: ' + action };
    }
    if (res.ok) {
      try { SpreadsheetApp.flush(); } catch (e2) { /* abaikan */ }
    }
    log_(admin.user.id, action, String(p.id || ''), !!res.ok, res.error || '');
    return out_(res, cb);
  } catch (err) {
    return out_({ ok: false, error: String((err && err.message) || err) }, cb);
  }
}

// =====================================================
// AUTH — admin dicek langsung terhadap isi sheet
// =====================================================
function auth_(users, p) {
  var id = norm_(p.admin);
  var key = String(p.adminKey == null ? '' : p.adminKey);
  if (!checkFail_(id)) {
    return { ok: false, error: 'Terlalu banyak percobaan gagal. Coba lagi dalam 5 menit.' };
  }
  var u = find_(users, id);
  if (!u || !keyMatches_(u.key, key)) {
    bumpFail_(id);
    return { ok: false, error: 'Username atau password salah.' };
  }
  if (!isAdmin_(u.status)) {
    bumpFail_(id);
    return { ok: false, error: 'Hanya akun Status "Administrator" yang boleh mengelola user.' };
  }
  clearFail_(id);
  // Upgrade otomatis: password lama masih plaintext → langsung di-hash.
  if (!isHash_(u.key)) upgradeKey_(u);
  return { ok: true, user: u };
}

// =====================================================
// HASH (SHA-256 hex) — password disimpan sbg hash, bukan teks/angka
// =====================================================
function sha256hex_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i];
    if (b < 0) b += 256;
    out += (b < 16 ? '0' : '') + b.toString(16);
  }
  return out;
}
function isHash_(v) { return /^[0-9a-f]{64}$/i.test(String(v || '')); }
// Terima HASH (baru) ATAU plaintext (sheet lama) — lalu plaintext di-upgrade
// otomatis oleh auth_(). (Login app sisi klien hanya menerima hash; lihat
// _matchKey di src/js/app.js.)
function keyMatches_(stored, input) {
  if (stored == null || stored === '') return false;
  var s = String(stored);
  if (s === String(input)) return true;
  if (!isHash_(s)) return false;
  return s === sha256hex_(input);
}
// Tulis ulang satu sel key sbg hash (dgn format Teks).
function upgradeKey_(u) {
  try {
    var h = sha256hex_(u.key);
    sheet_().getRange(u.row, 2).setNumberFormat('@').setValue(h);
    u.key = h;
    SpreadsheetApp.flush();
  } catch (e) { /* kegagalan upgrade tak boleh merusak auth */ }
}

function isAdmin_(status) {
  return ADMIN_STATUSES.indexOf(String(status || '').trim().toLowerCase()) >= 0;
}

// =====================================================
// AKSI
// =====================================================
function actAdd_(users, p) {
  var id = String(norm_(p.id));
  var key = String(p.key == null ? '' : p.key);
  var status = norm_(p.status) || DEFAULT_STATUS;
  var bad = validId_(id) || validKey_(key) || validStatus_(status);
  if (bad) return { ok: false, error: bad };
  if (find_(users, id)) return { ok: false, error: 'User "' + id + '" sudah ada.' };
  var stored = sha256hex_(key); // simpan HASH — password tak terbaca & bukan angka
  var sh = sheet_();
  sh.appendRow([id, '', status]);
  // appendRow dgn format General bisa mengubah nilai jadi ANGKA.
  // Set kolom jadi Teks dulu, lalu tulis isinya.
  var row = sh.getLastRow();
  var rng = sh.getRange(row, 1, 1, 3);
  rng.setNumberFormat('@');
  rng.setValues([[id, stored, status]]);
  return { ok: true, msg: 'User "' + id + '" ditambahkan.' };
}

// Pendaftaran publik (dipanggil tombol "Daftar" di layar login).
// Tanpa auth admin, tapi selalu Status "User" + dibatasi rate-limit.
function actRegister_(users, p) {
  if (!checkReg_()) {
    return { ok: false, error: 'Terlalu banyak pendaftaran. Coba lagi beberapa menit lagi.' };
  }
  var id = String(norm_(p.id));
  var key = String(p.key == null ? '' : p.key);
  var bad = validId_(id) || validKey_(key);
  if (bad) return { ok: false, error: bad };
  if (find_(users, id)) return { ok: false, error: 'Username "' + id + '" sudah dipakai.' };
  var sh = sheet_();
  sh.appendRow([id, '', DEFAULT_STATUS]);
  var row = sh.getLastRow();
  var rng = sh.getRange(row, 1, 1, 3);
  rng.setNumberFormat('@');
  rng.setValues([[id, sha256hex_(key), DEFAULT_STATUS]]);
  bumpReg_();
  try { SpreadsheetApp.flush(); } catch (e) { /* abaikan */ }
  return { ok: true, msg: 'Username "' + id + '" terdaftar — silakan tekan Login.' };
}
function checkReg_() {
  try { return Number(CacheService.getScriptCache().get('aurora_reg') || 0) < REG_LIMIT; }
  catch (e) { return true; }
}
function bumpReg_() {
  try {
    var c = CacheService.getScriptCache();
    var n = Number(c.get('aurora_reg') || 0) + 1;
    c.put('aurora_reg', String(n), REG_WINDOW_SEC);
  } catch (e) { /* abaikan */ }
}

// Verifikasi login dari layar login (TANPA auth admin).
// Membalas { ok:true, id, status } ATAU { ok:false, error } — keduanya
// selalu membawa login:true sbg penanda "jawaban definitif" (app tidak
// lagi mengecek cadangan gviz/cache bila skrip ini yang menjawab).
// Pesan gagal disatukan ("Username atau password salah.") supaya tidak
// membocorkan apakah id terdaftar. Rate-limited per id.
function actLogin_(users, p) {
  var id = norm_(p.id);
  var key = String(p.key == null ? '' : p.key);
  if (!id || !key) return { ok: false, login: true, error: 'Username dan password wajib diisi.' };
  if (!checkFail_(id)) {
    return { ok: false, login: true, error: 'Terlalu banyak percobaan gagal. Coba lagi dalam 5 menit.' };
  }
  var u = find_(users, id);
  if (!u || !keyMatches_(u.key, key)) {
    bumpFail_(id);
    return { ok: false, login: true, error: 'Username atau password salah.' };
  }
  // Kolom Akses: "block" = akun diblokir administrator (kosong/active = boleh).
  if (String(u.access || 'active').trim().toLowerCase() === 'block') {
    clearFail_(id);
    return { ok: false, login: true, error: 'Akun Anda diblokir oleh administrator.' };
  }
  clearFail_(id);
  // Upgrade otomatis: password lama masih plaintext → langsung di-hash.
  if (!isHash_(u.key)) upgradeKey_(u);
  return { ok: true, login: true, id: u.id, status: u.status };
}

// Catat waktu login terakhir — dipanggil app SETELAH login sukses
// (fire-and-forget). Menulis stempel waktu "dd/MM/yyyy HH:mm:ss" ke
// kolom LOGIN_COL pada baris user; header kolom dibuat otomatis bila kosong.
function actLogLogin_(users, p) {
  var target = find_(users, norm_(p.id));
  if (!target) return { ok: false, error: 'User "' + norm_(p.id) + '" tidak ditemukan.' };
  var sh = sheet_();
  if (!sh.getRange(1, LOGIN_COL).getValue()) {
    sh.getRange(1, LOGIN_COL).setNumberFormat('@').setValue(LOGIN_HEAD);
  }
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
  sh.getRange(target.row, LOGIN_COL).setNumberFormat('@').setValue(stamp);
  try { SpreadsheetApp.flush(); } catch (e) { /* abaikan */ }
  return { ok: true };
}

// Ganti SEMUA password plaintext jadi hash (dipanggil panel saat membuka daftar).
function actMigrate_(users) {
  var sh = sheet_();
  var n = 0;
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (isHash_(u.key)) continue;
    sh.getRange(u.row, 2).setNumberFormat('@').setValue(sha256hex_(u.key));
    n++;
  }
  if (n) SpreadsheetApp.flush();
  return { ok: true, msg: n + ' password di-hash (SHA-256).' };
}

function actUpdate_(users, p, resetOnly) {
  var target = find_(users, norm_(p.id));
  if (!target) return { ok: false, error: 'User "' + norm_(p.id) + '" tidak ditemukan.' };

  var newId = p.newId == null ? target.id : String(norm_(p.newId));
  // key dari input → di-HASH dulu; tanpa input pakai nilai tersimpan apa adanya.
  var keyFromInput = p.key != null;
  var plainKey = keyFromInput ? String(p.key) : '';
  var newKey = keyFromInput ? sha256hex_(plainKey) : target.key;
  var newStatus = p.status == null ? target.status : String(norm_(p.status)) || DEFAULT_STATUS;

  if (resetOnly) {
    newId = target.id;
    newStatus = target.status;
    if (p.key == null) return { ok: false, error: 'Parameter key wajib diisi untuk reset.' };
  }

  var bad = validId_(newId) || (keyFromInput ? validKey_(plainKey) : '') || validStatus_(newStatus);
  if (bad) return { ok: false, error: bad };

  var dup = find_(users, newId);
  if (dup && dup.row !== target.row) return { ok: false, error: 'User "' + newId + '" sudah ada.' };

  var demotingAdmin = isAdmin_(target.status) && !isAdmin_(newStatus);
  if (demotingAdmin && adminCount_(users, target.id) === 0) {
    return { ok: false, error: 'Tidak boleh menurunkan admin terakhir.' };
  }

  var sh = sheet_();
  // setNumberFormat('@') dulu supaya nilai disimpan sbg TEKS — tanpa ini
  // reset password "0000" tersimpan sebagai angka 0 dan login jadi gagal.
  if (newId !== target.id) sh.getRange(target.row, 1).setNumberFormat('@').setValue(newId);
  if (newKey !== target.key) sh.getRange(target.row, 2).setNumberFormat('@').setValue(newKey);
  if (newStatus !== target.status) sh.getRange(target.row, 3).setNumberFormat('@').setValue(newStatus);
  return { ok: true, msg: 'User "' + target.id + '" diperbarui.' };
}

function actAccess_(users, p) {
  var target = find_(users, norm_(p.id));
  if (!target) return { ok: false, error: 'User "' + norm_(p.id) + '" tidak ditemukan.' };
  var access = String(p.access == null ? '' : p.access).trim().toLowerCase();
  if (access !== 'active' && access !== 'block') {
    return { ok: false, error: 'Nilai akses harus "active" atau "block".' };
  }
  // Larang memblokir admin terakhir agar tidak terkunci dari pengelolaan.
  if (access === 'block' && isAdmin_(target.status) && adminCount_(users, target.id) === 0) {
    return { ok: false, error: 'Tidak boleh memblokir admin terakhir.' };
  }
  var sh = sheet_();
  // Pastikan header kolom Akses ada.
  if (!sh.getRange(1, ACCESS_COL).getValue()) {
    sh.getRange(1, ACCESS_COL).setNumberFormat('@').setValue(ACCESS_HEAD);
  }
  sh.getRange(target.row, ACCESS_COL).setNumberFormat('@').setValue(access);
  try { SpreadsheetApp.flush(); } catch (e) { /* abaikan */ }
  return { ok: true, msg: 'Akses "' + target.id + '" diubah ke ' + access + '.' };
}

function actDelete_(users, p) {
  var target = find_(users, norm_(p.id));
  if (!target) return { ok: false, error: 'User "' + norm_(p.id) + '" tidak ditemukan.' };
  if (isAdmin_(target.status) && adminCount_(users, target.id) === 0) {
    return { ok: false, error: 'Tidak boleh menghapus admin terakhir.' };
  }
  sheet_().deleteRow(target.row);
  return { ok: true, msg: 'User "' + target.id + '" dihapus.' };
}

// =====================================================
// UTIL SHEET
// =====================================================
function sheet_() {
  var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet tidak terbaca — isi SHEET_ID di bagian konfigurasi.');
  if (SHEET_NAME) {
    var byName = ss.getSheetByName(SHEET_NAME);
    if (!byName) throw new Error('Sheet "' + SHEET_NAME + '" tidak ada.');
    return byName;
  }
  var sheets = ss.getSheets();
  if (!sheets || !sheets.length) throw new Error('Spreadsheet tanpa sheet.');
  return sheets[0]; // sheet pertama — sama dengan yang dibaca gviz saat login
}

function readUsers_() {
  var vals = sheet_().getDataRange().getValues();
  if (!vals || !vals.length) throw new Error('Sheet kosong.');
  var h0 = String(vals[0][0] == null ? '' : vals[0][0]).trim().toLowerCase();
  var h1 = String(vals[0][1] == null ? '' : vals[0][1]).trim().toLowerCase();
  if (HEAD_ID.indexOf(h0) < 0 || HEAD_KEY.indexOf(h1) < 0) {
    throw new Error('Header baris 1 harus "ID","Key","Status".');
  }
  // Kolom Akses (active/block) opsional - kosong = active (kompatibel sheet lama).
  var accessIdx = -1;
  var h2 = String(vals[0][2] == null ? '' : vals[0][2]).trim().toLowerCase();
  var h3 = String(vals[0][3] == null ? '' : vals[0][3]).trim().toLowerCase();
  var h4 = String(vals[0][4] == null ? '' : vals[0][4]).trim().toLowerCase();
  if (h4 === 'akses' || h4 === 'access' || h4 === 'blokir' || h4 === 'block') accessIdx = 4;
  else if (h3 === 'akses' || h3 === 'access' || h3 === 'blokir' || h3 === 'block') accessIdx = 3;
  else if (h2 === 'akses' || h2 === 'access' || h2 === 'blokir' || h2 === 'block') accessIdx = 2;
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    var id = String(vals[r][0] == null ? '' : vals[r][0]).trim();
    if (!id) continue;
    var access = accessIdx >= 0 ? String(vals[r][accessIdx] == null ? '' : vals[r][accessIdx]).trim().toLowerCase() : 'active';
    if (access !== 'block') access = 'active';
    out.push({
      id: id,
      key: String(vals[r][1] == null ? '' : vals[r][1]),
      status: String(vals[r][2] == null ? '' : vals[r][2]).trim(),
      access: access,
      row: r + 1
    });
  }
  return out;
}

function find_(users, id) {
  var want = String(id || '').trim().toLowerCase();
  if (!want) return null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].id.toLowerCase() === want) return users[i];
  }
  return null;
}

function adminCount_(users, exceptId) {
  var except = String(exceptId || '').toLowerCase();
  var n = 0;
  for (var i = 0; i < users.length; i++) {
    if (isAdmin_(users[i].status) && users[i].id.toLowerCase() !== except) n++;
  }
  return n;
}

// =====================================================
// VALIDASI
// =====================================================
function validId_(v) {
  if (!/^[A-Za-z0-9._@-]{2,40}$/.test(v)) {
    return 'Username 2–40 karakter, huruf/angka/. _ @ - saja (tanpa spasi).';
  }
  return '';
}
function validKey_(v) {
  if (v.length < 4 || v.length > 64) return 'Password minimal 4, maksimal 64 karakter.';
  if (/[\r\n]/.test(v)) return 'Password tidak boleh berisi baris baru.';
  return '';
}
function validStatus_(v) {
  if (!v) return 'Status tidak boleh kosong.';
  if (v.length > 32) return 'Status maksimal 32 karakter.';
  return '';
}
function norm_(v) {
  return String(v == null ? '' : v).trim();
}

// =====================================================
// RATE LIMIT (gagal 5× → kunci 5 menit)
// =====================================================
function failKey_(admin) {
  return 'aurora_fail_' + String(admin || '').toLowerCase();
}
function checkFail_(admin) {
  try {
    var n = Number(CacheService.getScriptCache().get(failKey_(admin)) || 0);
    return n < MAX_FAIL;
  } catch (e) { return true; }
}
function bumpFail_(admin) {
  try {
    var c = CacheService.getScriptCache();
    var k = failKey_(admin);
    var n = Number(c.get(k) || 0) + 1;
    c.put(k, String(n), FAIL_WINDOW_SEC);
  } catch (e) { /* abaikan */ }
}
function clearFail_(admin) {
  try { CacheService.getScriptCache().remove(failKey_(admin)); } catch (e) { /* abaikan */ }
}

// =====================================================
// LOG (opsional — hanya bila sheet "Log" ada)
// =====================================================
function log_(admin, action, target, ok, detail) {
  try {
    var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss && ss.getSheetByName(LOG_SHEET);
    if (!sh) return;
    sh.appendRow([new Date(), String(admin || '-'), String(action || '-'), String(target || '-'), ok ? 'OK' : 'GAGAL', String(detail || '')]);
  } catch (e) { /* logging tidak boleh merusak aksi */ }
}

// =====================================================
// OUTPUT (JSON / JSONP)
// =====================================================
function out_(obj, callback) {
  var text = JSON.stringify(obj);
  var cb = String(callback || '').trim();
  if (cb && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + text + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}
