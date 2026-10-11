// =====================================================
// AuroraMaps · theme.js — Theme + Language UI
// =====================================================
'use strict';

// =====================================================
// THEME MANAGER
// =====================================================
const Theme = {
  _labels: { dark: 'Dark', light: 'Light', senja: 'Senja' },
  _icon(t) {
    const svg = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px" aria-hidden="true">${inner}</svg>`;
    const sun = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
    const sunrise = '<path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="8 6 12 2 16 6"/>';
    const moon = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    return t === 'dark' ? svg(moon) : t === 'senja' ? svg(sunrise) : svg(sun);
  },
  _syncBadge(theme) {
    const badge = document.getElementById('mm-theme-badge');
    if (badge) badge.textContent = this._labels[theme] || theme;
  },

  toggle() {
    const cycle = ['dark', 'light', 'senja'];
    const idx = cycle.indexOf(State.theme);
    State.theme = cycle[(idx + 1) % cycle.length];
    document.documentElement.setAttribute('data-theme', State.theme);
    document.getElementById('btn-theme').innerHTML = this._icon(State.theme);
    Storage.save('theme', State.theme);
    AppConsole.log(`Theme: ${State.theme}`, 'info');
    this._syncBadge(State.theme);
  },

  apply(theme) {
    State.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('btn-theme').innerHTML = this._icon(theme);
    this._syncBadge(theme);
  }
};

// =====================================================
// LANGUAGE UI
// =====================================================
const LanguageUI = {
  current: 'ID',
  t(id) {
    return this.labels[this.current]?.[id] || this.labels.ID[id] || id;
  },
  labels: {
    ID: {
      'tb-open': 'Buka',
      'tb-open-project': 'Buka Proyek',
      'tb-save-project': 'Simpan Proyek',
      'tb-img-overlay': 'Overlay',
      'tb-import-url': 'URL',
      'tb-screenshot': 'Screenshot',
      'tb-export': 'Export',
      'tb-zoom-all': 'Fit All',
      'mm-open': 'Open',
      'mm-open-project': 'Buka Proyek',
      'mm-save-project': 'Simpan Proyek',
      'mm-overlay': 'Overlay',
      'mm-import-url': 'Import URL',
      'mm-export': 'Export',

      'mm-layers': 'Layer Manager',
      'mm-fit-all': 'Fit All',
      'mm-atrbpn': 'ATRBPN',
      'mm-attr': 'Atribut',
      'mm-lang': 'Bahasa',
      'mm-theme': 'Theme',
      'modal-export-title': 'Export Data',
      'modal-export-vector': 'Data Vektor',
      'modal-export-scope': 'Cakupan Export',
      'modal-export-all-scope': 'Semua',
      'modal-export-all-scope-help': 'Semua bidang digabung menjadi satu file untuk setiap format.',
      'modal-export-layer-scope': 'Per bidang',
      'modal-export-layer-scope-help': 'Buat file terpisah untuk setiap bidang pada setiap format.',
      'modal-export-formats': 'Format File',
      'modal-export-json': 'JSON / GeoJSON',
      'modal-export-json-help': 'Vektor standar dengan atribut lengkap.',
      'modal-export-kml-help': 'Format Google Earth / Google Maps.',
      'modal-export-kmz-help': 'KML terkompresi ZIP.',
      'modal-export-excel': 'Excel',
      'modal-export-excel-help': 'Tabel atribut (XLSX).',
      'modal-export-kml-poly': 'KML Poligon (bersih)',
      'modal-export-kml-poly-help': 'Hanya geometri poligon, properti dibersihkan.',
      'modal-export-sum-layer': 'layer',
      'modal-export-sum-feature': 'fitur',
      'modal-export-sum-file': 'file',
      'modal-export-batch-help': 'Pilih cakupan dan satu atau beberapa format, lalu proses export.',
      'modal-export-batch-confirm': '📥 Proses Export',
      'modal-export-format': 'Format',
      'modal-export-all': 'Semua Layer',
      'modal-export-confirm': '📥 Export Vektor',
      'modal-import-title': 'Import dari URL',
      'modal-import-desc': 'Masukkan URL publik ke file GeoJSON. CORS harus diaktifkan di server.',
      'modal-import-load': 'Load',
      'modal-import-cancel': 'Batal',
      'modal-merge-title': 'Gabung Layer',
      'modal-merge-select-all': 'Pilih semua',
      'modal-merge-ok': '⊕ Gabung',
      'modal-merge-cancel': 'Batal',
    },
    EN: {
      'tb-open': 'Open',
      'tb-open-project': 'Open Project',
      'tb-save-project': 'Save Project',
      'tb-img-overlay': 'Overlay',
      'tb-import-url': 'URL',
      'tb-screenshot': 'Screenshot',
      'tb-export': 'Export',
      'tb-zoom-all': 'Fit All',
      'mm-open': 'Open',
      'mm-open-project': 'Open Project',
      'mm-save-project': 'Save Project',
      'mm-overlay': 'Overlay',
      'mm-import-url': 'Import URL',
      'mm-export': 'Export',

      'mm-layers': 'Layer Manager',
      'mm-fit-all': 'Fit All',
      'mm-atrbpn': 'ATRBPN',
      'mm-attr': 'Attributes',
      'mm-lang': 'Language',
      'mm-theme': 'Theme',
      'modal-export-title': 'Export Data',
      'modal-export-vector': 'Vector Data',
      'modal-export-scope': 'Export Scope',
      'modal-export-all-scope': 'All',
      'modal-export-all-scope-help': 'Combine all fields into one file for each format.',
      'modal-export-layer-scope': 'Per field',
      'modal-export-layer-scope-help': 'Create a separate file for each field in each format.',
      'modal-export-formats': 'File Formats',
      'modal-export-json': 'JSON / GeoJSON',
      'modal-export-json-help': 'Standard vector with full attributes.',
      'modal-export-kml-help': 'Google Earth / Google Maps format.',
      'modal-export-kmz-help': 'ZIP-compressed KML.',
      'modal-export-excel': 'Excel',
      'modal-export-excel-help': 'Attribute table (XLSX).',
      'modal-export-kml-poly': 'KML Polygon (clean)',
      'modal-export-kml-poly-help': 'Polygon geometry only, properties cleaned.',
      'modal-export-sum-layer': 'layers',
      'modal-export-sum-feature': 'features',
      'modal-export-sum-file': 'files',
      'modal-export-batch-help': 'Pick a scope and one or more formats, then process the export.',
      'modal-export-batch-confirm': '📥 Process Export',
      'modal-export-format': 'Format',
      'modal-export-all': 'All Layers',
      'modal-export-confirm': '📥 Export Vector',
      'modal-import-title': 'Import from URL',
      'modal-import-desc': 'Enter a public URL to a GeoJSON file. CORS must be enabled on the server.',
      'modal-import-load': 'Load',
      'modal-import-cancel': 'Cancel',
      'modal-merge-title': 'Merge Layers',
      'modal-merge-select-all': 'Select all',
      'modal-merge-ok': '⊕ Merge',
      'modal-merge-cancel': 'Cancel',
    }
  },
  apply(lang) {
    this.current = lang === 'EN' ? 'EN' : 'ID';
    const dict = this.labels[lang] || this.labels.ID;
    document.documentElement.lang = lang === 'EN' ? 'en' : 'id';
    const badge = document.getElementById('mm-lang-badge');
    if (badge) badge.textContent = lang;
    Object.entries(dict).forEach(([id, label]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id.startsWith('tb-')) {
        const icon = el.querySelector('.tb-icon');
        if (icon) el.innerHTML = `<span class="tb-icon">${icon.innerHTML}</span> ${label}`;
      } else if (id.startsWith('mm-')) {
        const icon = el.querySelector('.mm-item-icon');
        const badgeEl = el.querySelector('.mm-item-badge');
        const badgeId = badgeEl?.id ? ` id="${badgeEl.id}"` : '';
        el.innerHTML = `<span class="mm-item-icon">${icon ? icon.innerHTML : ''}</span><span class="mm-item-text">${label}</span>${badgeEl ? `<span class="mm-item-badge"${badgeId}>${badgeEl.textContent}</span>` : ''}`;
      } else {
        el.textContent = label;
      }
    });
    const titles = lang === 'EN'
      ? {
          'tb-open': 'Open File',
          'tb-img-overlay': 'Image overlay reference',
          'tb-import-url': 'Import from URL',
          'tb-screenshot': 'Export map as image',
          'tb-export': 'Export Data',
          'tb-zoom-all': 'Zoom to All Layers',
          'mm-attr': 'Show all attributes',
          'mm-lang': 'Toggle language',
        }
      : {
          'tb-open': 'Buka File',
          'tb-img-overlay': 'Overlay gambar referensi',
          'tb-import-url': 'Impor dari URL',
          'tb-screenshot': 'Ekspor peta sebagai gambar',
          'tb-export': 'Export Data',
          'tb-zoom-all': 'Zoom ke Semua Layer',
          'mm-attr': 'Tampilkan semua atribut',
          'mm-lang': 'Ganti bahasa',
        };
    Object.entries(titles).forEach(([id, title]) => {
      const el = document.getElementById(id);
      if (el) el.title = title;
    });

    const setText = (selector, text) => {
      const el = document.querySelector(selector);
      if (el) el.textContent = text;
    };
    const setPlaceholder = (selector, text) => {
      const el = document.querySelector(selector);
      if (el) el.placeholder = text;
    };

    const visibleText = lang === 'EN' ? {
      '#status-ready': 'Ready',
      '#status-selected': '0 features',
      '#status-layers': '0',
      '#status-fps': '—',
      '#sidebar-left .sidebar-tab[data-target="panel-layers"]': 'Layers',
      '#sidebar-left .sidebar-tab[data-target="panel-files"]': 'Files',
      '#sidebar-left .sidebar-tab[data-target="panel-bookmarks"]': 'Bookmarks',
      '#panel-layers .panel-title': 'Layer Manager',
      '#panel-files .panel-title': 'File Explorer',
      '#panel-bookmarks .panel-title': 'Bookmarks',
      '#panel-props .panel-title': 'Edit',
      '#panel-style .panel-title': 'Style Editor',
      '#panel-geom .panel-title': 'Geometry Info',
      '#panel-stats .panel-title': 'Statistics',
      '#panel-meta .panel-title': 'Metadata',
      '#bottom-panel .bottom-tab[data-target="bp-attrtable"]': 'Attribute Table',
      '#bottom-panel .bottom-tab[data-target="bp-json"]': 'JSON Viewer',
      '#bottom-panel .bottom-tab[data-target="bp-console"]': 'Console',
      '#bottom-panel .bottom-tab[data-target="bp-coords"]': 'Coordinates',
    } : {
      '#status-ready': 'Siap',
      '#status-selected': '0 fitur',
      '#status-layers': '0',
      '#status-fps': '—',
      '#sidebar-left .sidebar-tab[data-target="panel-layers"]': 'Layers',
      '#sidebar-left .sidebar-tab[data-target="panel-files"]': 'File',
      '#sidebar-left .sidebar-tab[data-target="panel-bookmarks"]': 'Bookmark',
      '#panel-layers .panel-title': 'Manajer Layer',
      '#panel-files .panel-title': 'Penjelajah File',
      '#panel-bookmarks .panel-title': 'Bookmark',
      '#panel-props .panel-title': 'Edit',
      '#panel-style .panel-title': 'Editor Style',
      '#panel-geom .panel-title': 'Info Geometri',
      '#panel-stats .panel-title': 'Statistik',
      '#panel-meta .panel-title': 'Metadata',
      '#bottom-panel .bottom-tab[data-target="bp-attrtable"]': 'Tabel Atribut',
      '#bottom-panel .bottom-tab[data-target="bp-json"]': 'JSON Viewer',
      '#bottom-panel .bottom-tab[data-target="bp-console"]': 'Console',
      '#bottom-panel .bottom-tab[data-target="bp-coords"]': 'Koordinat',
    };
    Object.entries(visibleText).forEach(([selector, text]) => setText(selector, text));

    const placeholders = lang === 'EN' ? {
      '#search-input': 'Search features, places, or coordinates (lat, lng)…',
      '#mh-search-input': 'Search features, places, or coordinates (lat, lng)…',
      '#attr-search': 'Filter rows…',
      '#ep-name': 'Feature name…',
      '#ep-desc': 'Notes…',
    } : {
      '#search-input': 'Cari fitur, lokasi, atau koordinat (lat, lng)…',
      '#mh-search-input': 'Cari fitur, lokasi, atau koordinat (lat, lng)…',
      '#attr-search': 'Filter baris…',
      '#ep-name': 'Nama bidang…',
      '#ep-desc': 'Keterangan…',
    };
    Object.entries(placeholders).forEach(([selector, text]) => setPlaceholder(selector, text));
  }
};
