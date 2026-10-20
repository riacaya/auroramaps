// =====================================================
// AuroraMaps · mobile.js — Mobile UI
// =====================================================
'use strict';

// =====================================================
// MOBILE UI
// =====================================================
const MobileUI = {
  _drawVertexCount: 0,
  _vertexRedo: [],
  _selectedDrawType: null,

  init() {
    if (!this._isMobile()) return;

    const rightSidebar = document.getElementById('sidebar-right');
    const rightBackdrop = document.getElementById('mh-right-backdrop');
    const openRightPanel = (panelId) => {
      if (panelId === 'panel-props' && !State.selectedFeature) {
        Toast.show('Pilih bidang dulu di peta', 'warn'); return;
      }
      UI.activateRightTab(panelId);
      rightSidebar?.classList.add('mobile-open');
      rightBackdrop?.classList.add('open');
    };
    rightBackdrop?.addEventListener('click', () => {
      rightSidebar?.classList.remove('mobile-open');
      rightBackdrop.classList.remove('open');
    });
    document.getElementById('mb-edit').addEventListener('click', () => openRightPanel('panel-props'));
    document.getElementById('mb-style').addEventListener('click', () => openRightPanel('panel-style'));

    document.getElementById('mb-undo').addEventListener('click', () => {
      document.getElementById('btn-undo').click();
    });
    document.getElementById('mb-redo').addEventListener('click', () => {
      document.getElementById('btn-redo').click();
    });

    this._setDrawActionEnabled(false);

    let _lastTapTime = 0;
    document.getElementById('mb-add-point').addEventListener('click', () => {
      document.getElementById('mb-add-point').classList.remove('draw-action-ready');
      const type = this._selectedDrawType;
      if (!type) return;
      if (type === 'point') {
        const markerOptions = MapManager.drawControl.options.draw.marker;
        const marker = L.marker(MapManager.map.getCenter(), markerOptions);
        MapManager.map.fire(L.Draw.Event.CREATED, { layer: marker, layerType: 'marker' });
        return;
      }
      if (!State.activeDrawTool || State.activeDrawType !== type) {
        MapManager.startDraw(type);
        if (type === 'line' || type === 'poly') this._enterDrawMode();
        else Toast.show(`Mode gambar ${this._drawTypeLabel(type)} aktif.`, 'info');
        _lastTapTime = 0;
        return;
      }
      if (!['line', 'poly'].includes(type)) return;
      const now = Date.now();
      const isDoubleTap = (now - _lastTapTime) < 300;
      _lastTapTime = now;

      if (isDoubleTap) {
        const minimumVertices = type === 'line' ? 2 : 3;
        if (this._drawVertexCount >= minimumVertices) {
          try {
            State.activeDrawTool._finishShape();
            // Some Leaflet Draw versions do not emit draw:created before the
            // mobile crosshair is repainted. Force the cleanup after finish.
            setTimeout(() => {
              if (State.activeDrawTool) MapManager._stopDrawTool();
              this._exitDrawMode();
              this._clearDrawSelection();
            }, 120);
          } catch(e) { MapManager._stopDrawTool(); this._exitDrawMode(); this._clearDrawSelection(); }
        } else {
          Toast.show(`Minimal ${minimumVertices} titik untuk selesai`, 'warn');
        }
        return;
      }

      if (!State.activeDrawTool) {
        return;
      }
      const center = MapManager.map.getCenter();
      try {
        State.activeDrawTool.addVertex(center);
        this._vertexRedo = [];
        this._drawVertexCount = State.activeDrawTool._markers
          ? State.activeDrawTool._markers.length
          : this._drawVertexCount + 1;
        if (this._drawVertexCount >= 3) {
          document.getElementById('mb-add-point').classList.add('draw-done');
        }
        History._updateButtons();
      } catch(e) {
        const mapEl = MapManager.map.getContainer();
        const rect  = mapEl.getBoundingClientRect();
        const cx = rect.left + rect.width  / 2;
        const cy = rect.top  + rect.height / 2;
        ['pointerdown','pointerup','click'].forEach(type => {
          mapEl.dispatchEvent(new PointerEvent(type, {
            bubbles: true, cancelable: true,
            clientX: cx, clientY: cy, pointerId: 1
          }));
        });
      }
    });

    MapManager.map.on('draw:created', () => {
      this._exitDrawMode();
      this._clearDrawSelection();
    });

    MapManager.map.on('draw:drawvertex', () => {
      if (State.activeDrawTool && State.activeDrawTool._markers) {
        this._drawVertexCount = State.activeDrawTool._markers.length;
        if (this._drawVertexCount >= 3) {
          document.getElementById('mb-add-point').classList.add('draw-done');
        }
        // Sinkronkan status tombol Undo/Redo (PC & HP) tiap titik ditambah —
        // di PC titik diletakkan dengan klik peta, bukan tombol ini.
        History._updateButtons();
      }
    });

    MapManager.map.on('draw:drawvertex', () => {
      if (!State.activeDrawTool || !State.activeDrawTool._markers) return;
      const markers = State.activeDrawTool._markers;
      if (markers.length < 3) return;
      const first = markers[0].getLatLng();
      const last  = markers[markers.length - 1].getLatLng();
      const dist  = MapManager.map.distance(first, last);
      const threshold = 20 / MapManager.map.getZoomScale(MapManager.map.getZoom(), 0) * 0.1;
      if (dist < Math.max(10, threshold)) {
        setTimeout(() => {
          try { State.activeDrawTool._finishShape(); } catch(e) {}
        }, 50);
      }
    });
  },

  _isMobile() { return window.innerWidth <= 768; },

  selectDrawType(type) {
    if (!['point', 'line', 'poly', 'rect', 'circle'].includes(type)) return;
    if (this._selectedDrawType === type) {
      MapManager.cancelDraw();
      this._exitDrawMode();
      this._clearDrawSelection();
      Toast.show('Mode gambar dibatalkan', 'info');
      return;
    }
    MapManager.cancelDraw();
    this._exitDrawMode();
    this._selectedDrawType = type;
    document.querySelectorAll('.draw-tools-btn').forEach(button => {
      button.classList.toggle('selected', button.id === `dt-${type}`);
    });
    this._setDrawActionEnabled(true);
    if (type === 'point') {
      if (window.BhumiIdentify) BhumiIdentify.pauseOverlay();
      this._enterDrawMode(type);
    } else {
      MapManager.startDraw(type);
      if (type === 'line' || type === 'poly') this._enterDrawMode();
    }
    const add = document.getElementById('mb-add-point');
    add.title = ['line', 'poly'].includes(type)
      ? `Tambah titik ${this._drawTypeLabel(type)}; ketuk dua kali untuk selesai`
      : `Mode gambar ${this._drawTypeLabel(type)} aktif`;
    add.setAttribute('aria-label', add.title);
    add.classList.add('draw-action-ready');
    add.focus({ preventScroll: true });
    add.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    Toast.show(type === 'point'
      ? 'Geser peta untuk mengatur titik di tengah crosshair, lalu tekan +.'
      : type === 'line' || type === 'poly'
        ? `Mode ${this._drawTypeLabel(type)} aktif. Tekan + untuk menambah titik.`
        : `Mode gambar ${this._drawTypeLabel(type)} aktif.`, 'info');
  },

  _setDrawActionEnabled(enabled) {
    const add = document.getElementById('mb-add-point');
    if (!add) return;
    add.disabled = !enabled;
    add.setAttribute('aria-disabled', String(!enabled));
  },

  _clearDrawSelection() {
    this._selectedDrawType = null;
    document.querySelectorAll('.draw-tools-btn').forEach(button => button.classList.remove('selected'));
    this._setDrawActionEnabled(false);
    const add = document.getElementById('mb-add-point');
    if (add) {
      add.classList.remove('draw-action-ready');
      add.title = 'Pilih alat gambar terlebih dahulu';
      add.setAttribute('aria-label', add.title);
    }
  },

  _drawTypeLabel(type) {
    return ({ point: 'titik', line: 'garis', poly: 'poligon', rect: 'kotak', circle: 'lingkaran' })[type] || type;
  },

  _enterDrawMode(type = this._selectedDrawType) {
    this._drawVertexCount = 0;
    this._vertexRedo = [];
    document.getElementById('map-container')?.classList.toggle('point-placement-focus', type === 'point');
    const crosshair = document.getElementById('mobile-crosshair');
    if (crosshair) {
      crosshair.classList.add('is-visible');
      crosshair.style.display = 'block';
    }
    const add = document.getElementById('mb-add-point');
    add.classList.remove('draw-done');
    add.classList.remove('pending-bhumi-draw');
    History._updateButtons();
    const dt = State.activeDrawTool;
    if (dt) {
      const map = MapManager.map;
      if (typeof dt._onTouch === 'function') map.off('touchstart', dt._onTouch, dt);
      if (typeof dt._onMouseUp === 'function') map.off('mouseup', dt._onMouseUp, dt);
      if (dt._mouseMarker) {
        if (typeof dt._onMouseDown === 'function') dt._mouseMarker.off('mousedown', dt._onMouseDown, dt);
        if (typeof dt._onMouseUp  === 'function') dt._mouseMarker.off('mouseup',  dt._onMouseUp,  dt);
      }
    }
    Toast.show('Tap + tambah titik · Double-tap + untuk selesai', 'info');
  },

  _exitDrawMode() {
    document.getElementById('map-container')?.classList.remove('point-placement-focus');
    const crosshair = document.getElementById('mobile-crosshair');
    if (crosshair) {
      crosshair.classList.remove('is-visible');
      crosshair.style.display = 'none';
    }
    const add = document.getElementById('mb-add-point');
    add.classList.remove('draw-done');
    this._drawVertexCount = 0;
    this._vertexRedo = [];
    History._updateButtons();
  }
};
