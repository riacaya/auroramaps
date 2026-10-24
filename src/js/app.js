// =====================================================
// AuroraMaps · app.js — App init + boot
// =====================================================
'use strict';

// =====================================================
// FPS COUNTER
// =====================================================
function updateFPS() {
  State.frameCount++;
  const now = performance.now();
  if (now - State.lastFPSTime >= 1000) {
    const fps = Math.round(State.frameCount * 1000 / (now - State.lastFPSTime));
    document.getElementById('status-fps').textContent = fps + ' fps';
    State.frameCount = 0;
    State.lastFPSTime = now;
  }
  requestAnimationFrame(updateFPS);
}

// =====================================================
// APP INIT
// =====================================================
const App = {
  async init() {
    // App login/sesi terbuka → segarkan token BHUMI lewat tab BHUMI (jalur
    // ekstensi; lihat bhumiAuthSync.js). Fire-and-forget: kegagalan hanya
    // dicatat ke panel log, tidak menahan UI.
    if (window.AuroraBhumiAuth) AuroraBhumiAuth.ensure().catch(() => {});
    document.getElementById('loader').style.display = 'none';
    document.getElementById('app').style.display = 'flex';

    MapManager.init();
    MobileUI.init();
    // Image overlay membutuhkan instance peta yang sudah dibuat.
    ImageOverlayMgr.init();
    const sharedParams = new URLSearchParams(location.search);
    const sharedLat = Number(sharedParams.get('lat'));
    const sharedLng = Number(sharedParams.get('lng'));
    if (sharedParams.has('lat') && sharedParams.has('lng') && Number.isFinite(sharedLat) && Number.isFinite(sharedLng) && Math.abs(sharedLat) <= 90 && Math.abs(sharedLng) <= 180) {
      const sharedText = `${sharedLat.toFixed(6)}, ${sharedLng.toFixed(6)}`;
      ['search-input', 'mh-search-input'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = sharedText;
      });
      Search._goToResult(sharedLat, sharedLng);
    }
    AtrbpnLayers.init();
    BhumiIdentify.init();

    AutoSave.load();
    AutoSave.start();

    this._setupEvents();

    requestAnimationFrame(updateFPS);

    UI.updateStats();
    History._updateButtons();

    AppConsole.log('AuroraMaps v' + Config.version + ' ready', 'success');
    Toast.show('Selamat datang di AuroraMaps', 'info');
  },

  _setupEvents() {
    const bindClick = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    const bindInput = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', fn);
    };

    bindClick('btn-logout-pc', () => LoginGate.logout());
    bindClick('btn-settings-pc', () => SettingsPanel.open());

    bindClick('btn-atrbpn', () => AtrbpnLayers.showPanel(false));
    bindClick('btn-undo', () => {
      // Mode menggambar aktif (PC & HP): hapus titik terakhir — berlaku
      // untuk semua ukuran layar, bukan hanya mobile.
      if (State.activeDrawTool) {
        const dt = State.activeDrawTool;
        if (!dt._markers || dt._markers.length === 0) { Toast.show('Tidak ada titik untuk di-undo', 'warn'); return; }
        const lastMarker = dt._markers[dt._markers.length - 1];
        const latlng = lastMarker.getLatLng();
        dt._markers.pop();
        dt._markerGroup.removeLayer(lastMarker);
        try {
          const lls = dt._poly.getLatLngs();
          lls.pop();
          dt._poly.setLatLngs(lls);
          if (lls.length < 2) dt._map.removeLayer(dt._poly);
        } catch(e) {}
        MobileUI._vertexRedo.push(latlng);
        MobileUI._drawVertexCount = dt._markers.length;
        if (MobileUI._drawVertexCount < 3) document.getElementById('mb-add-point')?.classList.remove('draw-done');
        History._updateButtons();
        Toast.show('Titik terakhir dihapus', 'info');
      } else { History.undo(); }
    });
    bindClick('btn-redo', () => {
      // Mode menggambar aktif (PC & HP): kembalikan titik dari tumpukan redo.
      if (State.activeDrawTool) {
        if (MobileUI._vertexRedo.length === 0) { Toast.show('Tidak ada titik untuk di-redo', 'warn'); return; }
        const latlng = MobileUI._vertexRedo.pop();
        try {
          State.activeDrawTool.addVertex(latlng);
          MobileUI._drawVertexCount = State.activeDrawTool._markers
            ? State.activeDrawTool._markers.length
            : MobileUI._drawVertexCount + 1;
          if (MobileUI._drawVertexCount >= 3) document.getElementById('mb-add-point')?.classList.add('draw-done');
          History._updateButtons();
          Toast.show('Titik dikembalikan', 'info');
        } catch(e) { Toast.show('Gagal redo titik', 'error'); }
      } else { History.redo(); }
    });

    bindClick('project-name-display', () => {
      const cur = document.getElementById('project-name-display').textContent;
      const n = prompt('Project name:', cur);
      if (n) document.getElementById('project-name-display').textContent = n;
    });

    bindClick('btn-sidebar-left-toggle', () => {
      document.getElementById('sidebar-left').classList.toggle('collapsed');
    });
    bindClick('btn-sidebar-right-toggle', () => {
      document.getElementById('sidebar-right').classList.toggle('collapsed');
    });
    const bottomPanel = document.getElementById('bottom-panel');
    const syncBottomPanelState = () => {
      const isCollapsed = bottomPanel.classList.contains('collapsed');
      const toggleBtn = document.getElementById('btn-bottom-toggle');
      if (toggleBtn) toggleBtn.title = isCollapsed ? 'Open Bottom Panel' : 'Close Bottom Panel';
    };
    bindClick('btn-bottom-toggle', () => {
      bottomPanel.classList.toggle('collapsed');
      syncBottomPanelState();
    });
    bindClick('btn-bottom-close', () => {
      bottomPanel.classList.add('collapsed');
      bottomPanel.classList.remove('mobile-open');
      document.getElementById('mh-right-backdrop')?.classList.remove('open');
      syncBottomPanelState();
    });
    syncBottomPanelState();

    const bindTabGroup = (tabSelector, panelSelector, onActivate) => {
      document.querySelectorAll(tabSelector).forEach(tab => {
        tab.addEventListener('click', () => {
          const target = tab.dataset.target;
          document.querySelectorAll(tabSelector).forEach(t => t.classList.remove('active'));
          document.querySelectorAll(panelSelector).forEach(p => p.classList.remove('active'));
          tab.classList.add('active');
          document.getElementById(target)?.classList.add('active');
          onActivate?.(target, tab);
        });
      });
    };

    bindClick('tb-open', () => document.getElementById('file-input').click());
    bindClick('tb-save-project', () => ProjectManager.save());
    bindClick('tb-export', () => UI.showExportModal());
    bindClick('tb-import-url', () => UI.showImportURLModal());
    bindClick('tb-img-overlay', () => {
      if (ImageOverlayMgr._loaded) document.getElementById('img-overlay-panel')?.classList.toggle('active');
      else ImageOverlayMgr.open();
    });

    bindClick('dt-point', () => MobileUI._isMobile() ? MobileUI.selectDrawType('point') : MapManager.toggleDraw('point'));
    bindClick('dt-line', () => MobileUI._isMobile() ? MobileUI.selectDrawType('line') : MapManager.toggleDraw('line'));
    bindClick('dt-poly', () => MobileUI._isMobile() ? MobileUI.selectDrawType('poly') : MapManager.toggleDraw('poly'));
    bindClick('dt-rect', () => MobileUI._isMobile() ? MobileUI.selectDrawType('rect') : MapManager.toggleDraw('rect'));
    bindClick('dt-circle', () => MobileUI._isMobile() ? MobileUI.selectDrawType('circle') : MapManager.toggleDraw('circle'));

    bindClick('tb-zoom-all', () => MapManager.zoomToAll());
    bindClick('btn-zoom-in', () => MapManager.zoomIn());
    bindClick('btn-zoom-out', () => MapManager.zoomOut());
    bindClick('btn-my-location', () => MapManager.toggleMyLocation());
    bindClick('tb-gps-record', () => MapManager.toggleGPSRecording());
    bindClick('mm-gps-record', () => MapManager.toggleGPSRecording());
    bindClick('btn-3d', () => MapManager.toggle3D());
    bindClick('compass-3d', () => MapManager.reset3DHeading());
    // Tombol "Cetak" → panel ukuran cetak (px = meter × 39,37 × DPI) + ekspor
    // vektor SVG. Pengganti Screen Capture yang tidak jalan di WebView Android.
    bindClick('tb-screenshot', () => Exporter.showPrintPanel());

    Search.init();
    const searchMenu = document.getElementById('header-search-menu');
    // Tombol "Cari Bidang" → SATU panel tab (Sertifikat Analok · NIB · NIBEL).
    searchMenu?.addEventListener('click', () => AtrbpnLayers.showSearchPanel('shm'));
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); Search.search(e.target.value); }
    });
    bindClick('search-clear', () => {
      document.getElementById('search-input').value = '';
      Search._hideDropdown();
      Search.search('');
    });

    bindInput('file-input', (e) => {
      FileManager.openFiles(Array.from(e.target.files));
      e.target.value = '';
    });
    bindInput('project-input', (e) => {
      ProjectManager.openFile(e.target.files[0]);
      e.target.value = '';
    });

    const mapEl = document.getElementById('map-container');
    mapEl.addEventListener('dragover', (e) => { e.preventDefault(); document.getElementById('drop-zone').classList.add('drag-over'); });
    mapEl.addEventListener('dragleave', () => document.getElementById('drop-zone').classList.remove('drag-over'));
    mapEl.addEventListener('drop', (e) => {
      e.preventDefault();
      document.getElementById('drop-zone').classList.remove('drag-over');
      FileManager.openFiles(Array.from(e.dataTransfer.files));
    });

    document.getElementById('drop-zone').addEventListener('dragover', (e) => { e.preventDefault(); document.getElementById('drop-zone').classList.add('drag-over'); });
    document.getElementById('drop-zone').addEventListener('dragleave', () => document.getElementById('drop-zone').classList.remove('drag-over'));
    document.getElementById('drop-zone').addEventListener('drop', (e) => {
      e.preventDefault();
      document.getElementById('drop-zone').classList.remove('drag-over');
      FileManager.openFiles(Array.from(e.dataTransfer.files));
    });
    bindClick('drop-browse', () => document.getElementById('file-input').click());
    bindClick('btn-open-file-panel', () => document.getElementById('file-input').click());

    bindTabGroup('#sidebar-left .sidebar-tab', '#sidebar-left .sidebar-panel');
    bindTabGroup('#sidebar-right .sidebar-tab', '#sidebar-right .sidebar-panel', (target) => {
      if (target === 'panel-stats') UI.showStats();
    });
    bindTabGroup('.bottom-tab', '.bottom-panel-content');

    bindClick('layer-list', (e) => {
      const visBtn = e.target.closest('[data-layer-visibility]');
      if (visBtn) {
        e.stopPropagation();
        LayerManager.toggleVisibility(visBtn.dataset.layerVisibility);
        return;
      }
      const expandBtn = e.target.closest('[data-layer-expand]');
      if (expandBtn) {
        e.stopPropagation();
        UI.toggleLayerExpand(expandBtn.dataset.layerExpand);
        return;
      }
      const addBtn = e.target.closest('[data-add-layer]');
      if (addBtn) {
        e.stopPropagation();
        const [layerId, drawType] = addBtn.dataset.addLayer.split(':');
        UI.addToLayer(layerId, drawType);
        return;
      }
      const featureItem = e.target.closest('[data-layer-feature]');
      if (featureItem) {
        e.stopPropagation();
        const [layerId, idx] = featureItem.dataset.layerFeature.split(':');
        LayerManager.selectFeatureInLayer(layerId, Number(idx));
        return;
      }
      const layerItem = e.target.closest('[data-layer-id]');
      if (layerItem) {
        UI.selectLayer(layerItem.dataset.layerId);
      }
    });
    document.getElementById('layer-list').addEventListener('contextmenu', (e) => {
      const featureItem = e.target.closest('[data-layer-feature]');
      if (featureItem) {
        e.preventDefault();
        const [layerId, idx] = featureItem.dataset.layerFeature.split(':');
        UI.featureContextMenu(e, layerId, Number(idx));
        return;
      }
      const layerItem = e.target.closest('[data-layer-id]');
      if (layerItem) {
        e.preventDefault();
        UI.layerContextMenu(e, layerItem.dataset.layerId);
      }
    });

    bindClick('bookmark-list', (e) => {
      const jump = e.target.closest('[data-bookmark-id]');
      if (jump) {
        e.stopPropagation();
        Bookmarks.goTo(jump.dataset.bookmarkId);
        return;
      }
      const remove = e.target.closest('[data-bookmark-remove]');
      if (remove) {
        e.stopPropagation();
        Bookmarks.remove(remove.dataset.bookmarkRemove);
      }
    });

    document.querySelectorAll('.basemap-btn').forEach(btn => {
      btn.addEventListener('click', () => MapManager.switchBasemap(btn.dataset.layer));
    });

    bindClick('btn-attr-save-xlsx', () => Exporter.exportAllXLSX());

    bindClick('btn-refresh-stats', () => UI.showStats());

    bindClick('btn-add-draw-layer', () => MapManager.startDraw('point'));

    bindClick('btn-collapse-layers', () => {
      Object.keys(State.expandedLayers).forEach(k => { State.expandedLayers[k] = false; });
      UI.renderLayerList();
    });

    bindClick('btn-add-bookmark', () => Bookmarks.add());

    bindInput('style-fill-opacity', (e) => {
      document.getElementById('style-fill-opacity-val').textContent = e.target.value;
    });
    bindInput('style-stroke-width', (e) => {
      document.getElementById('style-stroke-width-val').textContent = e.target.value;
    });
    bindInput('style-stroke-opacity', (e) => {
      document.getElementById('style-stroke-opacity-val').textContent = e.target.value;
    });

    bindClick('btn-apply-style-main', () => {
      if (!State.selectedLayer) { Toast.show('Select a layer first', 'warn'); return; }
      LayerManager.applyStyle(State.selectedLayer, {
        fillColor: document.getElementById('style-fill-color').value,
        fillOpacity: parseFloat(document.getElementById('style-fill-opacity').value),
        strokeColor: document.getElementById('style-stroke-color').value,
        strokeWidth: parseFloat(document.getElementById('style-stroke-width').value),
        strokeOpacity: parseFloat(document.getElementById('style-stroke-opacity').value),
        dash: document.getElementById('style-dash').value,
        showLabels: document.getElementById('style-show-labels').checked,
         labelSource: document.getElementById('style-label-source').value,
        showEdgeLengths: document.getElementById('style-show-edge-lengths').checked,
      });
      Toast.show('Style applied', 'success');
    });

    bindClick('btn-copy-props', () => {
      if (State.selectedFeature?.properties) {
        navigator.clipboard.writeText(JSON.stringify(State.selectedFeature.properties, null, 2));
        Toast.show('Properties copied as JSON', 'success');
      }
    });

    bindInput('attr-search', (e) => AttrTable.filter(e.target.value));

    // ── Tabel atribut: maximize (layar penuh) / minimize (kembali ke panel bawah) ──
    const attrFullscreen = document.getElementById('attr-fullscreen');
    const maximizeAttrTable = () => {
      if (!attrFullscreen || attrFullscreen.classList.contains('open')) return;
      const container = document.getElementById('attr-table-container');
      const body = document.getElementById('attr-fullscreen-body');
      if (container && body) body.appendChild(container);
      attrFullscreen.classList.add('open');
      AttrTable.render();
    };
    const restoreAttrTable = () => {
      if (!attrFullscreen) return;
      attrFullscreen.classList.remove('open');
      const container = document.getElementById('attr-table-container');
      const bp = document.getElementById('bp-attrtable');
      if (container && bp) bp.appendChild(container);
    };
    bindClick('btn-attr-maximize', maximizeAttrTable);
    bindClick('btn-attr-max-close', restoreAttrTable);

    bindClick('btn-clear-console', () => AppConsole.clear());

    bindClick('modal-close', () => Modal.close());
    bindClick('modal-container', (e) => {
      if (e.target === document.getElementById('modal-container')) Modal.close();
    });
    bindClick('about-modal-close', () => {
      const el = document.getElementById('about-modal');
      el.style.display = 'none';
      el.style.inset = '';
      el.style.left = ''; el.style.top = ''; el.style.width = ''; el.style.height = '';
    });
    // Versi di About mengikuti Config.version (jangan hardcode di HTML).
    const aboutVer = document.querySelector('.about-version');
    if (aboutVer) aboutVer.textContent = 'v' + Config.version;

    document.addEventListener('click', () => ContextMenuManager.hide());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        ContextMenuManager.hide();
        MapManager.cancelDraw();
        // Tutup tabel atribut layar penuh jika terbuka
        const fs = document.getElementById('attr-fullscreen');
        if (fs && fs.classList.contains('open')) {
          const btn = document.getElementById('btn-attr-max-close');
          if (btn) btn.click();
        }
      }
      // Ctrl+Z / Ctrl+Y (juga Cmd+Z/Cmd+Y di Mac) — saat menggambar menghapus /
      // mengembalikan titik; di luar mode gambar memakai history biasa.
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = String(e.key || '').toLowerCase();
        // Jangan rebutan dengan input/textarea (undo teks internal browser).
        const typing = /^(input|textarea|select)$/i.test(e.target?.tagName || '') || e.target?.isContentEditable;
        if (!typing && k === 'z' && !e.shiftKey) { e.preventDefault(); document.getElementById('btn-undo')?.click(); }
        else if (!typing && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); document.getElementById('btn-redo')?.click(); }
      }
    });

    const bpResize = document.getElementById('bp-resize-handle');
    let bpDragging = false;
    bpResize.addEventListener('mousedown', (e) => {
      bpDragging = true;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', (e) => {
      if (!bpDragging) return;
      const workspace = document.getElementById('workspace');
      const wsBottom = workspace.getBoundingClientRect().bottom;
      const newH = Math.max(28, Math.min(400, wsBottom - e.clientY));
      document.getElementById('bottom-panel').style.height = newH + 'px';
      document.getElementById('bottom-panel').classList.remove('collapsed');
    });
    document.addEventListener('mouseup', () => {
      bpDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });
  }
};

// Local login gate for the local PC build
const LoginGate = {
  key: 'auroramaps-local-users',
  authKey: 'auroramaps-authenticated',
  sheetCacheKey: 'auroramaps-sheet-users',
  sheetUrlKey: 'auroramapsLoginSheet',
  lastActiveKey: 'auroramaps-last-active',
  _sheetUrl() {
    try { const ls = localStorage.getItem(this.sheetUrlKey); if (ls) return ls.trim(); } catch (e) { /* ignore */ }
    return String(window.LOGIN_SHEET_URL || '').trim();
  },
  // Samakan variasi penulisan nomor Indonesia menjadi format 08xxxxxxxxxx.
  _normalizePhone(value) {
    let digits = String(value || '').trim().replace(/[\s().-]/g, '');
    if (digits.startsWith('+')) digits = digits.slice(1);
    if (!/^\d+$/.test(digits)) return '';
    if (digits.startsWith('62')) digits = '0' + digits.slice(2);
    return /^08\d{8,11}$/.test(digits) ? digits : '';
  },
  // Satu-satunya ID non-nomor HP yang boleh login adalah akun administrator utama.
  _normalizeLoginId(value) {
    const id = String(value || '').trim().toLowerCase();
    return id === 'riacaya' ? id : this._normalizePhone(id);
  },
  // Terima link sheet Google apa pun (edit / gviz / pub) → URL CSV siap fetch.
  _csvUrl(u) {
    if (u.includes('/gviz/tq')) return u;
    const g = u.match(/[#?&]gid=(\d+)/); const gid = g ? g[1] : null;
    const pub = u.match(/\/spreadsheets\/d\/e\/([\w-]+)/);
    if (pub) return `https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub?${gid ? 'gid=' + gid + '&single=true&' : ''}output=csv`;
    const doc = u.match(/\/spreadsheets\/d\/([\w-]+)/);
    if (doc) return `https://docs.google.com/spreadsheets/d/${doc[1]}/gviz/tq?tqx=out:csv${gid ? '&gid=' + gid : ''}`;
    return u; // URL relatif/lokal (uji) — dipakai apa adanya
  },
  _parseCsv(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c !== '\r') cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  },
  // Baca kolom A=username, B=password, C=Status (peran untuk panel admin).
  _parseAccounts(text) {
    return this._parseAccountRows(this._parseCsv(text));
  },
  // Sama utk sumber CSV & tabel JSONP gviz — keduanya lolos filter header
  // yang sama, supaya baris "ID/Key/Status" tak jadi akun login palsu.
  _parseAccountRows(rowsIn) {
    const users = {}, roles = {};
    rowsIn.forEach((r, i) => {
      const u = String(r[0] ?? '').trim().toLowerCase();
      const p = String(r[1] ?? '');
      const s = String(r[2] ?? '').trim();
      if (!u || !p) return;
      // lewati baris header (kolom A username, kolom B password).
      // Dikenali juga header format sheet asli: ID / Key / Status — supaya
      // baris header tak jadi akun login palsu (id + "Key").
      if (i === 0 && /^(user(name)?|pengguna|login|id|nama|akun)$/.test(u) && /^(pass(word)?|kata.?sandi|sandi|key|kunci|token|pw)$/.test(p.trim().toLowerCase())) return;
      users[u] = p;
      if (s) roles[u] = s;
    });
    return { users, roles };
  },
  // SHA-256 hex (WebCrypto) - password disimpan di sheet sbg HASH,
  // bukan teks/angka, supaya tak bisa dibaca dari link sheet & tak pernah
  // diubah Sheets jadi angka (bug reset "0000" → 0).
  async _sha256hex(s) {
    try {
      if (window.crypto && crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
        return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) { /* WebCrypto bermasalah → pakai cadangan JS */ }
    // Cadangan murni-JS: WebCrypto butuh konteks aman — di WebView file://
    // (APK) bisa absen; tanpa ini SEMUA login hash gagal di HP.
    return this._sha256js(String(s));
  },
  // SHA-256 implementasi JS murni (FIPS 180-4) — hanya bila WebCrypto absen.
  _sha256js(str) {
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const bytes = new TextEncoder().encode(str);
    const len = bytes.length;
    const buf = new Uint8Array((((len + 8) >> 6) + 1) * 64);
    buf.set(bytes);
    buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    const bits = len * 8;
    dv.setUint32(buf.length - 8, Math.floor(bits / 0x100000000), false);
    dv.setUint32(buf.length - 4, bits >>> 0, false);
    let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const rr = (x, n) => (x >>> n) | (x << (32 - n));
    const w = new Uint32Array(64);
    for (let i = 0; i < buf.length; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4, false);
      for (let t = 16; t < 64; t++) {
        const s0 = rr(w[t - 15], 7) ^ rr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rr(w[t - 2], 17) ^ rr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (let t = 0; t < 64; t++) {
        const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
        const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h = [(h[0] + a) >>> 0, (h[1] + b) >>> 0, (h[2] + c) >>> 0, (h[3] + d) >>> 0,
           (h[4] + e) >>> 0, (h[5] + f) >>> 0, (h[6] + g) >>> 0, (h[7] + hh) >>> 0];
    }
    return h.map(x => x.toString(16).padStart(8, '0')).join('');
  },
  // Nilai tersimpan di sheet WAJIB HASH SHA-256 (64 heksadesimal).
  // Plaintext tidak lagi diterima — sandi lama di-sheet sudah dimigrasi
  // oleh panel admin (Apps Script action "migrate").
  async _matchKey(stored, pass) {
    if (stored == null || stored === '') return false;
    const s = String(stored);
    if (!/^[0-9a-f]{64}$/.test(s)) return false;
    const h = await this._sha256hex(pass);
    return !!h && h === s;
  },
  // ── Verifikasi login via Apps Script (server) ──────────────────────
  // Jalur UTAMA: POST action=login — server membandingkan password
  // terhadap isi sheet, jadi sheet TIDAK perlu publik (boleh Restricted).
  // Membalas { ok, status } ATAU { ok:false, error }.
  // null = endpoint kosong / script lama (action "login" belum ada) /
  //        gagal jaringan → pemanggil lanjut ke jalur gviz (cadangan).
  async _loginServer(user, pass) {
    const base = String(window.USER_ADMIN_API_URL || '').trim();
    if (!base) return null;
    try {
      const res = await fetch(base, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'login', id: user, key: pass }),
        cache: 'no-store', redirect: 'follow'
      });
      const data = await res.json().catch(() => null);
      if (data && data.ok) return { ok: true, status: String(data.status || '') };
      // Skrip BARU menandai jawaban definitif dgn login:true → penolakan
      // server mengalahkan cache/gviz (user terhapus tak bisa login via cache).
      if (data && data.login === true) {
        return { ok: false, definitive: true, error: String(data.error || 'Username atau password salah.') };
      }
      return null; // skrip lama / respons tak dikenal → pemanggil coba gviz
    } catch (e) { return null; } // jaringan/parse gagal → coba gviz
  },
  // Baca sheet lewat gviz JSONP (tqx=out:script) — TANPA CORS.
  // Google tidak mengirim Access-Control-Allow-Origin utk Origin: null
  // (asal file:///android_asset di APK) → fetch selalu diblokir WebView,
  // sementara tag <script> bebas dari aturan CORS.
  _sheetJsonp(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      let done = false;
      const g = window.google = window.google || {};
      g.visualization = g.visualization || {};
      const script = document.createElement('script');
      const clean = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        script.remove();
      };
      g.visualization.Query = {
        setResponse: data => { clean(); resolve(data); }
      };
      script.src = url;
      script.async = true;
      script.onerror = () => { clean(); reject(new Error('gagal dimuat')); };
      const timer = setTimeout(() => { clean(); reject(new Error('timeout ' + (timeoutMs || 8000) + ' ms')); }, timeoutMs || 8000);
      document.head.appendChild(script);
    });
  },
  // Baca sheet SEGAR tiap submit (no-store + timestamp anti-CDN).
  // Fetch gagal (CORS file:// / jaringan) → JSONP; itu juga gagal → cache
  // sheet terakhir; semua gagal → null (fallback lokal).
  async _sheetUsers() {
    const raw = this._sheetUrl();
    this._sheetSrc = null; // 'live' = sheet terbaca segar; 'cache' = data simpanan
    if (!raw) return null;
    let parsed = null;
    try {
      const url = this._csvUrl(raw);
      // Batas waktu fetch — tanpa ini, jaringan yang menggantung menahan
      // tombol Login lama sekali di HP sebelum jatuh ke JSONP.
      const ac = ('AbortController' in window) ? new AbortController() : null;
      const to = ac && setTimeout(() => ac.abort(), 7000);
      let res;
      try {
        res = await fetch(url + (url.includes('?') ? '&' : '?') + '_ts=' + Date.now(),
          { cache: 'no-store', signal: ac ? ac.signal : undefined });
      } finally { if (to) clearTimeout(to); }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const p = this._parseAccounts(text);
      if (!Object.keys(p.users).length) throw new Error('sheet kosong');
      parsed = p; this._sheetSrc = 'live';
    } catch (err) {
      // JSONP dicoba 2× — percobaan pertama kadang kena cache DNS/CDN buruk.
      let lastErr = null;
      for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
        try {
          const sUrl = this._csvUrl(raw).replace('tqx=out:csv', 'tqx=out:script');
          const data = await this._sheetJsonp(sUrl + (sUrl.includes('?') ? '&' : '?') + '_ts=' + Date.now(), 8000);
          const rows = ((data && data.table && data.table.rows) || [])
            .map(r => (r.c || []).map(c => (c && c.v != null) ? String(c.v) : ''));
          const p = this._parseAccountRows(rows);
          if (!Object.keys(p.users).length) throw new Error('sheet kosong');
          parsed = p; this._sheetSrc = 'live';
          console.warn('Login sheet dibaca via JSONP — ' + Object.keys(p.users).length + ' akun.');
        } catch (e2) {
          lastErr = e2;
          if (attempt === 0) await new Promise(r => setTimeout(r, 800)); // jeda antar percobaan
        }
      }
      if (!parsed) console.warn('Login sheet gagal dibaca (fetch: ' + err.message + '; JSONP: ' + (lastErr && lastErr.message) + ') — pakai cadangan');
    }
    if (parsed) {
      try { localStorage.setItem(this.sheetCacheKey, JSON.stringify(parsed.users)); } catch (e) { /* penuh */ }
      try { localStorage.setItem('auroramaps-sheet-roles', JSON.stringify(parsed.roles)); } catch (e) { /* penuh */ }
      return parsed.users;
    }
    try {
      const c = JSON.parse(localStorage.getItem(this.sheetCacheKey) || 'null');
      if (c && typeof c === 'object' && Object.keys(c).length) { this._sheetSrc = 'cache'; return c; }
    } catch (e) { /* ignore */ }
    return null;
  },
  // ── Sesi idle: keluar otomatis bila lama tanpa aktivitas ──────────────
  // Durasi dari window.LOGIN_SESSION_MINUTES (menit; 0 = nonaktif),
  // bisa dioverride per perangkat: localStorage 'auroramapsSessionMinutes'.
  _sessionMinutes() {
    try {
      const raw = localStorage.getItem('auroramapsSessionMinutes');
      if (raw != null) { const v = Number(raw); return Number.isFinite(v) && v >= 0 ? v : 0; }
    } catch (e) { /* ignore */ }
    const v = Number(window.LOGIN_SESSION_MINUTES);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  },
  // Stempel "terakhir aktif" — dipanggil saat login & tiap ada aktivitas
  // (ditulis paling cepat tiap 20 detik supaya localStorage tak banjir tulis).
  _touchSession() {
    try { localStorage.setItem(this.lastActiveKey, String(Date.now())); } catch (e) { /* ignore */ }
  },
  _sessionExpired() {
    const min = this._sessionMinutes();
    if (!(min > 0)) return false;
    const last = Number(localStorage.getItem(this.lastActiveKey) || 0);
    return !!last && (Date.now() - last) > min * 60000;
  },
  // Pasang penjaga: reset stempel tiap aktivitas, cek kedaluwarsa tiap 30 detik.
  _watchSession() {
    if (this._watchTimer) return;
    this._watchTimer = setInterval(() => {
      if (this._sessionExpired()) {
        try { sessionStorage.setItem('auroramaps-session-expired', String(this._sessionMinutes())); } catch (e) { /* ignore */ }
        this.logout();
      }
    }, 30000);
    let last = 0;
    const touch = () => {
      const now = Date.now();
      if (now - last >= 20000) { last = now; this._touchSession(); }
    };
    ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'mousemove'].forEach(ev =>
      window.addEventListener(ev, touch, { passive: true }));
  },
  // Keluar sesi: hapus penanda auth + identitas/peran admin — database lokal (user) tetap utuh.
  logout() {
    try {
      localStorage.removeItem(this.authKey);
      localStorage.removeItem(this.lastActiveKey);
      localStorage.removeItem('auroramaps-user-role');
      localStorage.removeItem('auroramaps-current-user');
      sessionStorage.removeItem('auroramaps-admin-ctx');
    } catch (e) { /* ignore */ }
    location.reload();
  },
  // Simpan sesi panel Administrator: user aktif, peran (kolom Status),
  // dan kredensial sementara di sessionStorage (ikut hilang saat tab ditutup).
  // Peran diambil dari respons login server (atau parse gviz pada jalur
  // cadangan) — peran kosong = tanpa akses panel.
  _saveSession_(user, pass, role) {
    try {
      localStorage.setItem('auroramaps-current-user', user);
      role = String(role || '');
      if (role) localStorage.setItem('auroramaps-user-role', role);
      else localStorage.removeItem('auroramaps-user-role');
      sessionStorage.setItem('auroramaps-admin-ctx', JSON.stringify({ user, pass }));
      window.AdminPanel?.sync();
    } catch (e) { /* storage penuh/diblokir */ }
  },
  // Catat login terakhir ke sheet (kolom "Login Terakhir") — fire-and-forget:
  // gagal jaringan/dibiarkan; login tetap sukses tanpa menunggu respons.
  _pingLogin_(user) {
    const base = String(window.USER_ADMIN_API_URL || '').trim();
    if (!base) return;
    try {
      const q = new URLSearchParams({ action: 'loglogin', id: user });
      fetch(base + '?' + q.toString(), { cache: 'no-store', redirect: 'follow' }).catch(() => {});
    } catch (e) { /* ignore */ }
  },
  // ── Daftar: tambah nomor HP/password baru ke sheet login ────────────
  // Memanggil Apps Script action "register" (tanpa auth admin, tapi hanya
  // boleh membuat user Status "User" — lihat apps-script/AuroraMapsUsers.gs).
  async _register() {
    const userEl = document.getElementById('login-user');
    const passEl = document.getElementById('login-pass');
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-register');
    const rawUser = (userEl?.value || '').trim();
    const user = this._normalizePhone(rawUser);
    const pass = passEl?.value || '';
    const setMsg = (msg, ok) => {
      if (!errEl) return;
      errEl.textContent = msg || '';
      errEl.classList.toggle('is-ok', !!ok);
    };
    if (!user) { setMsg('Masukkan nomor HP Indonesia yang valid, misalnya 081234567890.'); userEl?.focus(); return; }
    if (!pass) { setMsg('Isi password untuk mendaftar.'); passEl?.focus(); return; }
    if (userEl) userEl.value = user;
    const base = String(window.USER_ADMIN_API_URL || '').trim();
    if (!base) { setMsg('Pendaftaran belum aktif (endpoint belum diatur).'); return; }
    if (btn) btn.disabled = true;
    setMsg('Mendaftarkan "' + user + '"…');
    try {
      // POST body (text/plain lolos preflight CORS) — sandi TIDAK dikirim via URL.
      const res = await fetch(base, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' }, cache: 'no-store', redirect: 'follow',
        body: JSON.stringify({ action: 'register', id: user, key: pass })
      });
      const data = await res.json().catch(() => { throw new Error('Respons server tidak valid.'); });
      if (!data.ok) throw new Error(data.error || 'Pendaftaran ditolak.');
      setMsg(data.msg || 'Pendaftaran berhasil — silakan tekan Login.', true);
    } catch (e) {
      setMsg('Gagal mendaftar: ' + e.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  },
  init() {
    // Database user lokal sudah dihapus — dulu ada hardcode akun cadangan
    // di localStorage yang jadi jalan pintas login tanpa sheet.
    // Login kini diverifikasi via Apps Script (action=login) — sheet tidak
    // perlu publik; jalur gviz hanya cadangan otomatis (lihat _loginServer).
    try { localStorage.removeItem(this.key); } catch { /* ignore */ }
    if (localStorage.getItem(this.authKey) === 'true') {
      // Sesi idle sudah kedaluwarsa saat app dibuka → kembali ke layar login.
      if (this._sessionExpired()) {
        try { sessionStorage.setItem('auroramaps-session-expired', String(this._sessionMinutes())); } catch (e) { /* ignore */ }
        this.logout();
        return;
      }
      if (!localStorage.getItem(this.lastActiveKey)) this._touchSession();
      this._watchSession();
      document.getElementById('login-gate')?.remove();
      App.init();
      return;
    }
    // Pesan bila sesi berakhir (lewat batas idle / kedaluwarsa saat app dibuka)
    try {
      const exp = sessionStorage.getItem('auroramaps-session-expired');
      if (exp) {
        sessionStorage.removeItem('auroramaps-session-expired');
        const errEl = document.getElementById('login-error');
        if (errEl) { errEl.textContent = 'Sesi ' + exp + ' menit tanpa aktivitas telah berakhir — silakan login ulang.'; errEl.classList.remove('is-ok'); }
      }
    } catch (e) { /* ignore */ }
    const passwordInput = document.getElementById('login-pass');
    const passwordToggle = document.getElementById('login-password-toggle');
    passwordToggle?.addEventListener('click', () => {
      const visible = passwordInput.type === 'text';
      passwordInput.type = visible ? 'password' : 'text';
      passwordToggle.textContent = visible ? '👁' : '🙈';
      passwordToggle.setAttribute('aria-label', visible ? 'Tampilkan password' : 'Sembunyikan password');
      passwordToggle.title = visible ? 'Tampilkan password' : 'Sembunyikan password';
    });
    document.getElementById('login-register')?.addEventListener('click', () => this._register());
    document.getElementById('login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const userEl = document.getElementById('login-user');
      const user = this._normalizeLoginId(userEl.value);
      const pass = document.getElementById('login-pass').value;
      const errEl = document.getElementById('login-error');
      if (!user) {
        if (errEl) { errEl.textContent = 'Masukkan nomor HP Indonesia yang valid atau ID administrator riacaya.'; errEl.classList.remove('is-ok'); }
        userEl.focus();
        return;
      }
      userEl.value = user;
      const btn = e.submitter || e.target.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true; // cegah submit ganda saat verifikasi
      if (errEl) errEl.textContent = '';
      // ── Jalur UTAMA: verifikasi via Apps Script (sheet boleh private) ──
      let result = await this._loginServer(user, pass);
      let role = '', sheet = null, stored = null;
      // Server MENOLAK dgn penanda definitive (skrip baru) → langsung
      // tampil pesan server; gviz/cache TIDAK dicoba (user yang sudah
      // dihapus dari sheet tak bisa login lewat cache lama).
      // Server tidak terjangkau / skrip lama → cek gviz juga (cadangan):
      //   • skrip LAMA: action=login tak dikenal (dibalas "salah") → gviz
      //     yang menentukan → login tetap jalan sampai skrip di-redeploy.
      //   • skrip BARU + sheet privat: gviz gagal → pesan server yang tampil.
      if ((!result || !result.ok) && !(result && result.definitive)) {
        sheet = await this._sheetUsers();
        stored = sheet ? sheet[user] : null;
        if (sheet && await this._matchKey(stored, pass)) {
          result = { ok: true };
          try { role = String((JSON.parse(localStorage.getItem('auroramaps-sheet-roles') || '{}'))[user] || ''); } catch (e) { role = ''; }
        }
      } else if (result && result.ok) {
        role = result.status || '';
      }
      if (btn) btn.disabled = false;
      if (result && result.ok) {
        // Login sukses → user/role otoritatif dari server/sheet; pencabutan
        // atau ubah user langsung berlaku pada login berikutnya.
        localStorage.setItem(this.authKey, 'true');
        this._touchSession();          // mulai hitungan idle dari detik ini
        this._saveSession_(user, pass, role);
        this._watchSession();
        this._pingLogin_(user);        // catat "Login Terakhir" di sheet (tanpa blok UI)
        document.getElementById('login-gate').remove();
        App.init();
      }
      // Pesan dibedakan per penyebab supaya langsung terdiagnosis:
      //   • gviz terbaca tapi gagal → id tak terdaftar vs sandi salah
      //   • gviz tak terbaca & server menolak → pesan server
      //   • keduanya gagal → sumber verifikasi tak terjangkau
      else if (errEl) {
        if (sheet) {
          if (stored == null || stored === '') {
            errEl.textContent = this._sheetSrc === 'cache'
              ? 'Username "' + user + '" tidak terdaftar (data cache — coba lagi saat daring).'
              : 'Username "' + user + '" tidak terdaftar di sheet login.';
          } else {
            errEl.textContent = (this._sheetSrc === 'cache' ? 'Password salah (data cache).' : 'Password salah.');
          }
        } else if (result && !result.ok) {
          errEl.textContent = result.error || 'Username atau password salah.';
        } else {
          errEl.textContent = 'Layanan login tidak terjangkau — periksa koneksi internet lalu coba lagi.';
        }
      }
    });
  }
};
LoginGate.init();

// ── Mobile Hamburger Menu ──
(function() {
  const backdrop  = document.getElementById('mh-menu-backdrop');
  const menu      = document.getElementById('mobile-menu');
  const btnOpen   = document.getElementById('mh-menu');
  const btnClose  = document.getElementById('mm-close');
  if (!btnOpen) return;

  const toggleMenuState = (isOpen) => {
    backdrop.classList.toggle('open', isOpen);
    menu.classList.toggle('open', isOpen);
  };
  const runAfterMenuClose = (fn) => {
    closeMenu();
    setTimeout(fn, 200);
  };

  const openMenu = () => {
    toggleMenuState(true);
  };
  const closeMenu = () => toggleMenuState(false);

  btnOpen.addEventListener('click', openMenu);
  btnClose.addEventListener('click', closeMenu);
  backdrop.addEventListener('click', closeMenu);

  const menuAction = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => runAfterMenuClose(fn));
  };

  const openAtrSearchMenu = () => {
    // Langsung buka panel tab yang sama dengan versi PC.
    AtrbpnLayers.showSearchPanel('shm');
  };

  [
    ['mm-open', () => document.getElementById('file-input').click()],
    ['mm-save-project', () => ProjectManager.save()],
    ['mm-overlay', () => {
      if (ImageOverlayMgr._loaded) {
        document.getElementById('img-overlay-panel').classList.toggle('active');
      } else {
        ImageOverlayMgr.open();
      }
    }],
    ['mm-import-url', () => UI.showImportURLModal()],
    ['mm-export', () => UI.showExportModal()],
    ['mm-print', () => Exporter.showPrintPanel()],
    ['mm-atrbpn', () => AtrbpnLayers.showPanel(false)],
    ['mm-atr-search', openAtrSearchMenu],
    ['mm-fit-all', () => MapManager.zoomToAll()],
  ].forEach(([id, fn]) => menuAction(id, fn));

  // ── Mobile: Layer Manager overlay (sidebar kiri sebagai panel geser) ──
  const layersBackdrop = document.getElementById('mh-layers-backdrop');
  const closeLayersOverlay = () => {
    document.getElementById('sidebar-left')?.classList.remove('mobile-open');
    layersBackdrop?.classList.remove('open');
  };
  const openLayersOverlay = () => {
    document.getElementById('sidebar-left')?.classList.add('mobile-open');
    layersBackdrop?.classList.add('open');
  };
  const mbLayersBtn = document.getElementById('mb-layers');
  if (mbLayersBtn) mbLayersBtn.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar-left');
    if (sidebar?.classList.contains('mobile-open')) closeLayersOverlay();
    else openLayersOverlay();
  });
  if (layersBackdrop) layersBackdrop.addEventListener('click', closeLayersOverlay);

  // ── Pengaturan ──
  const mmSettingsBtn = document.getElementById('mm-settings');
  if (mmSettingsBtn) mmSettingsBtn.addEventListener('click', () => {
    runAfterMenuClose(() => SettingsPanel.open());
  });

  // ── Tampilan: Bahasa ──
  let currentLang = localStorage.getItem('sm_lang') || 'ID';
  LanguageUI.apply(currentLang);
  const applyLanguage = (lang, shouldCloseMenu = false) => {
    currentLang = lang;
    localStorage.setItem('sm_lang', currentLang);
    LanguageUI.apply(currentLang);
    if (shouldCloseMenu) closeMenu();
    Toast.show('Bahasa: ' + currentLang, 'info');
  };
  // Dipakai panel Pengaturan (select bahasa) — jalur resmi ganti bahasa.
  window.setAuroraLanguage = (lang) => applyLanguage(lang === 'EN' ? 'EN' : 'ID');

  const openAttrPanel = () => {
    AttrTable.load();
    const panel = document.getElementById('bottom-panel');
    const backdrop = document.getElementById('mh-right-backdrop');
    panel?.classList.remove('collapsed');
    panel?.classList.add('mobile-open');
    backdrop?.classList.add('open');
    AttrTable.render();
  };
  const attrPanelBackdrop = document.getElementById('mh-right-backdrop');
  attrPanelBackdrop?.addEventListener('click', () => {
    document.getElementById('bottom-panel')?.classList.remove('mobile-open');
    if (!document.getElementById('sidebar-right')?.classList.contains('mobile-open')) attrPanelBackdrop.classList.remove('open');
  });
  menuAction('mm-attr', openAttrPanel);

  const openAboutModal = () => {
    const el = document.getElementById('about-modal');
    const canvas = document.getElementById('map-container');
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      el.style.inset = 'auto';
      el.style.left = `${r.left}px`; el.style.top = `${r.top}px`;
      el.style.width = `${r.width}px`; el.style.height = `${r.height}px`;
    }
    el.style.display = 'flex';
  };
  menuAction('mm-about', openAboutModal);
  menuAction('mm-guide', () => window.GuidePanel?.open());
  document.getElementById('about-open-guide')?.addEventListener('click', () => window.GuidePanel?.open());

  // ── Administrator & Logout (mantan isi panel Pengaturan, tombol ⚙ dihapus) ──
  menuAction('mm-admin', () => window.AdminPanel?.open());
  menuAction('mm-logout', () => LoginGate.logout());
  const aboutHeaderBtn = document.getElementById('btn-about-pc');
  window.openAuroraAbout = openAboutModal;
  if (aboutHeaderBtn) aboutHeaderBtn.onclick = window.openAuroraAbout;

  // ── Mobile Search Panel ──
  (function() {
    const btn        = document.getElementById('mh-search');
    const panel      = document.getElementById('mh-search-panel');
    const backdrop   = document.getElementById('mh-search-backdrop');
    const input      = document.getElementById('mh-search-input');
    const closeBtn   = document.getElementById('mh-search-close');
    if (!btn || !panel) return;

    const setVisible = (visible) => {
      panel.style.display = visible ? 'block' : 'none';
      backdrop.style.display = visible ? 'block' : 'none';
      panel.style.transform = visible ? 'translateY(0)' : 'translateY(-100%)';
    };
    const openSearch = () => {
      setVisible(true);
      requestAnimationFrame(() => { panel.style.transform = 'translateY(0)'; });
      setTimeout(() => input.focus(), 200);
    };
    const closeSearch = () => {
      panel.style.transform = 'translateY(-100%)';
      setTimeout(() => setVisible(false), 200);
    };

    btn.addEventListener('click', openSearch);
    closeBtn.addEventListener('click', closeSearch);
    backdrop.addEventListener('click', closeSearch);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); Search.search(input.value); closeSearch(); }
    });
  })();
})();
