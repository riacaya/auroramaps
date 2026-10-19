// =====================================================
// AuroraMaps · theme.js — Theme + Language UI
// =====================================================
'use strict';

// =====================================================
// THEME MANAGER
// =====================================================
const Theme = {
  _labels: { dark: 'Night', light: 'Biru', senja: 'Senja', elegan: 'Elegan' },

  toggle() {
    const cycle = ['dark', 'light', 'senja', 'elegan'];
    const idx = cycle.indexOf(State.theme);
    State.theme = cycle[(idx + 1) % cycle.length];
    document.documentElement.setAttribute('data-theme', State.theme);
    Storage.save('theme', State.theme);
    AppConsole.log(`Theme: ${State.theme}`, 'info');
  },

  apply(theme) {
    State.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
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
      'tb-open': 'File',
      'tb-save-project': 'Simpan',
      'tb-img-overlay': 'Overlay',
      'tb-import-url': 'URL',
      'tb-screenshot': 'Cetak',
      'tb-export': 'Export',
      'tb-zoom-all': 'Fit All',
      'mm-open': 'File',
      'mm-save-project': 'Simpan',
      'mm-overlay': 'Overlay',
      'mm-import-url': 'Import URL',
      'mm-export': 'Export',

      'mm-layers': 'Layer Manager',
      'mm-fit-all': 'Fit All',
      'mm-atrbpn': 'ATRBPN',
      'mm-attr': 'Atribut',
      'modal-export-title': 'Export Data',
      'modal-export-vector': 'Data Vektor',
      'modal-export-scope': 'Cakupan Export',
      'modal-export-all-scope': 'Semua',
      'modal-export-all-scope-help': 'Semua bidang digabung menjadi satu file untuk setiap format.',
      'modal-export-layer-scope': 'Per bidang',
      'modal-export-layer-scope-help': 'Buat file terpisah untuk setiap bidang pada setiap format.',
      'modal-export-feature-scope': 'Per fitur',
      'modal-export-feature-scope-help': 'Buat file terpisah untuk setiap fitur.',
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

      'tb-open': 'File',
      'tb-img-overlay': 'Overlay',
      'tb-import-url': 'URL',
      'tb-save-project': 'Simpan',
      'mm-settings': 'Pengaturan',
      'set-title': 'Pengaturan',
      'set-appearance': 'Tampilan',
      'set-theme': 'Tema',
      'set-lang': 'Bahasa',
      'set-storage': 'Penyimpanan',
      'set-autosave': 'Simpan otomatis (autosave)',
      'set-autosave-help': 'Menyimpan posisi peta, tema, dan bookmark otomatis tiap 30 detik.',
      'set-clear-autosave': 'Hapus autosave',
      'set-clear-tiles': 'Hapus tile offline',
      'set-import-print': 'PREFERENSI',
      'set-remember-note': 'Pilihan format export serta ukuran & DPI cetak terakhir otomatis diingat.',
      'set-reset-prefs': 'Kembalikan ke bawaan',
      'set-field': 'Lapangan',
      'set-gps-nobase': 'Sembunyikan peta dasar saat rekam GPS',
      'set-gps-nobase-help': 'Berguna saat ingin jejak GPS saja tanpa peta latar.',
      'set-offline-dl': 'Unduh area peta offline',
      'set-info': 'Info',
      'set-layers-count': 'Layer',
      'set-features-count': 'Fitur',
    },
    EN: {
      'tb-open': 'File',
      'tb-save-project': 'Save',
      'tb-img-overlay': 'Overlay',
      'tb-import-url': 'URL',
      'tb-screenshot': 'Print',
      'tb-export': 'Export',
      'tb-zoom-all': 'Fit All',
      'mm-open': 'File',
      'mm-save-project': 'Save',
      'mm-overlay': 'Overlay',
      'mm-import-url': 'Import URL',
      'mm-export': 'Export',

      'mm-layers': 'Layer Manager',
      'mm-fit-all': 'Fit All',
      'mm-atrbpn': 'ATRBPN',
      'mm-attr': 'Attributes',
      'modal-export-title': 'Export Data',
      'modal-export-vector': 'Vector Data',
      'modal-export-scope': 'Export Scope',
      'modal-export-all-scope': 'All',
      'modal-export-all-scope-help': 'Combine all fields into one file for each format.',
      'modal-export-layer-scope': 'Per field',
      'modal-export-layer-scope-help': 'Create a separate file for each field in each format.',
      'modal-export-feature-scope': 'Per feature',
      'modal-export-feature-scope-help': 'Create a separate file for each feature.',
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

      'mm-settings': 'Settings',
      'set-title': 'Settings',
      'set-appearance': 'Appearance',
      'set-theme': 'Theme',
      'set-lang': 'Language',
      'set-storage': 'Storage',
      'set-autosave': 'Auto-save',
      'set-autosave-help': 'Automatically saves map position, theme, and bookmarks every 30 seconds.',
      'set-clear-autosave': 'Delete auto-save',
      'set-clear-tiles': 'Delete offline tiles',
      'set-import-print': 'PREFERENCES',
      'set-remember-note': 'Last export format and print size/DPI choices are remembered automatically.',
      'set-reset-prefs': 'Reset to defaults',
      'set-field': 'Field work',
      'set-gps-nobase': 'Hide basemap while recording GPS',
      'set-gps-nobase-help': 'Useful when you only want the GPS track without a background map.',
      'set-offline-dl': 'Download offline map area',
      'set-info': 'Info',
      'set-layers-count': 'Layers',
      'set-features-count': 'Features',
    }
  },
  apply(lang) {
    this.current = lang === 'EN' ? 'EN' : 'ID';
    const dict = this.labels[lang] || this.labels.ID;
    document.documentElement.lang = lang === 'EN' ? 'en' : 'id';
    Object.entries(dict).forEach(([id, label]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id.startsWith('tb-')) {
        const icon = el.querySelector('.tb-icon');
        if (icon) el.innerHTML = `<span class="tb-icon">${icon.innerHTML}</span> ${label}`;
      } else if (id.startsWith('mm-')) {
        const icon = el.querySelector('.mm-item-icon');
        el.innerHTML = `<span class="mm-item-icon">${icon ? icon.innerHTML : ''}</span><span class="mm-item-text">${label}</span>`;
      } else {
        el.textContent = label;
      }
    });
    const titles = lang === 'EN'
      ? {
          'tb-open': 'File — GIS data / project (.auroramaps)',
          'tb-img-overlay': 'Image overlay reference',
          'tb-import-url': 'Import from URL',
          'tb-screenshot': 'Print / save map image',
          'tb-export': 'Export Data',
          'tb-zoom-all': 'Zoom to All Layers',
          'mm-attr': 'Show all attributes',
        }
      : {
          'tb-open': 'File — data GIS atau proyek (.auroramaps)',
          'tb-img-overlay': 'Overlay gambar referensi',
          'tb-import-url': 'Impor dari URL',
          'tb-screenshot': 'Cetak / simpan gambar peta',
          'tb-export': 'Export Data',
          'tb-zoom-all': 'Zoom ke Semua Layer',
          'mm-attr': 'Tampilkan semua atribut',
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
