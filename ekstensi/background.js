// =====================================================
// AuroraMaps BHUMI Bridge — background service worker (MV3)
// =====================================================
// Tugas:
//   1. Menjaga SATU jendela halaman pendamping BHUMI tetap hidup.
//      - Belum pernah login → jendela dibuka NORMAL supaya user bisa login
//        ("Saya Setuju") sekali saja.
//      - Sudah pernah login → jendela dibuka/menjadi MINIMIZE — bentuk
//        "hidden" terbaik yang diizinkan Chrome MV3 (tidak ada API tab
//        tersembunyi; iframe diblokir server BHUMI lewat frame-ancestors).
//   2. Merutekan panggilan API dari halaman AuroraMaps (github.io/blog)
//      ke konten halaman BHUMI, lalu membalas hasilnya.
//   3. Alarm tiap menit: ping tab; kalau mati/dibuang (Memory Saver)
//      → buka ulang otomatis dalam kondisi minimize.
// Tidak ada kredensial di sini: sesi login hidup di profil browser lewat
// sidecar-inject.js yang berjalan DI DALAM halaman BHUMI (world MAIN).
const BHUMI_URL = 'https://bhumi.atrbpn.go.id/peta';
const ALARM = 'am-bhumi-keepalive';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const findBhumiTab = async () => {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://bhumi.atrbpn.go.id/*' });
    return tabs.find(t => t.id != null) || null;
  } catch (e) { return null; }
};

const everLoggedIn = async () =>
  (await chrome.storage.local.get('everLoggedIn')).everLoggedIn === true;

// Buka jendela BHUMI. minimized=true → langsung di-minimize (tak terlihat
// sampai user membukanya dari taskbar).
async function openWindow(minimized) {
  const w = await chrome.windows.create({
    url: BHUMI_URL,
    type: 'normal',
    focused: !minimized
  });
  if (minimized) {
    try { await chrome.windows.update(w.id, { state: 'minimized' }); } catch (e) { /* OS menolak */ }
  }
  return w;
}

// Pastikan ada tab BHUMI yang siap menerima pesan → kembalikan tabId.
async function ensureTab(force) {
  let t = await findBhumiTab();
  if (t && !force) return t.id;
  if (force && t) {
    try { await chrome.tabs.remove(t.id); } catch (e) { /* sudah hilang */ }
  }
  const w = await openWindow(await everLoggedIn());
  for (let i = 0; i < 24; i++) {
    await sleep(250);
    const nt = await findBhumiTab();
    if (nt) return nt.id;
  }
  throw new Error('Jendela pendamping BHUMI tidak bisa dibuka.');
}

// Kirim ke tab BHUMI; balasan {ok,data|error} — null bila tab tak menjawab.
function sendToTab(tabId, path, payload, timeoutMs = 70000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      chrome.tabs.sendMessage(tabId, { kind: 'bhumi-call', path, payload },
        (res) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError || !res) finish(null);
          else finish(res);
        });
    } catch (e) { clearTimeout(timer); finish(null); }
  });
}

// Catat login + sembunyikan jendela bila tidak sedang difokus user.
async function afterStatus(data) {
  if (data && data.loggedIn) {
    const prev = await everLoggedIn();
    if (!prev) await chrome.storage.local.set({ everLoggedIn: true });
    const t = await findBhumiTab();
    if (t && t.windowId != null) {
      try {
        const w = await chrome.windows.get(t.windowId);
        if (w && w.focused === false && w.state !== 'minimized') {
          await chrome.windows.update(w.id, { state: 'minimized' });
        }
      } catch (e) { /* abaikan */ }
    }
  }
}

// ── Router: halaman AuroraMaps → tab BHUMI ────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.kind !== 'am-call') return;
  (async () => {
    let res;
    try {
      const tabId = await ensureTab(false);
      res = await sendToTab(tabId, msg.path, msg.payload);
      if (!res) res = await sendToTab(await ensureTab(true), msg.path, msg.payload);
    } catch (e) {
      res = { ok: false, error: String((e && e.message) || e) };
    }
    if (msg.path === '/status' && res && res.ok && res.data) await afterStatus(res.data);
    if (msg.path === '/status' && (!res || !res.ok)) {
      // Status gagal → jangan paksa buka jendela login untuk user baru;
      // cukup laporkan sidecar tidak ada, halaman akan memakai jalur lama.
      res = { ok: false, error: (res && res.error) || 'tab BHUMI tidak siap' };
    }
    return res;
  })().then(sendResponse);
  return true; // balasan async
});

// ── Keepalive tiap menit ──────────────────────────────────────────────────
async function keepalive() {
  const t = await findBhumiTab();
  if (!t) {
    // Tab ditutup/dibuang dan extension sudah pernah login → buka lagi
    // (tersembunyi). Belum pernah login → biarkan, jangan ganggu user.
    if (await everLoggedIn()) { try { await openWindow(true); } catch (e) { /* abaikan */ } }
    return;
  }
  const pong = await new Promise((resolve) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => fin(null), 10000);
    try {
      chrome.tabs.sendMessage(t.id, { kind: 'ping' }, (res) => {
        clearTimeout(timer);
        fin(chrome.runtime.lastError || !res ? null : res);
      });
    } catch (e) { clearTimeout(timer); fin(null); }
  });
  if (!pong) {
    // Tab ada tapi tidak menjawab (discarded/half-dead) → muat ulang;
    // kalau hilang sama sekali, pengulangan alarm berikutnya membukanya lagi.
    try { await chrome.tabs.reload(t.id); } catch (e) { /* abaikan */ }
    return;
  }
  if (pong.data && pong.data.loggedIn) await afterStatus(pong.data);
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) keepalive(); });

function setupAlarm() {
  chrome.alarms.create(ALARM, { periodInMinutes: 1, delayInMinutes: 1 });
}
chrome.runtime.onInstalled.addListener(setupAlarm);
chrome.runtime.onStartup.addListener(setupAlarm);
setupAlarm();
