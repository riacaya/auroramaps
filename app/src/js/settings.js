// =====================================================
// AuroraMaps · settings.js — Panel Pengaturan
// Tempat preferensi & fitur jarang dipakai, agar toolbar
// tetap lega: Tampilan, Penyimpanan, Impor & Cetak,
// Lapangan, dan Info.
// =====================================================
'use strict';

const SettingsPanel = {
  // Pemakaian localStorage (hanya awalan gisv_ milik aplikasi).
  _usageHTML() {
    let bytes = 0, items = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k.indexOf('gisv_') !== 0) continue;
        bytes += (k.length + (localStorage.getItem(k) || '').length) * 2; // UTF-16
        items++;
      }
    } catch (e) { /* kuota penuh atau privasi mode */ }
    const size = bytes >= 1048576
      ? (bytes / 1048576).toFixed(2).replace('.', ',') + ' MB'
      : Math.round(bytes / 1024) + ' KB';
    const pct = Math.min(100, Math.round(bytes / 5242880 * 100)); // kuota browser ±5 MB
    return `<div class="set-bar"><div class="set-bar-fill" style="width:${Math.max(pct, 1)}%"></div></div>
      <div>${size} terpakai (± ${pct}%) dari kuota browser ± 5 MB · ${items} data tersimpan</div>`;
  },

  async _tileCount() {
    try {
      const c = await caches.open(OfflineManager.cacheName);
      return (await c.keys()).length;
    } catch (e) { return -1; }
  },

  open() {
    const t = (id) => LanguageUI.t(id);
    const curTheme = State.theme || 'dark';
    const themeOpts = Object.entries(Theme._labels)
      .map(([val, label]) => `<option value="${val}"${val === curTheme ? ' selected' : ''}>${label}</option>`)
      .join('');
    const lang = localStorage.getItem('sm_lang') === 'EN' ? 'EN' : 'ID';
    const layerCount = State.layers.length;
    const featureCount = State.layers.reduce((n, l) => n + (l.featureCount || 0), 0);
    
    const section = (title, inner) => `
      <div class="modal-panel">
        <div class="exp-field-label">${title}</div>
        ${inner}
      </div>`;
    const row = (label, control) => `<div class="set-row"><span>${label}</span>${control}</div>`;

    const html = `
      <div class="modal-stack">
        ${section(t('set-appearance'),
          row(t('set-theme'), `<select class="exp-select set-theme-select">${themeOpts}</select>`)
          + row(t('set-lang'), `<select class="exp-select set-lang-select">
              <option value="ID"${lang === 'ID' ? ' selected' : ''}>Indonesia</option>
              <option value="EN"${lang === 'EN' ? ' selected' : ''}>English</option>
            </select>`))}
        ${section(t('set-storage'),
          `<label class="exp-check">
            <input type="checkbox" id="set-autosave" class="modal-check"${AutoSave.isEnabled() ? ' checked' : ''}/>
            <span class="exp-check-text"><span>${t('set-autosave')}</span>
              <span class="exp-check-help">${t('set-autosave-help')}</span></span>
          </label>
          <div class="set-usage">${this._usageHTML()}</div>
          <div class="set-actions">
            <button class="btn btn-secondary" id="set-clear-autosave">${t('set-clear-autosave')}</button>
            <button class="btn btn-secondary set-clear-tiles-btn">${t('set-clear-tiles')} (<span id="set-tile-count">…</span>)</button>
          </div>`)}
        ${section(t('set-import-print'),
          `<div class="set-note">${t('set-remember-note')}</div>
           <div class="set-actions">
             <button class="btn btn-secondary" id="set-reset-prefs">${t('set-reset-prefs')}</button>
           </div>`)}
        ${section(t('set-field'),
          `<label class="exp-check">
            <input type="checkbox" id="set-gps-nobase" class="modal-check"${Storage.load('gps-coordinate-only', false) === true ? ' checked' : ''}/>
            <span class="exp-check-text"><span>${t('set-gps-nobase')}</span>
              <span class="exp-check-help">${t('set-gps-nobase-help')}</span></span>
          </label>
          <div class="set-actions">
            <button class="btn btn-secondary" id="set-offline-dl">⬇ ${t('set-offline-dl')}</button>
          </div>`)}
        ${section(t('set-info'),
          `<div class="set-note">${t('set-layers-count')}: ${layerCount} · ${t('set-features-count')}: ${featureCount}</div>
${window.AuroraInstall?.canOffer() ? `<div class="set-actions"><button class="btn btn-secondary" id="set-install">📲 ${t('set-install')}</button></div>` : ''}`)}
      </div>`;

    // Tanpa tombol footer — panel sudah punya ikon X di kanan atas.
    Modal.open('⚙ ' + t('set-title'), html, []);
    document.querySelector('#modal-container .modal')?.classList.add('settings-modal');

    const $ = (id) => document.getElementById(id);
    // Select tema/bahasa & tombol hapus tile memakai class — id yang sama
    // persis dengan kunci kamus bahasa akan ditimpa teks oleh LanguageUI.apply().
    document.querySelector('.set-theme-select')?.addEventListener('change', e => {
      Theme.apply(e.target.value);
      Storage.save('theme', e.target.value);
    });
    document.querySelector('.set-lang-select')?.addEventListener('change', e => {
      window.setAuroraLanguage?.(e.target.value);
      this.open(); // render ulang panel dengan bahasa baru
    });
    // Penyimpanan.
    $('set-autosave')?.addEventListener('change', e => {
      AutoSave.setEnabled(e.target.checked);
      Toast.show(e.target.checked ? 'Autosave aktif' : 'Autosave nonaktif', 'info');
    });
    $('set-clear-autosave')?.addEventListener('click', () => {
      Storage.remove('autosave');
      Toast.show('Data autosave dihapus', 'success');
    });
    document.querySelector('.set-clear-tiles-btn')?.addEventListener('click', async () => {
      try { await caches.delete(OfflineManager.cacheName); } catch (e) { /* abaikan */ }
      const el = $('set-tile-count');
      if (el) el.textContent = '0';
      Toast.show('Tile offline dihapus', 'success');
    });
    // Impor & Cetak — kembalikan pilihan terakhir ke bawaan.
    $('set-reset-prefs')?.addEventListener('click', () => {
      Storage.remove('print-prefs');
      Storage.remove('export-prefs');
      // State memori panel cetak ikut dikembalikan (sudah ter-hydrate saat muat).
      Object.assign(Exporter._printState, { widthM: 4, dpi: 50, format: 'png', title: true });
      Toast.show('Setelan cetak & export kembali ke bawaan', 'success');
    });
    // Lapangan.
    $('set-offline-dl')?.addEventListener('click', () => { Modal.close(); OfflineManager.downloadCurrentArea(); });
    $('set-gps-nobase')?.addEventListener('change', e => Storage.save('gps-coordinate-only', e.target.checked));
    // Info - About & Logout tetap di header PC (#btn-about-pc / #btn-logout-pc).
    $('set-install')?.addEventListener('click', () => window.AuroraInstall?.trigger());

    this._tileCount().then(n => {
      const el = $('set-tile-count');
      if (el) el.textContent = n < 0 ? '?' : String(n);
    });
  }
};
