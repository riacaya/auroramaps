// =====================================================
// AuroraMaps · adminPanel.js — Panel Administrator
// =====================================================
// Menampilkan semua id di sheet login, dengan dua aksi:
//   • Reset password menjadi 0000   → Apps Script action "reset"
//   • Hapus id                      → Apps Script action "delete"
// Hanya terbuka untuk akun Status "Administrator" (hasil login dari sheet).
//   • PC  : tombol shield di header, di sebelah kiri tombol Logout
//   • HP  : baris "Administrator" di dalam panel Menu (☰)
// Transport: GET + query (endpoint membalas Access-Control-Allow-Origin: *).
// =====================================================
'use strict';

const AdminPanel = {
  ROLE_KEY: 'auroramaps-user-role',        // localStorage — diisi app.js saat login
  USER_KEY: 'auroramaps-current-user',
  CTX_KEY: 'auroramaps-admin-ctx',         // sessionStorage — ikut tutup saat tab ditutup
  RESET_KEY: '0000',

  // ── izin ─────────────────────────────────────────────
  isAdmin() {
    try {
      const role = String(localStorage.getItem(this.ROLE_KEY) || '').trim().toLowerCase();
      return role === 'administrator' || role === 'admin';
    } catch (e) { return false; }
  },
  // Tampilkan/sembunyikan tombol header PC sesuai peran.
  sync() {
    try { document.body.classList.toggle('is-admin', this.isAdmin()); } catch (e) { /* ignore */ }
  },

  // ── kredensial admin (untuk memanggil Apps Script) ──
  _ctx() {
    try {
      const c = JSON.parse(sessionStorage.getItem(this.CTX_KEY) || 'null');
      if (c && c.user) return c;
    } catch (e) { /* ignore */ }
    let user = '';
    try { user = String(localStorage.getItem(this.USER_KEY) || '').trim().toLowerCase(); } catch (e) { /* ignore */ }
    return user ? { user: user, pass: '' } : null;
  },

  // ── transport ke Apps Script ────────────────────────
  async _api(action, params) {
    const base = String(window.USER_ADMIN_API_URL || '').trim();
    if (!base) throw new Error('USER_ADMIN_API_URL belum diisi di config.js.');
    const ctx = this._ctx();
    if (!ctx) throw new Error('Sesi admin tidak ada — logout lalu login ulang.');
    if (!ctx.pass) throw new Error('Password administrator belum dimasukkan.');
    const q = new URLSearchParams();
    q.set('action', action);
    q.set('admin', ctx.user);
    q.set('adminKey', ctx.pass);
    Object.keys(params || {}).forEach(k => q.set(k, params[k]));
    const res = await fetch(base + '?' + q.toString(), { cache: 'no-store', redirect: 'follow' });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('Respons server bukan JSON.'); }
    if (!data.ok) throw new Error(data.error || 'Permintaan ditolak server.');
    return data;
  },

  // ── buka panel ──────────────────────────────────────
  open() {
    if (!this.isAdmin()) {
      Toast.show('Panel ini hanya untuk akun Administrator.', 'warn');
      return;
    }
    if (!String(window.USER_ADMIN_API_URL || '').trim()) {
      Toast.show('USER_ADMIN_API_URL belum diisi di config.js.', 'error');
      return;
    }
    Modal.open('👑 Administrator:', '<div id="admin-user-list" class="admin-user-list"><div class="admin-status">Membaca daftar user…</div></div>', [
      { label: 'Muat ulang', cls: 'btn-secondary', action: () => this.refresh() },
      { label: 'Tutup', cls: 'btn-secondary', action: () => Modal.close() }
    ]);
    this.refresh();
  },

  async refresh() {
    const box = document.getElementById('admin-user-list');
    if (!box) return;
    if (!this._ctx() || !this._ctx().pass) {
      box.innerHTML = this._unlockHtml();
      this._bindUnlock();
      return;
    }
    box.innerHTML = '<div class="admin-status">Membaca daftar user…</div>';
    try {
      const data = await this._api('list');
      // Upgrade otomatis: bila masih ada password lama (plaintext), hash dulu.
      if (data.plain > 0) {
        box.innerHTML = '<div class="admin-status">Meng-hash ' + data.plain + ' password lama…</div>';
        await this._api('migrate');
        Toast.show(data.plain + ' password lama di-hash (SHA-256).', 'success');
        const again = await this._api('list');
        this._render(again.users || []);
        return;
      }
      this._render(data.users || []);
    } catch (err) {
      box.innerHTML = '<div class="admin-status admin-error">' + this._esc(err.message) + '</div>' +
        '<div class="admin-retry"><button type="button" class="admin-act" id="admin-retry">Coba lagi</button></div>';
      document.getElementById('admin-retry')?.addEventListener('click', () => this.refresh());
    }
  },

  // ── daftar user + tombol aksi ───────────────────────
  _render(users) {
    const box = document.getElementById('admin-user-list');
    if (!box) return;
    if (!users.length) {
      box.innerHTML = '<div class="admin-status">Belum ada id di sheet login.</div>';
      return;
    }
    box.innerHTML = users.map(u => {
      const id = this._esc(u.id);
      const status = this._esc(u.status || 'User');
      const admin = /^(administrator|admin)$/i.test(String(u.status || ''));
      const badge = status + (u.hasKey ? '' : ' · tanpa password');
      return '<div class="atrbpn-row admin-user-row" data-id="' + id + '">' +
        '<div class="admin-user-info">' +
          '<span class="atrbpn-name">' + id + '</span>' +
          '<span class="admin-user-badge' + (admin ? ' is-admin' : '') + '">' + badge + '</span>' +
        '</div>' +
        '<div class="admin-user-actions">' +
          '<button type="button" class="admin-act admin-act-reset" data-act="reset" title="Reset password menjadi ' + this.RESET_KEY + '">Reset ' + this.RESET_KEY + '</button>' +
          '<button type="button" class="admin-act admin-act-del" data-act="delete" title="Hapus id ini dari sheet">Hapus</button>' +
        '</div>' +
      '</div>';
    }).join('');
    box.onclick = (e) => this._onAction(e);
  },

  async _onAction(e) {
    const btn = e.target.closest?.('button[data-act]');
    if (!btn || btn.disabled) return;
    const row = btn.closest('.admin-user-row');
    const id = row?.dataset?.id;
    if (!id) return;
    const act = btn.dataset.act;
    const msg = act === 'reset'
      ? 'Reset password "' + id + '" menjadi ' + this.RESET_KEY + '?'
      : 'Hapus id "' + id + '" dari sheet login? Tidak bisa dibatalkan.';
    if (!confirm(msg)) return;
    btn.disabled = true;
    try {
      const data = act === 'reset'
        ? await this._api('reset', { id: id, key: this.RESET_KEY })
        : await this._api('delete', { id: id });
      Toast.show(data.msg || 'Selesai.', 'success');
      await this.refresh();
    } catch (err) {
      Toast.show(err.message, 'error');
      btn.disabled = false;
    }
  },

  // ── minta password bila sesi tidak menyimpannya ─────
  _unlockHtml() {
    return '<form class="admin-unlock" id="admin-unlock-form">' +
      '<div class="admin-status">Masukkan password akun Administrator untuk membaca daftar id.</div>' +
      '<input type="password" id="admin-unlock-pass" class="admin-unlock-input" placeholder="Password" autocomplete="current-password" required>' +
      '<button type="submit" class="btn btn-primary">Buka daftar</button>' +
      '</form>';
  },
  _bindUnlock() {
    const form = document.getElementById('admin-unlock-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const pass = document.getElementById('admin-unlock-pass')?.value || '';
      const user = String(localStorage.getItem(this.USER_KEY) || '').trim().toLowerCase();
      if (!user || !pass) { Toast.show('Password tidak boleh kosong.', 'warn'); return; }
      try { sessionStorage.setItem(this.CTX_KEY, JSON.stringify({ user: user, pass: pass })); } catch (err) { /* ignore */ }
      this.refresh();
    }, { once: true });
  },

  // escape untuk atribut HTML (Utils.escapeHtml tidak mengescape kutip)
  _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  init() {
    this.sync();
    document.getElementById('btn-admin-pc')?.addEventListener('click', () => this.open());
  }
};

// Ekspos ke window: const tingkat-atas script klasik TIDAK otomatis jadi
// properti window, padahal app.js memanggil window.AdminPanel.*
window.AdminPanel = AdminPanel;

AdminPanel.init();
