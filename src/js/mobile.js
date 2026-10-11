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

  init() {
    if (!this._isMobile()) return;

    const _mhOpen = document.getElementById('mh-open');
    if (_mhOpen) _mhOpen.addEventListener('click', () => {
      document.getElementById('file-input').click();
    });
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

    let _lastTapTime = 0;
    document.getElementById('mb-add-point').addEventListener('click', () => {
      const now = Date.now();
      const isDoubleTap = (now - _lastTapTime) < 300 && State.activeDrawTool;
      _lastTapTime = now;

      if (isDoubleTap) {
        if (this._drawVertexCount >= 3) {
          try {
            State.activeDrawTool._finishShape();
            // Some Leaflet Draw versions do not emit draw:created before the
            // mobile crosshair is repainted. Force the cleanup after finish.
            setTimeout(() => {
              if (State.activeDrawType === 'poly') MapManager._stopDrawTool();
              this._exitDrawMode();
            }, 120);
          } catch(e) { MapManager._stopDrawTool(); this._exitDrawMode(); }
        } else {
          Toast.show('Minimal 3 titik untuk selesai', 'warn');
        }
        return;
      }

      if (!State.activeDrawTool) {
        document.getElementById('mb-add-point')?.classList.remove('pending-bhumi-draw');
        MapManager.startDraw('poly');
        this._enterDrawMode();
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
    });

    MapManager.map.on('draw:drawvertex', () => {
      if (State.activeDrawTool && State.activeDrawTool._markers) {
        this._drawVertexCount = State.activeDrawTool._markers.length;
        if (this._drawVertexCount >= 3) {
          document.getElementById('mb-add-point').classList.add('draw-done');
        }
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

  _enterDrawMode() {
    this._drawVertexCount = 0;
    this._vertexRedo = [];
    document.getElementById('mobile-crosshair').style.display = 'block';
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
    document.getElementById('mobile-crosshair').style.display = 'none';
    const add = document.getElementById('mb-add-point');
    add.classList.remove('draw-done');
    this._drawVertexCount = 0;
    this._vertexRedo = [];
    History._updateButtons();
  }
};
