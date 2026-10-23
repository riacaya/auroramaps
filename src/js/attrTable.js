// =====================================================
// AuroraMaps · attrTable.js — Attribute table
// =====================================================
'use strict';

// =====================================================
// ATTRIBUTE TABLE
// =====================================================
const AttrTable = {
  currentLayerId: '__all__',
  allRows: [],
  filteredRows: [],
  COLUMNS: [
    ['no', 'No'], ['layer', 'Layer'], ['geometry', 'Geometri'], ['name', 'Nama'],
    ['deskripsi', 'Deskripsi'], ['nib', 'NIB'], ['shm', 'SHM'], ['luas', 'Luas'],
    ['luas_poligon', 'Luas Poligon'], ['radius', 'Jari-jari'], ['keliling', 'Keliling'], ['keterangan', 'Keterangan'],
    ['koordinat', 'Koordinat'], ['maps', 'Maps']
  ],
  // Kolom yang bisa diedit langsung di tabel (ala Excel) — sisanya otomatis/readonly
  EDITABLE_KEYS: { name: 'name', shm: 'shm', nib: 'nib', luas: 'luas', url: 'url', deskripsi: 'deskripsi', keterangan: 'keterangan' },

  // Edit sel → sinkron otomatis ke data fitur, panel edit, popup, dan JSON viewer
  applyCellEdit(row, key, rawValue) {
    if (!row) return false;
    const props = row.feature.properties || (row.feature.properties = {});
    const value = String(rawValue ?? '').trim();
    if (props[key] === value) return false;
    props[key] = value;
    if (State.selectedFeature === row.feature) {
      UI.showProperties(row.feature);
      FeatureEditor._refreshPopup();
      const jsonViewer = document.getElementById('json-viewer');
      if (jsonViewer) jsonViewer.innerHTML = Utils.formatJSON(row.feature);
    }
    History.push({ type: 'edit_props', layerId: row.layerId });
    AppConsole.log(`Atribut "${key}" diperbarui: "${value}"`, 'info');
    return true;
  },

  load() {
    this.loadAll();
  },

  loadAll() {
    this.currentLayerId = '__all__';
    let no = 0;
    this.allRows = State.layers.flatMap(layer => (layer.geoJSON?.features || []).map(feature => ({
      no: ++no,
      feature,
      layerId: layer.id,
      layerName: layer.name,
      geometry: feature.geometry?.type || 'Unknown'
    })));
    this.filteredRows = this.allRows.slice();
    this.render();
    const count = document.getElementById('attr-row-count');
    if (count) count.textContent = `${this.allRows.length} fitur · ${State.layers.length} layer`;
  },

  _values(row) {
    const f = row.feature;
    normalizeFeatureAreaProps(f);
    const p = f.properties || {};
    const m = Utils.calcFeatureMeasurements(f);
    return {
      no: row.no,
      layer: row.layerName || '',
      geometry: row.geometry || 'Unknown',
      name: p.name || p.Name || '',
      shm: p.shm || p.SHM || '',
      nib: p.nib || p.NIB || '',
      keliling: m.keliling || p.keliling || p.panjang || '',
      luas_poligon: m.luas_poligon || p.luas_poligon || '',
      radius: m.radius || p.radius || p.radius_m || '',
      luas: p.luas || p.luas || '',
      maps: p.url || '',
      deskripsi: p.deskripsi || p.description || p.Description || '',
      keterangan: p.keterangan || p.Keterangan || '',
      koordinat: Utils.featureCoordinatesText(f)
    };
  },

  render() {
    const wrap = document.getElementById('attr-table-wrap');
    const rows = this.filteredRows;
    if (!wrap) return;

    if (rows.length === 0) {
      wrap.innerHTML = '<div class="empty-state" style="height:100%"><div class="empty-state-icon">📊</div><div class="empty-state-text">Belum ada fitur untuk ditampilkan.</div></div>';
      return;
    }

    const cols = this.COLUMNS;

    wrap.innerHTML = `<table class="attr-table"><thead><tr>${
      cols.map(([key, label]) => `<th data-attr-sort="${key}" title="Urutkan berdasarkan ${label}" style="cursor:pointer">${label}</th>`).join('')
    }</tr></thead><tbody>${
      rows.map((row, i) => {
        const values = this._values(row);
        return `<tr data-attr-row="${i}">${
          cols.map(([key]) => {
            let value = values[key];
            if (key === 'geometry') value = `${Utils.geomTypeIcon(value)} ${value}`;
            const esc = Utils.escapeHtml(String(value ?? ''));
            if (this.EDITABLE_KEYS[key]) {
              return `<td class="cell-edit-wrap"><input class="cell-edit" data-key="${key}" value="${esc}" title="${esc}" spellcheck="false"/></td>`;
            }
            return `<td class="cell-ro" title="${esc}">${esc}</td>`;
          }).join('')
        }</tr>`;
      }).join('')
    }</tbody></table>`;
    if (!wrap.dataset.boundAttrTable) {
      wrap.dataset.boundAttrTable = '1';
      wrap.addEventListener('click', (e) => {
        const th = e.target.closest('[data-attr-sort]');
        if (th) {
          AttrTable.sortBy(th.dataset.attrSort);
          return;
        }
        const tr = e.target.closest('[data-attr-row]');
        if (tr) AttrTable.selectRow(Number(tr.dataset.attrRow));
      });
      // Edit sel → sinkron otomatis ke data fitur, panel edit, dan popup
      wrap.addEventListener('change', (e) => {
        const input = e.target.closest('.cell-edit');
        if (!input) return;
        const tr = input.closest('[data-attr-row]');
        const row = tr ? AttrTable.filteredRows[Number(tr.dataset.attrRow)] : null;
        AttrTable.applyCellEdit(row, input.dataset.key, input.value);
      });
    }
    this.highlightFeature(State.selectedFeature);
  },

  filter(q) {
    const query = String(q || '').trim().toLowerCase();
    this.filteredRows = query
      ? this.allRows.filter(row => {
          const values = this._values(row);
          return Object.values(values).some(value => String(value ?? '').toLowerCase().includes(query))
            || JSON.stringify(row.feature.properties || {}).toLowerCase().includes(query);
        })
      : this.allRows.slice();
    const count = document.getElementById('attr-row-count');
    if (count) count.textContent = `${this.filteredRows.length} dari ${this.allRows.length} fitur`;
    this.render();
  },

  sortBy(key) {
    this.filteredRows.sort((a, b) => {
      const va = String(this._values(a)[key] ?? '');
      const vb = String(this._values(b)[key] ?? '');
      return va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' });
    });
    this.render();
  },

  selectRow(idx) {
    const row = this.filteredRows[idx];
    if (!row) return;
    const layer = State.layers.find(item => item.id === row.layerId);
    let leafletLayer = layer?.leafletLayer || null;
    if (layer?.leafletLayer && typeof layer.leafletLayer.eachLayer === 'function') {
      layer.leafletLayer.eachLayer(sub => {
        if (sub.feature === row.feature) leafletLayer = sub;
      });
    }
    FeatureSelect.select(row.feature, leafletLayer, row.layerId);
  },

  clear() {
    this.currentLayerId = null;
    this.allRows = [];
    this.filteredRows = [];
    const wrap = document.getElementById('attr-table-wrap');
    if (wrap) wrap.innerHTML = '<div class="empty-state" style="height:100%"><div class="empty-state-icon">📊</div><div class="empty-state-text">Buka file atau gambar fitur untuk melihat semua atribut.</div></div>';
    const cnt = document.getElementById('attr-row-count');
    if (cnt) cnt.textContent = '0 fitur';
  },

  highlightFeature(feature) {
    if (!feature) return;
    const idx = this.filteredRows.findIndex(row => row.feature === feature);
    document.querySelectorAll('.attr-table tbody tr').forEach((row, i) => {
      row.classList.toggle('selected', i === idx);
    });
  }
};
