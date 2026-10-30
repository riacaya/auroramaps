// =====================================================
// AuroraMaps · project.js — Project file manager (.auroramaps)
// =====================================================
'use strict';

// =====================================================
// PROJECT FILE MANAGER
// =====================================================
const ProjectManager = {
  isProjectData(data) {
    return (data?.format === 'auroramaps-project' || data?.format === 'senjamaps-project')
      && Array.isArray(data.layers);
  },

  _safeName(value, fallback = 'auroramaps_proyek') {
    return Utils.safeName(value, fallback);
  },

  _snapshot() {
    return {
      format: 'auroramaps-project',
      version: 1,
      savedAt: new Date().toISOString(),
      projectName: document.getElementById('project-name-display')?.textContent || 'AuroraMaps001',
      language: localStorage.getItem('sm_lang') || 'ID',
      theme: State.theme,
      currentBasemap: State.currentBasemap,
      bookmarks: State.bookmarks,
      mapCenter: MapManager.map ? MapManager.map.getCenter() : null,
      mapZoom: MapManager.map ? MapManager.map.getZoom() : null,
      layers: State.layers.map(layer => ({
        name: layer.name,
        color: layer.color,
        visible: layer.visible,
        opacity: layer.opacity,
        style: layer.style,
         showLabels: layer.showLabels === true,
         labelSource: layer.labelSource || 'name',
         showEdgeLengths: layer.showEdgeLengths !== false,
        meta: layer.meta,
        isDrawn: !!layer.isDrawn,
      geoJSON: Exporter._collectGeoJSON([layer.id])
      })),
    imageOverlay: (() => {
      if (!ImageOverlayMgr._loaded) return null;
      const img = ImageOverlayMgr._img();
      const opacity = parseFloat(document.getElementById('iop-opacity')?.value ?? 50);
      return {
        src:       img.src || null,
        filename:  document.getElementById('iop-filename')?.textContent || 'gambar',
        opacity,
        visible:   ImageOverlayMgr._visible,
        geoLocked: ImageOverlayMgr._geoLocked,
        geoNW: ImageOverlayMgr._geoNW ? { lat: ImageOverlayMgr._geoNW.lat, lng: ImageOverlayMgr._geoNW.lng } : null,
        geoSE: ImageOverlayMgr._geoSE ? { lat: ImageOverlayMgr._geoSE.lat, lng: ImageOverlayMgr._geoSE.lng } : null,
        st: { ...ImageOverlayMgr._st },
      };
    })(),
    };
  },

  save() {
    if (!State.layers.length) {
      Toast.show('Belum ada layer untuk disimpan', 'warn');
      return;
    }
    const data = this._snapshot();
    const name = this._safeName(data.projectName);
    // octet-stream (bukan application/json): di Android, MediaStore menambah/
    // mengganti ekstensi berkas agar cocok dengan MIME → .auroramaps jadi .json.
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/octet-stream' });
    Exporter._download(blob, `${name}.auroramaps`);
    Toast.show(`Proyek "${data.projectName}" disimpan`, 'success');
    AppConsole.log(`Project saved: ${name}.auroramaps`, 'success');
  },

  async openFile(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!this.isProjectData(data)) {
        throw new Error('File bukan proyek AuroraMaps yang valid');
      }
      this.openData(data);
    } catch (e) {
      Toast.show(`Gagal membuka proyek: ${e.message}`, 'error');
      AppConsole.log(`Project load error: ${e.message}`, 'error');
    }
  },

  openData(data) {
    if (!this.isProjectData(data)) throw new Error('File bukan proyek AuroraMaps yang valid');
    if (State.layers.length && !confirm('Buka proyek baru dan mengganti layer yang sedang terbuka?')) return false;
    this.load(data);
    return true;
  },

  load(data) {
    State.layers.slice().forEach(layer => LayerManager.removeLayer(layer.id));
    State.bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks : [];
    State.selectedLayer = null;
    State.selectedFeature = null;
    State.selectedFeatureLayer = null;
    State.expandedLayers = {};
    State.history = [];
    State.historyIndex = -1;
    State.colorIndex = 0;

    data.layers.forEach(saved => {
      if (!saved.geoJSON || !Array.isArray(saved.geoJSON.features)) return;
      const id = LayerManager.addLayer(
        saved.name || 'Layer',
        saved.geoJSON,
        saved.color,
        saved.meta || { source: 'project', format: 'AuroraMaps Project', created: data.savedAt }
      );
      const layer = State.layers.find(item => item.id === id);
      if (!layer) return;
      layer.isDrawn = !!saved.isDrawn;
       layer.showLabels = saved.showLabels === true;
        layer.labelSource = ['name', 'shm', 'luas', 'deskripsi', 'none'].includes(saved.labelSource)
          ? saved.labelSource
          : 'name';
       layer.showEdgeLengths = saved.showEdgeLengths !== false;
      layer.opacity = Number.isFinite(Number(saved.opacity)) ? Number(saved.opacity) : 1;
      layer.style = { ...layer.style, ...(saved.style || {}) };
      const style = layer.style;
      layer.leafletLayer.setStyle?.({
        color: style.strokeColor || style.color || layer.color,
        fillColor: style.fillColor || layer.color,
        fillOpacity: Number(style.fillOpacity ?? 0.35),
        weight: Number(style.strokeWidth ?? style.weight ?? 2),
        opacity: Number(style.strokeOpacity ?? style.opacity ?? 1),
        dashArray: style.dash || style.dashArray || null
      });
      if (saved.visible === false) {
        layer.visible = false;
        MapManager.map.removeLayer(layer.leafletLayer);
      }
       LayerManager.refreshEdgeLabels(layer);
       LayerManager.refreshFeatureLabels(layer);
    });

    if (data.theme) Theme.apply(data.theme);
    if (data.currentBasemap) MapManager.switchBasemap(data.currentBasemap);
    if (data.mapCenter && Number.isFinite(data.mapCenter.lat) && Number.isFinite(data.mapCenter.lng)) {
      MapManager.map.setView([data.mapCenter.lat, data.mapCenter.lng], Number(data.mapZoom) || Config.defaultZoom);
    } else if (State.layers.length) {
      MapManager.zoomToAll();
    }
    if (data.language) {
      localStorage.setItem('sm_lang', data.language === 'EN' ? 'EN' : 'ID');
      LanguageUI.apply(data.language);
    }
    document.getElementById('project-name-display').textContent = data.projectName || 'AuroraMaps001';
    UI.renderFileHistory();
    UI.renderLayerList();
    UI.updateStats();
    Bookmarks.render();
    if (data.imageOverlay) ImageOverlayMgr.restoreFromProject(data.imageOverlay);
    Toast.show(`Proyek "${data.projectName || 'AuroraMaps001'}" berhasil dibuka`, 'success');
    AppConsole.log(`Project loaded: ${State.layers.length} layers`, 'success');
  }
};
