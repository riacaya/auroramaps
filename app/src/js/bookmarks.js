// =====================================================
// AuroraMaps · bookmarks.js — Bookmarks + context menu
// =====================================================
'use strict';

// =====================================================
// BOOKMARKS
// =====================================================
const Bookmarks = {
  add() {
    const center = MapManager.map.getCenter();
    const zoom = MapManager.map.getZoom();
    const name = prompt('Bookmark name:') || `View @ z${zoom}`;
    const bm = { id: Utils.id(), name, lat: center.lat, lng: center.lng, zoom, time: new Date().toISOString() };
    State.bookmarks.push(bm);
    this.render();
    Storage.save('bookmarks', State.bookmarks);
    Toast.show(`Bookmark "${name}" saved`, 'success');
  },

  goTo(id) {
    const bm = State.bookmarks.find(b => b.id === id);
    if (!bm) return;
    MapManager.map.setView([bm.lat, bm.lng], bm.zoom);
    AppConsole.log(`Jumped to bookmark: ${bm.name}`, 'info');
  },

  remove(id) {
    State.bookmarks = State.bookmarks.filter(b => b.id !== id);
    this.render();
    Storage.save('bookmarks', State.bookmarks);
  },

  render() {
    const el = document.getElementById('bookmark-list');
    if (!el) return;
    if (State.bookmarks.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔖</div><div class="empty-state-text">No bookmarks.<br>Right-click the map to add one.</div></div>';
      return;
    }
    el.innerHTML = State.bookmarks.map(b => `
      <div class="bookmark-item">
        <span class="bookmark-icon">🔖</span>
        <div class="bookmark-jump" data-bookmark-id="${b.id}">
          <div class="bookmark-name">${Utils.escapeHtml(b.name)}</div>
          <div class="bookmark-meta">z${b.zoom} · ${Utils.coordStr(b.lat, b.lng)}</div>
        </div>
        <button class="panel-action-btn" data-bookmark-remove="${b.id}" title="Delete">✕</button>
      </div>
    `).join('');
  }
};

// =====================================================
// CONTEXT MENU
// =====================================================
const ContextMenuManager = {
  showMapMenu(e) {
    const { lat, lng } = e.latlng;
    const items = [
      { label: '📍 Add Marker Here', action: () => {
        const c = Utils.nextColor();
        const marker = L.circleMarker([lat, lng], { radius: 6, color: c, fillColor: c, fillOpacity: 0.8, weight: 2 });
        const feat = { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { name: nextAutoFeatureName(), deskripsi: '', _drawType: 'point' } };
        MapManager.drawnItems.addLayer(marker);
        const newId = LayerManager.addDrawnLayer(marker, feat, 'point', c);
        UI.renderLayerList();
        UI.updateStats();
        FeatureSelect.select(marker.feature, marker, newId);
        AppConsole.log(`Marker otomatis diberi nama ${feat.properties.name}`, 'success');
      }},
      { label: '🔖 Add Bookmark Here', action: () => {
        const name = prompt('Bookmark name:') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        State.bookmarks.push({ id: Utils.id(), name, lat, lng, zoom: MapManager.map.getZoom(), time: new Date().toISOString() });
        Bookmarks.render();
        Toast.show('Bookmark saved', 'success');
      }},
      { label: '📋 Copy Coordinates', action: () => {
        navigator.clipboard.writeText(Utils.coordStr(lat, lng));
        Toast.show('Coordinates copied!', 'success');
      }},
      { sep: true },
      { label: '📏 Measure from here', action: () => MapManager.startMeasureDist() },
    ];
    this._show(e.originalEvent.clientX, e.originalEvent.clientY, items);
  },

  showFeatureMenu(e, layer, layerId) {
    const layerEntry = State.layers.find(l => l.id === layerId);
    const featureName = layer.feature?.properties?.name || layerEntry?.name || 'Fitur';
    const items = [
      { label: `✏ Edit Properti — "${Utils.escapeHtml(featureName)}"`, action: () => {
        if (layer.feature) FeatureSelect.select(layer.feature, layer, layerId);
        UI.activateRightTab('panel-props');
        setTimeout(() => FeatureEditor.startEdit(), 60);
      }},
      { label: '🔍 Zoom ke Fitur', action: () => {
        try { MapManager.map.fitBounds(layer.getBounds ? layer.getBounds() : layer.getLatLng().toBounds(100), { padding: [30,30] }); } catch(ex) {}
      }},
      { label: '⧉ Salin sebagai GeoJSON', action: () => {
        navigator.clipboard.writeText(JSON.stringify(layer.toGeoJSON ? layer.toGeoJSON() : {}, null, 2));
        Toast.show('Disalin sebagai GeoJSON', 'success');
      }},
      { sep: true },
      { label: '🗑 Hapus Bidang ini', cls: 'danger', action: () => {
        if (layer.feature) FeatureSelect.select(layer.feature, layer, layerId);
        FeatureManager.deleteSelected();
      }},
    ];
    this._show(e.originalEvent.clientX, e.originalEvent.clientY, items);
  },

  _show(x, y, items) {
    const menu = document.getElementById('context-menu');
    const nonSep = items.filter(item => !item.sep);

    menu.innerHTML = items.map(item => {
      if (item.sep) return '<div class="ctx-sep"></div>';
      return `<div class="ctx-item${item.cls ? ' ' + item.cls : ''}">${item.label}</div>`;
    }).join('');

    menu.querySelectorAll('.ctx-item').forEach((el, i) => {
      el.addEventListener('click', () => { nonSep[i]?.action?.(); this.hide(); });
    });

    menu.style.display = 'block';
    menu.style.left = Math.min(x, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - menu.offsetHeight - 10) + 'px';
  },

  hide() {
    document.getElementById('context-menu').style.display = 'none';
  }
};
