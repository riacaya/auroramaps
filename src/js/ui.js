// =====================================================
// AuroraMaps · ui.js — UI rendering (layers, props, stats)
// =====================================================
'use strict';

// =====================================================
// UI
// =====================================================
const UI = {
  renderLayerList() {
    const el = document.getElementById('layer-list');
    if (State.layers.length === 0) {
      el.innerHTML = `
        <div class="empty-state" style="padding:20px 12px">
          <div style="font-size:28px;margin-bottom:6px">🌅</div>
          <div style="font-size:15px;font-weight:700;color:var(--accent);letter-spacing:.5px;margin-bottom:4px">AuroraMaps001</div>
          <div class="empty-state-text" style="font-size:11px;line-height:1.6">Belum ada layer.<br>Buka file atau gambar di peta.</div>
        </div>`;
      return;
    }
    el.innerHTML = State.layers.map((l) => {
      const isSelected  = l.id === State.selectedLayer;
      const isExpanded  = !!State.expandedLayers[l.id];
      const hasMultiple = (l.featureCount || 0) > 1;

      const expandBtn = hasMultiple
        ? `<button class="layer-expand-btn" data-layer-expand="${l.id}" title="${isExpanded ? 'Ciutkan' : 'Kembangkan'}">${isExpanded ? '▼' : '▶'}</button>`
        : `<span style="width:16px;display:inline-block;flex-shrink:0"></span>`;

      let subLayerHtml = '';
      if (isExpanded && hasMultiple && l.geoJSON?.features) {
        const items = l.geoJSON.features.map((f, fi) => {
          const fname = f.properties?.name || f.properties?.Name || `Fitur ${fi + 1}`;
          const icon  = Utils.geomTypeIcon(f.geometry?.type);
          const isFeatSel = State.selectedFeature === f;
          return `<div class="sublayer-item ${isFeatSel ? 'feat-selected' : ''}"
              data-layer-feature="${l.id}:${fi}">
            <span style="font-size:10px">${icon}</span>
            <span class="sublayer-name" title="${Utils.escapeHtml(fname)}">${Utils.escapeHtml(fname)}</span>
            <button class="sublayer-del-btn" data-feature-remove="${l.id}:${fi}" title="Hapus fitur ini">✕</button>
          </div>`;
        }).join('');

        subLayerHtml = `<div class="sublayer-list">
          ${items}
          <div class="sublayer-add-row">
            <button class="sublayer-add-btn" data-add-layer="${l.id}:poly" title="Gambar polygon baru & masukkan ke layer ini">＋ Bidang</button>
            <button class="sublayer-add-btn" data-add-layer="${l.id}:line" title="Gambar garis baru & masukkan ke layer ini">＋ Garis</button>
            <button class="sublayer-add-btn" data-add-layer="${l.id}:point" title="Tambah titik ke layer ini">＋ Titik</button>
          </div>
        </div>`;
      } else if (!hasMultiple) {
        subLayerHtml = `<div class="sublayer-add-row">
          <button class="sublayer-add-btn" data-add-layer="${l.id}:poly" title="Gambar polygon & tambah ke layer ini">＋ Bidang</button>
          <button class="sublayer-add-btn" data-add-layer="${l.id}:line" title="Gambar garis & tambah ke layer ini">＋ Garis</button>
          <button class="sublayer-add-btn" data-add-layer="${l.id}:point" title="Tambah titik ke layer ini">＋ Titik</button>
        </div>`;
      }

      return `
        <div class="layer-item ${isSelected ? 'selected' : ''} ${l.visible ? '' : 'hidden'}"
             data-layer-id="${l.id}">
          ${expandBtn}
          <div class="layer-color" style="background:${l.color}"></div>
          <div class="layer-name" title="${Utils.escapeHtml(l.name)}">${Utils.escapeHtml(l.name)}</div>
          <div class="layer-count">${l.featureCount}</div>
          <button class="layer-vis-btn" data-layer-visibility="${l.id}" title="Toggle visibility">${l.visible ? '👁' : '○'}</button>
        </div>
        ${subLayerHtml}
      `;
    }).join('');
  },

  // Perbarui sorotan pilihan di daftar layer TANPA membangun ulang seluruh
  // daftar. Memakai renderLayerList() (innerHTML ulang) setiap poligon diklik
  // terasa tersendat di HP bila layer berisi ratusan fitur.
  // Mengembalikan false bila daftar belum terisi (pemanggil pakai render penuh).
  syncSelectionInLayerList() {
    const list = document.getElementById('layer-list');
    if (!list || !list.querySelector('.layer-item')) return false;

    list.querySelectorAll('.layer-item.selected').forEach(el => el.classList.remove('selected'));
    list.querySelectorAll('.sublayer-item.feat-selected').forEach(el => el.classList.remove('feat-selected'));

    if (State.selectedLayer) {
      const item = list.querySelector(`.layer-item[data-layer-id="${State.selectedLayer}"]`);
      if (item) item.classList.add('selected');
    }

    const feature = State.selectedFeature;
    const layerId = State.selectedFeatureLayer;
    if (feature && layerId) {
      const entry = State.layers.find(l => l.id === layerId);
      const index = entry?.geoJSON?.features ? entry.geoJSON.features.indexOf(feature) : -1;
      if (index >= 0) {
        const sub = list.querySelector(`.sublayer-item[data-layer-feature="${layerId}:${index}"]`);
        if (sub) sub.classList.add('feat-selected');
      }
    }
    return true;
  },

  toggleLayerExpand(layerId) {
    State.expandedLayers[layerId] = !State.expandedLayers[layerId];
    this.renderLayerList();
  },

  addToLayer(layerId, drawType) {
    State.drawTargetLayerId = layerId;
    UI.selectLayer(layerId);
    MapManager.startDraw(drawType);
    Toast.show(`Gambar ${drawType === 'poly' ? 'polygon' : drawType === 'line' ? 'garis' : 'titik'} — dobel-klik untuk selesai`, 'info');
  },

  selectLayer(id) {
    State.selectedLayer = id;
    const layer = State.layers.find(l => l.id === id);
    this.renderLayerList();
    if (layer) {
      AttrTable.load();
      UI.showMetadata(layer);
      UI.syncStyleControls(layer);
      UI.showStats();
      if (layer.geoJSON && layer.geoJSON.features && layer.geoJSON.features.length >= 1) {
        const feature = layer.geoJSON.features[0];
        let leafletSub = null;
        if (typeof layer.leafletLayer.eachLayer === 'function') {
          layer.leafletLayer.eachLayer(sub => { if (sub.feature === feature) leafletSub = sub; });
        }
        FeatureSelect.select(feature, leafletSub || layer.leafletLayer, id);
      }
    }
  },

  layerContextMenu(e, id) {
    e.preventDefault();
    const layer = State.layers.find(l => l.id === id);
    if (!layer) return;
    const items = [
      { label: '🔍 Zoom to Layer', action: () => LayerManager.zoomTo(id) },
      { label: '✏ Rename', action: () => {
        const n = prompt('Nama baru:', layer.name);
        if (n) LayerManager.rename(id, n);
      }},
      { label: '↑ Naik', action: () => { LayerManager.moveUp(id); } },
      { label: '↓ Turun', action: () => { LayerManager.moveDown(id); } },
      { sep: true },
      { label: '➕ Add Layer (baru kosong)', action: () => {
        const name = prompt('Nama layer baru:', 'Layer baru');
        if (!name) return;
        const gj = { type: 'FeatureCollection', features: [] };
        LayerManager.addLayer(name, gj, Utils.nextColor());
      }},
      { label: '➕ Add Sub Layer (ke layer ini)', action: () => {
        const name = prompt('Nama sub layer:', layer.name + ' - sub');
        if (!name) return;
        const gj = { type: 'FeatureCollection', features: [] };
        LayerManager.addLayer(name, gj, layer.color);
      }},
      { sep: true },
      { label: '⬇ Simpan GeoJSON', action: () => Exporter.exportGeoJSON(id) },
      { label: '⬇ Simpan KML', action: () => Exporter.exportKML(id) },
      { label: '⬇ Simpan KMZ', action: () => Exporter.exportKMZ(id) },
      { label: '⬇ Simpan CSV', action: () => Exporter.exportCSV(id) },
      { sep: true },
      { label: '⊕ Gabung layer lain ke sini…', action: () => UI.showMergeModal(id) },
      { sep: true },
      { label: '🗑 Hapus Layer', cls: 'danger', action: () => {
        Modal.open('🗑 Hapus Layer', `Hapus layer "<strong>${Utils.escapeHtml(layer.name)}</strong>"? Tidak bisa dibatalkan.`, [
          { label: 'Batal', cls: 'btn-secondary', action: () => Modal.close() },
          { label: 'Hapus', cls: 'btn-danger', action: () => { LayerManager.removeLayer(id); Modal.close(); } }
        ]);
      }},
    ];
    ContextMenuManager._show(e.clientX, e.clientY, items);
  },

  featureContextMenu(e, layerId, featureIndex) {
    e.preventDefault();
    const layer = State.layers.find(l => l.id === layerId);
    if (!layer || !layer.geoJSON?.features?.[featureIndex]) return;
    const feature = layer.geoJSON.features[featureIndex];
    const fname = feature.properties?.name || feature.properties?.Name || feature.properties?.nib || `Fitur ${featureIndex + 1}`;
    const items = [
      { label: `🔍 Zoom ke "${Utils.escapeHtml(fname)}"`, action: () => LayerManager.selectFeatureInLayer(layerId, featureIndex) },
      { label: `✏ Edit Properti`, action: () => {
        LayerManager.selectFeatureInLayer(layerId, featureIndex);
        UI.activateRightTab('panel-props');
        setTimeout(() => FeatureEditor.startEdit(), 60);
      }},
      { sep: true },
      { label: '⬇ Simpan GeoJSON (fitur ini saja)', action: () => Exporter.exportFeatureGeoJSON(layerId, featureIndex) },
      { label: '⬇ Simpan KML (fitur ini saja)', action: () => Exporter.exportFeatureKML(layerId, featureIndex) },
      { label: '⬇ Simpan CSV (fitur ini saja)', action: () => Exporter.exportFeatureCSV(layerId, featureIndex) },
      { sep: true },
      { label: '🗑 Hapus Fitur ini', cls: 'danger', action: () => {
        LayerManager.removeFeatureByIndex(layerId, featureIndex);
      }},
    ];
    ContextMenuManager._show(e.clientX, e.clientY, items);
  },

  showProperties(feature, activate = true) {
    const el = document.getElementById('props-content');
    const props = feature.properties || {};
    const layerId = State.selectedFeatureLayer;
    const layerEntry = layerId ? State.layers.find(l => l.id === layerId) : null;
    const geomType = feature.geometry?.type || '';

    const m = Utils.calcFeatureMeasurements(feature);

    const nama      = props.name || props.Name || '';
    const deskripsi = props.deskripsi || props.description || props.Description || '';
    const shm       = props.shm || props.SHM || '';
    const nib       = props.nib || props.NIB || '';
    const keterangan = props.keterangan || props.Keterangan || '';
    const keliling  = m.keliling || props.keliling || '';
    const luasPoligon = m.luas_poligon || props.luas_poligon || '';
    const luasShm = props.luas || props.luas || '';
    const panjang   = m.panjang  || props.panjang  || '';
    const showKeliling = !!(keliling || panjang || geomType.toLowerCase().includes('linestring') || geomType.toLowerCase().includes('polygon'));
    const showLuas     = !!(luasPoligon || luasShm || geomType.toLowerCase().includes('polygon'));

    const autoKeys = ['_drawType', 'radius', 'radius_m', 'circle_radius_m', 'keliling', 'luas_poligon', 'luas', 'luas', 'panjang', 'jari_jari', 'name', 'Name', 'deskripsi', 'description', 'Description', 'Deskripsi', 'DESKRIPSI', 'shm', 'SHM', 'nib', 'NIB', 'keterangan', 'Keterangan'];
    const extraProps = Object.entries(props).filter(([k]) => !autoKeys.includes(k) && !k.startsWith('_'));
    const extraRows = extraProps.map(([key, value], index) => `
      <div class="prop-edit-row" data-idx="${index}">
        <input class="prop-edit-key" type="text" value="${Utils.escapeHtml(key)}" placeholder="Nama field" data-orig="${Utils.escapeHtml(key)}"/>
        <input class="prop-edit-val" type="text" value="${Utils.escapeHtml(String(value ?? ''))}" placeholder="Nilai"/>
        <button class="prop-del-btn" data-prop-delete="1" title="Hapus field">✕</button>
      </div>
    `).join('');

    el.innerHTML = `
      <div class="modal-stack">
        <div class="stack-gap-10" style="overflow-y:auto;padding:10px">
          <div class="prop-simple">
            <div class="prop-row">
              <label class="prop-label">Nama <span style="color:var(--danger)">*</span></label>
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
        ${layerId ? `<div class="modal-footer-stacked">
        <button class="btn btn-primary modal-btn-full" data-prop-action="save-edit">💾 Simpan</button>
        <button class="btn btn-danger modal-btn-full" data-prop-action="delete-selected">🗑 Hapus</button>
      </div>` : ''}`;

    const nameEl = el.querySelector('#ep-name');
    const descEl = el.querySelector('#ep-desc');
    const onKey = (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        FeatureEditor.saveEditDirect();
      }
    };
    nameEl?.addEventListener('keydown', onKey);
    descEl?.addEventListener('keydown', onKey);
    FeatureEditor._bindPropActions();
    if (activate) this.activateRightTab('panel-props');
  },

  showGeometryInfo(feature, leafletLayer) {
    const el = document.getElementById('geom-content');
    const geom = feature.geometry;
    if (!geom) { el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📐</div><div class="empty-state-text">No geometry.</div></div>'; return; }

    let info = `<div class="geom-info">
      <div class="geom-badge">⬡ ${geom.type}</div>`;

    if (geom.type === 'Point') {
      info += `<div class="geom-row"><span class="geom-lbl">Longitude</span><span class="geom-val">${geom.coordinates[0].toFixed(6)}</span></div>
               <div class="geom-row"><span class="geom-lbl">Latitude</span><span class="geom-val">${geom.coordinates[1].toFixed(6)}</span></div>`;
      if (geom.coordinates[2]) info += `<div class="geom-row"><span class="geom-lbl">Altitude</span><span class="geom-val">${geom.coordinates[2]}</span></div>`;
    } else if (geom.type === 'LineString') {
      const pts = geom.coordinates.map(c => L.latLng(c[1], c[0]));
      const dist = Utils.polylineLength(pts);
      info += `<div class="geom-row"><span class="geom-lbl">Vertices</span><span class="geom-val">${geom.coordinates.length}</span></div>
               <div class="geom-row"><span class="geom-lbl">Length</span><span class="geom-val">${Utils.formatDist(dist)}</span></div>`;
    } else if (geom.type === 'Polygon') {
      const outerRing = geom.coordinates[0];
      const pts = outerRing.map(c => L.latLng(c[1], c[0]));
      const area = Utils.polygonArea(pts);
      const perim = Utils.polylineLength(pts);
      info += `<div class="geom-row"><span class="geom-lbl">Vertices</span><span class="geom-val">${outerRing.length}</span></div>
               <div class="geom-row"><span class="geom-lbl">Rings</span><span class="geom-val">${geom.coordinates.length}</span></div>
               <div class="geom-row"><span class="geom-lbl">Area</span><span class="geom-val">${Utils.formatArea(area)}</span></div>
               <div class="geom-row"><span class="geom-lbl">Perimeter</span><span class="geom-val">${Utils.formatDist(perim)}</span></div>`;
    } else if (geom.type.startsWith('Multi')) {
      info += `<div class="geom-row"><span class="geom-lbl">Parts</span><span class="geom-val">${geom.coordinates.length}</span></div>`;
    }

    info += `</div>`;
    el.innerHTML = info;
  },

  showMetadata(layerEntry) {
    const el = document.getElementById('meta-content');
    const m = layerEntry.meta || {};
    const rows = [
      ['Name', layerEntry.name],
      ['Format', m.format || '—'],
      ['Source', m.source || '—'],
      ['File', m.filename || '—'],
      ['Size', m.size ? (m.size/1024).toFixed(1) + ' KB' : '—'],
      ['Features', layerEntry.featureCount],
      ['Visible', layerEntry.visible ? 'Yes' : 'No'],
      ['Created', m.created ? new Date(m.created).toLocaleString() : '—'],
    ];
    el.innerHTML = `<div class="meta-table">${
      rows.map(([k,v]) => `<div class="meta-row"><span class="meta-key">${k}</span><span class="meta-val">${Utils.escapeHtml(String(v))}</span></div>`).join('')
    }</div>`;
  },

  syncStyleControls(layerEntry) {
    if (!layerEntry) return;
    const style = layerEntry.style || {};
    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (el && value !== undefined && value !== null) el.value = value;
    };
    const fillColor = style.fillColor || style.color || layerEntry.color || '#3b82f6';
    const strokeColor = style.strokeColor || style.color || layerEntry.color || '#1d4ed8';
    const fillOpacity = style.fillOpacity ?? 0.35;
    const strokeWidth = style.strokeWidth ?? style.weight ?? 2;
    const strokeOpacity = style.strokeOpacity ?? style.opacity ?? 1;
    const showLabels = layerEntry.showLabels === true;
    const labelSource = ['name', 'shm', 'luas', 'deskripsi', 'nib', 'keterangan', 'none'].includes(layerEntry.labelSource)
      ? layerEntry.labelSource
      : 'name';
    const dash = style.dash ?? style.dashArray ?? '';

    setValue('style-fill-color', fillColor);
    setValue('style-fill-opacity', fillOpacity);
    setValue('style-stroke-color', strokeColor);
    setValue('style-stroke-width', strokeWidth);
    setValue('style-stroke-opacity', strokeOpacity);
    setValue('style-dash', dash || '');
    const labelToggle = document.getElementById('style-show-labels');
    if (labelToggle) labelToggle.checked = showLabels;
    const labelSourceSelect = document.getElementById('style-label-source');
    if (labelSourceSelect) labelSourceSelect.value = labelSource;
    const edgeLengthToggle = document.getElementById('style-show-edge-lengths');
    if (edgeLengthToggle) edgeLengthToggle.checked = layerEntry.showEdgeLengths !== false;

    const fillOpacityVal = document.getElementById('style-fill-opacity-val');
    const strokeWidthVal = document.getElementById('style-stroke-width-val');
    const strokeOpacityVal = document.getElementById('style-stroke-opacity-val');
    if (fillOpacityVal) fillOpacityVal.textContent = String(fillOpacity);
    if (strokeWidthVal) strokeWidthVal.textContent = String(strokeWidth);
    if (strokeOpacityVal) strokeOpacityVal.textContent = String(strokeOpacity);
  },

  showStats() {
    document.getElementById('stat-layers').textContent = State.layers.length;
    const total = State.layers.reduce((sum, l) => sum + l.featureCount, 0);
    document.getElementById('stat-features').textContent = total;
    const visible = State.layers.filter(l => l.visible).length;
    document.getElementById('stat-visible').textContent = visible;
  },

  updateStats() {
    this.showStats();
    document.getElementById('status-layers').textContent = State.layers.length;
  },

  updateStatusBar() {
    if (!MapManager.map) return;
    const zoom = MapManager.map.getZoom();
    document.getElementById('status-zoom').textContent = zoom;
    document.getElementById('status-scale').textContent = MapManager.getScale ? MapManager.getScale() : '—';
    const key = State.currentBasemap || 'street';
    const cfg = Config.baseLayers[key] || {};
    const nativeMax = cfg.maxNativeZoom ?? cfg.maxZoom ?? '—';
    const maxZoom = cfg.maxZoom ?? '—';
    const label = key === 'satellite' ? 'Satellite' : key === 'topo' ? 'Topo' : key === 'dark' ? 'Rupabumi Indonesia' : 'Street';
    const basemapEl = document.getElementById('status-basemap');
    if (basemapEl) {
      const overNative = Number.isFinite(nativeMax) && Number.isFinite(zoom) && zoom > nativeMax;
      basemapEl.textContent = `${label} · native ${nativeMax} / max ${maxZoom}${overNative ? ' · overzoom' : ''}`;
      basemapEl.style.color = overNative ? 'var(--danger)' : '';
    }
  },

  renderFileHistory() {
    const el = document.getElementById('file-history-list');
    el.innerHTML = State.fileHistory.map(f => `
      <div class="history-item">
        <span class="history-icon">📄</span>
        <div class="history-main">
          <div class="history-name" title="${Utils.escapeHtml(f.name)}">${Utils.escapeHtml(f.name)}</div>
          <div class="history-meta">${f.count} features · ${new Date(f.time).toLocaleTimeString()}</div>
        </div>
      </div>
    `).join('');
  },

  activateRightTab(panelId) {
    document.querySelectorAll('#sidebar-right .sidebar-tab').forEach((t, i) => {
      const target = t.dataset.target;
      t.classList.toggle('active', target === panelId);
      const panel = document.getElementById(target);
      if (panel) panel.classList.toggle('active', target === panelId);
    });
  },

  scrollToLayer(id) {
    requestAnimationFrame(() => {
      const el = document.querySelector('#layer-list .layer-item.selected');
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  },

  showExportModal() {
    const featureCount = State.layers.reduce((n, l) => n + (l.featureCount || 0), 0);
    // Pilihan ganda (format) ditampilkan sebagai daftar centang vertikal;
    // pilihan tunggal (cakupan) memakai dropdown.
    const fmt = (id, label, help, checked) => `
      <label class="exp-check">
        <input type="checkbox" id="exp-format-${id}" class="modal-check"${checked ? ' checked' : ''}/>
        <span class="exp-check-text"><span>${label}</span><span class="exp-check-help">${help}</span></span>
      </label>`;

    // Pilihan terakhir dipersist agar panel export langsung terisi
    // format & cakupan yang biasa dipakai.
    const pref = Storage.load('export-prefs', null);
    const prefFormats = Array.isArray(pref?.formats) && pref.formats.length ? pref.formats : ['geojson'];
    const prefScope = pref?.scope || 'all';

    Modal.open('📥 ' + LanguageUI.t('modal-export-title'),
      `<div class="modal-stack">
        <div class="exp-field">
          <span class="exp-field-label">${LanguageUI.t('modal-export-scope')}</span>
          <select id="exp-scope" class="exp-select">
            <option value="all"${prefScope === 'all' ? ' selected' : ''}>${LanguageUI.t('modal-export-all-scope')} — ${LanguageUI.t('modal-export-all-scope-help')}</option>
            <option value="layer"${prefScope === 'layer' ? ' selected' : ''}>${LanguageUI.t('modal-export-layer-scope')} — ${LanguageUI.t('modal-export-layer-scope-help')}</option>
            <option value="feature"${prefScope === 'feature' ? ' selected' : ''}>${LanguageUI.t('modal-export-feature-scope')} — ${LanguageUI.t('modal-export-feature-scope-help')}</option>
          </select>
        </div>
        <div class="exp-field">
          <span class="exp-field-label">${LanguageUI.t('modal-export-formats')} (boleh lebih dari satu)</span>
          <div class="exp-check-list">
            ${fmt('geojson', LanguageUI.t('modal-export-json'), LanguageUI.t('modal-export-json-help'), prefFormats.includes('geojson'))}
            ${fmt('kml', 'KML', LanguageUI.t('modal-export-kml-help'), prefFormats.includes('kml'))}
            ${fmt('kmz', 'KMZ', LanguageUI.t('modal-export-kmz-help'), prefFormats.includes('kmz'))}
            ${fmt('xlsx', LanguageUI.t('modal-export-excel'), LanguageUI.t('modal-export-excel-help'), prefFormats.includes('xlsx'))}
            ${fmt('kml-poly', LanguageUI.t('modal-export-kml-poly'), LanguageUI.t('modal-export-kml-poly-help'), prefFormats.includes('kml-poly'))}
          </div>
        </div>
        <div class="exp-field exp-output">
          <span class="exp-file-count"><strong id="exp-sum-files">0</strong> file dalam ZIP</span>
        </div>
        <div class="exp-actions">
          <button class="btn btn-secondary" data-export-action="cancel">${LanguageUI.t('modal-import-cancel')}</button>
          <button class="btn btn-primary exp-run" data-export-action="run">📥 Export</button>
        </div>
      </div>`,
      []
    );
    document.querySelector('#modal-container .modal')?.classList.add('modal-narrow');
    const modalBody = document.getElementById('modal-body');
    if (!modalBody) return;
    // Modal.open() selalu menulis ulang isi #modal-body, jadi .modal-stack di
    // dalamnya adalah elemen BARU setiap kali panel dibuka. Ikat aksi ke elemen
    // segar ini tanpa flag "sudah terikat": flag data-bound-* pada #modal-body
    // ikut tersalin saat panel ATRBPN meng-clone node-nya (listener TIDAK ikut
    // tersalin), sehingga tombol Export mati pada buka kedua dan seterusnya.
    const root = modalBody.querySelector('.modal-stack');
    if (!root) return;
    const updateExportSummary = () => {
      const formats = ['geojson', 'kml', 'kmz', 'xlsx', 'kml-poly']
        .filter(f => document.getElementById(`exp-format-${f}`)?.checked);
      const scope = document.getElementById('exp-scope')?.value || 'all';
      const featureCount = State.layers.reduce((n, l) => n + (l.featureCount || 0), 0);
      const files = State.layers.length === 0 ? 0 : (scope === 'all' ? formats.length : formats.length * featureCount);
      const el = document.getElementById('exp-sum-files');
      if (el) el.textContent = files;
    };
    root.addEventListener('click', (e) => {
      const cancelBtn = e.target.closest('[data-export-action="cancel"]');
      if (cancelBtn) { Modal.close(); return; }
      const runBtn = e.target.closest('[data-export-action="run"]');
      if (runBtn) {
        // Ingat pilihan pengguna untuk dibuka kembali di panel berikutnya.
        const chosen = ['geojson', 'kml', 'kmz', 'xlsx', 'kml-poly']
          .filter(f => document.getElementById(`exp-format-${f}`)?.checked);
        Storage.save('export-prefs', {
          formats: chosen.length ? chosen : ['geojson'],
          scope: document.getElementById('exp-scope')?.value || 'all'
        });
        Exporter.runBatchFromModal();
      }
      // click on label triggers radio/checkbox, update after
      requestAnimationFrame(updateExportSummary);
    });
    root.addEventListener('change', updateExportSummary);
    updateExportSummary();
  },

  showImportURLModal() {
    Modal.open('🌐 ' + LanguageUI.t('modal-import-title'),
      `<div class="modal-stack">
        <div class="modal-field">
          <label class="field-label">GeoJSON URL</label>
          <input class="style-input" id="url-input" type="url" placeholder="https://..."/>
        </div>
        <div class="modal-note">
          ${LanguageUI.t('modal-import-desc')}
        </div>
      </div>`,
      [
        { label: LanguageUI.t('modal-import-cancel'), cls: 'btn-secondary', action: () => Modal.close() },
        { label: LanguageUI.t('modal-import-load'), cls: 'btn-primary', action: () => {
          const url = document.getElementById('url-input').value.trim();
          if (!url) return;
          FileManager.loadFromURL(url);
          Modal.close();
        }}
      ]
    );
  },

  showMergeModal(targetId) {
    const target = State.layers.find(l => l.id === targetId);
    if (!target) return;
    const others = State.layers.filter(l => l.id !== targetId);
    if (others.length === 0) { Toast.show('Tidak ada layer lain untuk digabung', 'warn'); return; }

    const checkboxes = others.map(l =>
      `<label class="modal-label-center merge-item">
        <input type="checkbox" value="${l.id}" class="modal-check"/>
        <span class="u-flex-1">${Utils.escapeHtml(l.name)}</span>
        <span class="badge-count">${l.featureCount} fitur</span>
      </label>`
    ).join('');

    Modal.open(`🔀 Gabung Layer ke "${Utils.escapeHtml(target.name)}"`,
      `<div class="modal-stack">
        <div class="modal-note">
          Pilih layer yang ingin digabungkan ke <strong class="text-accent">${Utils.escapeHtml(target.name)}</strong>. Layer sumber akan dihapus setelah digabung.
        </div>
        <div id="merge-layer-list" class="stack-gap-8 modal-list-scroll">
          ${checkboxes}
        </div>
        <div class="row-center">
          <label class="modal-label-center modal-small-label">
            <input type="checkbox" id="merge-select-all" class="modal-check"/>
            ${LanguageUI.t('modal-merge-select-all')}
          </label>
        </div>
        <div class="modal-panel">
          💡 Ingin simpan sebagai file baru (tidak menghapus layer)? Gunakan <strong>Export → Gabung</strong> di toolbar.
        </div>
      </div>`,
      [
        { label: LanguageUI.t('modal-merge-cancel'), cls: 'btn-secondary', action: () => Modal.close() },
        { label: LanguageUI.t('modal-merge-ok'), cls: 'btn-primary', action: () => {
          const checked = [...document.querySelectorAll('#merge-layer-list input[type=checkbox]:checked')].map(cb => cb.value);
          if (checked.length === 0) { Toast.show('Pilih minimal 1 layer', 'warn'); return; }
          Exporter.mergeLayersIntoApp(targetId, checked);
          Modal.close();
        }}
      ]
    );

    setTimeout(() => {
      const sa = document.getElementById('merge-select-all');
      if (sa) sa.addEventListener('change', () => {
        document.querySelectorAll('#merge-layer-list input[type=checkbox]').forEach(cb => cb.checked = sa.checked);
      });
    }, 50);
  },

};
