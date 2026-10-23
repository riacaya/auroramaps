// =====================================================
// AuroraMaps · features.js — Feature select/manage/edit
// =====================================================
'use strict';

// =====================================================
// FEATURE SELECT
// =====================================================
const FeatureSelect = {
  _prevSub: null,
  _prevLayerId: null,

  _applyHighlight(sub) {
    if (!sub || typeof sub.setStyle !== 'function') return;
    sub.setStyle({ color: '#ffffff', weight: 4, opacity: 1 });
    if (typeof sub.bringToFront === 'function') sub.bringToFront();
  },

  _removeHighlight() {
    if (!this._prevSub || !this._prevLayerId) return;
    const entry = State.layers.find(l => l.id === this._prevLayerId);
    if (entry && typeof this._prevSub.setStyle === 'function') {
      const s = entry.style || {};
      this._prevSub.setStyle({
        color:       s.color       || entry.color || '#3b82f6',
        weight:      s.weight      ?? 2,
        opacity:     s.opacity     ?? 1,
        fillColor:   s.fillColor   || entry.color || '#3b82f6',
        fillOpacity: s.fillOpacity ?? 0.35,
        dashArray:   s.dashArray   || null,
      });
    }
    this._prevSub    = null;
    this._prevLayerId = null;
  },

  select(feature, leafletLayer, layerId) {
    this._removeHighlight();

    State.selectedFeature      = feature;
    State.selectedFeatureLayer = layerId;
    State.selectedLayer        = layerId;
    const layerEntry = State.layers.find(layer => layer.id === layerId);

    this._applyHighlight(leafletLayer);
    this._prevSub     = leafletLayer;
    this._prevLayerId = layerId;

    if (window.innerWidth > 768) {
      const rightSidebar = document.getElementById('sidebar-right');
      if (rightSidebar) rightSidebar.classList.remove('collapsed');
    }

    if (!UI.syncSelectionInLayerList()) UI.renderLayerList();
    UI.scrollToLayer(layerId);

    UI.activateRightTab('panel-props');

    UI.showProperties(feature, false);
    UI.showGeometryInfo(feature, leafletLayer);
    if (layerEntry) {
      UI.showMetadata(layerEntry);
      UI.syncStyleControls(layerEntry);
    }
    document.getElementById('json-viewer').innerHTML = Utils.formatJSON(feature);
    document.getElementById('status-selected').textContent = '1 feature';
    document.getElementById('stat-selected').textContent = '1';

    AttrTable.highlightFeature(feature);
    AppConsole.log(`Feature selected: ${feature.properties?.name || feature.geometry?.type || 'unnamed'}`, 'info');

  },

  clear() {
    this._removeHighlight();
    State.selectedFeature      = null;
    State.selectedFeatureLayer = null;
    document.getElementById('status-selected').textContent = '0 features';
    document.getElementById('stat-selected').textContent = '0';
  }
};
// =====================================================
// FEATURE MANAGER
// =====================================================
const FeatureManager = {
  deleteSelected() {
    if (!State.selectedFeature || !State.selectedFeatureLayer) {
      Toast.show('Pilih bidang di peta dulu', 'warn');
      return;
    }
    const layerEntry = State.layers.find(l => l.id === State.selectedFeatureLayer);
    if (!layerEntry) return;

    const featureName = State.selectedFeature.properties?.name || layerEntry.name || 'bidang ini';
    const isOnlyFeature = layerEntry.isDrawn || (layerEntry.geoJSON?.features?.length <= 1);

    const confirmMsg = isOnlyFeature
      ? `Hapus bidang <strong>"${Utils.escapeHtml(featureName)}"</strong>? Layer akan ikut dihapus.`
      : `Hapus fitur <strong>"${Utils.escapeHtml(featureName)}"</strong> dari layer "${Utils.escapeHtml(layerEntry.name)}"?`;

    Modal.open('⚠ Konfirmasi Hapus', confirmMsg, [
      { label: 'Batal', cls: 'btn-secondary', action: () => Modal.close() },
      { label: '🗑 Hapus', cls: 'btn-danger', action: () => {
        Modal.close();
        if (isOnlyFeature) {
          LayerManager.removeLayer(State.selectedFeatureLayer);
          FeatureSelect.clear();
          document.getElementById('props-content').innerHTML = emptyStateHtml('🗺', 'Klik fitur di peta untuk melihat propertinya.');
          Toast.show(`Bidang "${featureName}" dihapus`, 'warn');
          AppConsole.log(`Bidang "${featureName}" dihapus`, 'warn');
        } else {
          const idx = layerEntry.geoJSON.features.indexOf(State.selectedFeature);
          if (idx >= 0) layerEntry.geoJSON.features.splice(idx, 1);
          layerEntry.featureCount = layerEntry.geoJSON.features.length;
          layerEntry.leafletLayer.eachLayer(sub => {
            if (sub.feature === State.selectedFeature) layerEntry.leafletLayer.removeLayer(sub);
          });
          FeatureSelect.clear();
          document.getElementById('props-content').innerHTML = emptyStateHtml('🗺', 'Klik fitur di peta untuk melihat propertinya.');
          UI.renderLayerList();
          UI.updateStats();
          const updatedEntry = State.layers.find(l => l.id === layerEntry.id);
          if (updatedEntry) AttrTable.load();
          Toast.show(`Fitur "${featureName}" dihapus dari "${layerEntry.name}"`, 'warn');
          AppConsole.log(`Fitur "${featureName}" dihapus dari layer "${layerEntry.name}"`, 'warn');
        }
        History.push({ type: 'delete_feature', layerId: State.selectedFeatureLayer });
      }}
    ]);
  }
};
// =====================================================
// FEATURE EDITOR
// =====================================================
const FeatureEditor = {
  _editRoot() {
    const modalBody = document.getElementById('modal-body');
    if (modalBody?.querySelector('#ep-name')) return modalBody;
    return document.getElementById('props-content');
  },

  startEdit() {
    if (!State.selectedFeature) { Toast.show('Pilih fitur dulu di peta', 'warn'); return; }
    if (window.innerWidth <= 768) {
      this.openModal(State.selectedFeature, State.selectedFeatureLayer);
      return;
    }
    UI.showProperties(State.selectedFeature);
    UI.activateRightTab('panel-props');
  },

  openModal(feature = State.selectedFeature, layerId = State.selectedFeatureLayer) {
    if (!feature) { Toast.show('Pilih fitur dulu di peta', 'warn'); return; }
    State.selectedFeature = feature;
    State.selectedFeatureLayer = layerId;
    normalizeFeatureAreaProps(feature);
    const props = feature.properties || {};
    const geomType = feature.geometry?.type || '';
    const m = Utils.calcFeatureMeasurements(feature);
    const nama = props.name || props.Name || '';
    const deskripsi = props.deskripsi || props.description || props.Description || '';
    const shm = props.shm || props.SHM || '';
    const nib = props.nib || props.NIB || '';
    const keterangan = props.keterangan || props.Keterangan || '';
    const keliling = m.keliling || props.keliling || '';
    const luasPoligon = m.luas_poligon || props.luas_poligon || '';
    const luasShm = props.luas || props.luas || '';
    const panjang = m.panjang || props.panjang || '';
    const showKeliling = !!(keliling || panjang || geomType.toLowerCase().includes('linestring') || geomType.toLowerCase().includes('polygon'));
    const showLuas = !!(luasPoligon || luasShm || geomType.toLowerCase().includes('polygon'));
    const autoKeys = ['_drawType', 'radius', 'radius_m', 'circle_radius_m', 'keliling', 'luas_poligon', 'luas', 'luas', 'panjang', 'jari_jari', 'name', 'Name', 'deskripsi', 'description', 'Description', 'Deskripsi', 'DESKRIPSI', 'shm', 'SHM', 'nib', 'NIB', 'keterangan', 'Keterangan'];
    const extraProps = Object.entries(props).filter(([key]) => !autoKeys.includes(key));
    const extraRows = extraProps.map(([key, value], index) => `
      <div class="prop-edit-row" data-idx="${index}">
        <input class="prop-edit-key" type="text" value="${Utils.escapeHtml(key)}" placeholder="Nama field" data-orig="${Utils.escapeHtml(key)}"/>
        <input class="prop-edit-val" type="text" value="${Utils.escapeHtml(String(value ?? ''))}" placeholder="Nilai"/>
        <button class="prop-del-btn" data-prop-delete="1" title="Hapus field">✕</button>
      </div>
    `).join('');

    Modal.open(`✏ Edit Bidang${nama ? ` — ${Utils.escapeHtml(nama)}` : ''}`, `
      <div class="modal-stack modal-scroll">
        <div class="prop-simple">
          <div class="prop-row">
            <label class="prop-label">Nama <span class="text-danger">*</span></label>
            <input id="ep-name" class="prop-edit-val" type="text" value="${Utils.escapeHtml(nama)}" placeholder="Nama bidang…"/>
          </div>
          <div class="prop-row">
            <label class="prop-label">Deskripsi</label>
            <input id="ep-desc" class="prop-edit-val" type="text" value="${Utils.escapeHtml(deskripsi)}" placeholder="Deskripsi…"/>
          </div>
          <div class="prop-row">
            <label class="prop-label">SHM</label>
            <input id="ep-shm" class="prop-edit-val" type="text" value="${Utils.escapeHtml(shm)}" placeholder="Nomor SHM…"/>
          </div>
          <div class="prop-row">
            <label class="prop-label">No NIB</label>
            <input id="ep-nib" class="prop-edit-val" type="text" value="${Utils.escapeHtml(nib)}" placeholder="Nomor Induk Berusaha…"/>
          </div>
          <div class="prop-row">
            <label class="prop-label">Luas</label>
            <input id="ep-luas" class="prop-edit-val" type="text" value="${Utils.escapeHtml(luasShm)}" placeholder="Luas…"/>
          </div>
          <div class="prop-row">
            <label class="prop-label">Keterangan</label>
            <input id="ep-ket" class="prop-edit-val" type="text" value="${Utils.escapeHtml(keterangan)}" placeholder="Keterangan…"/>
          </div>
          ${showLuas ? `<div class="prop-row">
            <label class="prop-label">Luas Poligon</label>
            <span class="prop-auto" title="${Utils.escapeHtml(luasPoligon || '')}">${luasPoligon ? Utils.escapeHtml(luasPoligon) : '—'}</span>
          </div>` : ''}
          ${showKeliling ? `<div class="prop-row">
            <label class="prop-label">${panjang ? 'Panjang' : 'Keliling'}</label>
            <span class="prop-auto" title="${Utils.escapeHtml(keliling || panjang || '')}">${(keliling || panjang) ? Utils.escapeHtml(keliling || panjang) : '—'}</span>
          </div>` : ''}
        </div>
        <div class="modal-divider"></div>
        <div class="field-label">Field Tambahan</div>
        <div id="prop-edit-rows">${extraRows}</div>
        <button class="prop-add-btn" data-prop-action="add-row">＋ Tambah Field</button>
      </div>
    `, [
      { label: '💾 Simpan', cls: 'btn-primary', action: () => this.saveEditDirect(true) },
      { label: '🗑 Hapus', cls: 'btn-danger', action: () => { Modal.close(); FeatureManager.deleteSelected(); } },
      { label: 'Batal', cls: 'btn-secondary', action: () => Modal.close() }
    ]);

    const nameEl = document.getElementById('ep-name');
    const descEl = document.getElementById('ep-desc');
    const onKey = (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.saveEditDirect(true); }
    };
    nameEl?.addEventListener('keydown', onKey);
    descEl?.addEventListener('keydown', onKey);
    this._bindPropActions();
    setTimeout(() => nameEl?.focus(), 80);
  },

  // Delegasi aksi form edit (tambah/simpan/hapus field) — dipakai panel sidebar & modal
  _bindPropActions() {
    const root = this._editRoot();
    if (!root || root.dataset.boundPropActions) return;
    root.dataset.boundPropActions = '1';
    root.addEventListener('click', (e) => {
      const addBtn = e.target.closest('[data-prop-action="add-row"]');
      if (addBtn) { e.preventDefault(); this._addRow(); return; }
      const saveBtn = e.target.closest('[data-prop-action="save-edit"]');
      if (saveBtn) { e.preventDefault(); this.saveEditDirect(); return; }
      const delSelBtn = e.target.closest('[data-prop-action="delete-selected"]');
      if (delSelBtn) { e.preventDefault(); FeatureManager.deleteSelected(); return; }
      const delBtn = e.target.closest('[data-prop-delete]');
      if (delBtn) { e.preventDefault(); this._deleteRow(delBtn); }
    });
  },

  _addRow() {
    const container = this._editRoot()?.querySelector('#prop-edit-rows');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'prop-edit-row';
    div.innerHTML = `
      <input class="prop-edit-key" type="text" value="" placeholder="nama_field"/>
      <input class="prop-edit-val" type="text" value="" placeholder="nilai"/>
      <button class="prop-del-btn" data-prop-delete="1" title="Hapus field">✕</button>
    `;
    container.appendChild(div);
    div.querySelector('.prop-edit-key').focus();
  },

  _deleteRow(btn) {
    const row = btn.closest('.prop-edit-row');
    const key = row.querySelector('.prop-edit-key').value || row.querySelector('.prop-edit-key').dataset.orig || '—';
    row.style.transition = 'opacity .15s';
    row.style.opacity = '0';
    setTimeout(() => row.remove(), 150);
    AppConsole.log(`Field "${key}" dihapus (belum disimpan)`, 'warn');
  },

  _commitSelectedFeature({ name, deskripsi = '', extraProps = {}, layerId }) {
    if (!State.selectedFeature) return false;
    normalizeFeatureAreaProps(State.selectedFeature);
    const old = State.selectedFeature.properties || {};
    const preserved = preserveAutoFeatureProps(old);
    State.selectedFeature.properties = { ...preserved, ...extraProps, name, deskripsi };
    refreshFeatureState(State.selectedFeature, layerId);
    History.push({ type: 'edit_props', layerId });
    return true;
  },

  saveEditDirect(closeAfterSave = false) {
    if (!State.selectedFeature) { Toast.show('Pilih fitur dulu di peta', 'warn'); return; }
    const root = this._editRoot();
    const nameEl = root?.querySelector('#ep-name');
    const descEl = root?.querySelector('#ep-desc');
    if (!nameEl) return;
    const name = nameEl.value.trim();
    const desc = descEl ? descEl.value.trim() : '';
    const shmEl = root.querySelector('#ep-shm');
    const shm = shmEl ? shmEl.value.trim() : '';
    const luasShmEl = root.querySelector('#ep-luas');
    const luasShm = luasShmEl ? luasShmEl.value.trim() : '';
    const nibEl = root.querySelector('#ep-nib');
    const nib = nibEl ? nibEl.value.trim() : '';
    const ketEl = root.querySelector('#ep-ket');
    const keterangan = ketEl ? ketEl.value.trim() : '';
    if (!name) { nameEl.style.borderColor = 'var(--danger)'; nameEl.focus(); Toast.show('Nama tidak boleh kosong', 'error'); return; }
    nameEl.style.borderColor = '';

    const { extraProps, hasError } = collectPropertyRows('#prop-edit-rows .prop-edit-row', root);
    if (hasError) { Toast.show('Nama field tidak boleh kosong', 'error'); return; }

    this._commitSelectedFeature({
      name,
      deskripsi: desc,
      extraProps: { ...extraProps, shm, luas: luasShm, nib, keterangan },
      layerId: State.selectedFeatureLayer
    });
    Toast.show(`"${name}" disimpan`, 'success');
    AppConsole.log(`Properties disimpan: ${name}`, 'success');
    if (closeAfterSave) Modal.close();
  },

  _refreshPopup() {
    // Leaflet popup digantikan oleh MapPopup (kiri bawah)
  },

};
