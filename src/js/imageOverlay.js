// =====================================================
// AuroraMaps · imageOverlay.js — Image overlay manager
// =====================================================
'use strict';

// =====================================================
// IMAGE OVERLAY MANAGER
// =====================================================
const ImageOverlayMgr = {
  _loaded: false,
  _visible: true,
  _handlesActive: false,
  _st: { x: 0, y: 0, w: 400, h: 300 },
  _geoLocked: false,
  _geoNW: null,
  _geoSE: null,
  _wasGeoLocked: false,
  _boundMapMove: null,

  _img()  { return document.getElementById('img-overlay-img'); },
  _wrap() { return document.getElementById('img-overlay-wrap'); },

  open() {
    document.getElementById('img-overlay-input').value = '';
    document.getElementById('img-overlay-input').click();
  },

  loadFile(file) {
    const reader = new FileReader();
    reader.onload = e => this._mount(e.target.result, file.name);
    reader.readAsDataURL(file);
  },

  _mount(url, name) {
    const img = this._img();
    img.src = url;
    img.onload = () => {
      const c  = document.getElementById('map-container');
      const cw = c.offsetWidth, ch = c.offsetHeight;
      const ar = img.naturalWidth / img.naturalHeight;
      let w, h;
      if (ar >= cw / ch) { w = Math.round(cw * 0.72); h = Math.round(w / ar); }
      else               { h = Math.round(ch * 0.72); w = Math.round(h * ar); }
      this._st = { x: Math.round((cw - w) / 2), y: Math.round((ch - h) / 2), w, h };
      this._applyState();

      img.style.opacity = '0.5';
      img.style.display = 'block';
      this._loaded = true;
      this._visible = true;
      this._handlesActive = false;
      this._wrap().classList.remove('handles-active');
      this._unlockFromMap();
      this._geoNW = null; this._geoSE = null; this._wasGeoLocked = false;
      const lb = document.getElementById('iop-btn-lock');
      if (lb) { lb.textContent = '🔗 Kunci'; lb.classList.remove('active'); }

      const fn = (name || 'gambar');
      document.getElementById('iop-filename').textContent = fn.length > 28 ? fn.slice(0,25)+'…' : fn;
      document.getElementById('iop-opacity').value = 50;
      document.getElementById('iop-opacity-val').textContent = '50%';
      document.getElementById('iop-btn-visible').textContent = '👁';
      document.getElementById('iop-btn-visible').classList.add('active');
      document.getElementById('iop-btn-handles').textContent = '⤢ Edit';
      document.getElementById('iop-btn-handles').classList.remove('active');
      document.getElementById('img-overlay-panel').classList.add('active');

      Toast.show('Overlay dimuat — klik tombol Edit untuk mengatur posisi, lalu Simpan. Gambar tetap terlihat tapi tidak menangkap klik saat tidak diedit.', 'info');
    };
  },

  _applyState() {
    const { x, y, w, h } = this._st;
    const map = MapManager.map;
    const nw = map.containerPointToLayerPoint(L.point(x, y));
    const se = map.containerPointToLayerPoint(L.point(x + w, y + h));
    const img = this._img();
    img.style.left = nw.x+'px'; img.style.top  = nw.y+'px';
    img.style.width= (se.x - nw.x)+'px'; img.style.height= (se.y - nw.y)+'px';
    const pos = {
      'ioc-nw': [nw.x-7,   nw.y-7  ],
      'ioc-ne': [se.x-7,   nw.y-7  ],
      'ioc-sw': [nw.x-7,   se.y-7  ],
      'ioc-se': [se.x-7,   se.y-7  ],
    };
    for (const [id,[lx,ly]] of Object.entries(pos)) {
      const el = document.getElementById(id);
      el.style.left = lx+'px'; el.style.top = ly+'px';
    }
  },

  _doLock() {
    const map = MapManager.map;
    const { x, y, w, h } = this._st;
    this._geoNW = map.containerPointToLatLng(L.point(x,     y    ));
    this._geoSE = map.containerPointToLatLng(L.point(x + w, y + h));
    this._geoLocked = true;
    this._wrap().classList.add('geo-locked');
  },

  _unlockFromMap() {
    this._geoLocked = false;
    this._wrap().classList.remove('geo-locked');
  },

  _syncFromGeo() {
    if (!this._geoNW || !this._geoSE) return;
    const map = MapManager.map;
    const nw = map.latLngToContainerPoint(this._geoNW);
    const se = map.latLngToContainerPoint(this._geoSE);
    this._st = { x: nw.x, y: nw.y, w: se.x - nw.x, h: se.y - nw.y };
    this._applyState();
  },

  lockToMap() {
    if (!this._loaded) return;
    const btn = document.getElementById('iop-btn-lock');
    if (this._geoLocked) {
      this._unlockFromMap();
      btn.textContent = '🔗 Kunci'; btn.classList.remove('active');
      Toast.show('Overlay dilepas — posisi bebas dari peta', 'info');
    } else {
      this._doLock();
      btn.textContent = '📌 Terkunci'; btn.classList.add('active');
      Toast.show('Overlay terkunci ke koordinat — ikut zoom & geser peta', 'success');
    }
  },

  setOpacity(val) {
    if (!this._loaded) return;
    if (this._visible) this._img().style.opacity = val/100;
    document.getElementById('iop-opacity-val').textContent = val+'%';
  },

  toggleVisible() {
    if (!this._loaded) return;
    this._visible = !this._visible;
    const img = this._img(), btn = document.getElementById('iop-btn-visible');
    if (this._visible) {
      img.style.opacity = document.getElementById('iop-opacity').value / 100;
      img.style.display = 'block';
      btn.textContent = '👁'; btn.classList.add('active');
    } else {
      img.style.display = 'none';
      btn.textContent = '🚫'; btn.classList.remove('active');
    }
  },

  _ensureVisible() {
    this._visible = true;
    const img = this._img();
    const opVal = Math.max(parseInt(document.getElementById('iop-opacity').value, 10) || 50, 10);
    img.style.display = 'block';
    img.style.opacity = opVal / 100;
    document.getElementById('iop-opacity').value = opVal;
    document.getElementById('iop-opacity-val').textContent = opVal + '%';
    const btnVis = document.getElementById('iop-btn-visible');
    if (btnVis) { btnVis.textContent = '👁'; btnVis.classList.add('active'); }
  },

  toggleHandles() {
    if (!this._loaded) return;
    this._handlesActive = !this._handlesActive;
    const btn = document.getElementById('iop-btn-handles');
    if (this._handlesActive) {
      if (this._geoLocked) { this._wasGeoLocked = true; this._unlockFromMap(); }
      this._wrap().classList.add('handles-active');
      btn.classList.add('active'); btn.textContent = '🔒 Simpan';
      Toast.show('Mode edit posisi aktif — seret gambar atau sudutnya. Klik Simpan untuk selesai.', 'info');
    } else {
      this._wrap().classList.remove('handles-active');
      btn.classList.remove('active'); btn.textContent = '⤢ Edit';
      this._ensureVisible();
      if (this._wasGeoLocked) {
        this._wasGeoLocked = false;
        this._doLock();
        this._syncFromGeo();
        const lb = document.getElementById('iop-btn-lock');
        if (lb) { lb.textContent = '📌 Terkunci'; lb.classList.add('active'); }
        Toast.show('Posisi baru dikunci ke koordinat peta', 'success');
      } else {
        Toast.show('Overlay tersimpan — gambar tetap terlihat, klik diteruskan ke peta untuk gambar poligon', 'success');
      }
    }
  },

  remove() {
    const img = this._img();
    img.src = ''; img.style.display = 'none';
    this._wrap().classList.remove('handles-active');
    this._wrap().classList.remove('geo-locked');
    this._unlockFromMap();
    this._geoNW = null; this._geoSE = null; this._wasGeoLocked = false;
    this._loaded = false; this._visible = true; this._handlesActive = false;
    document.getElementById('img-overlay-panel').classList.remove('active');
    Toast.show('Overlay dihapus', 'info');
  },

  _setupImgDrag() {
    const img = this._img();
    const onDown = (e) => {
      if (!this._loaded) return;
      e.preventDefault(); e.stopPropagation();
      const pt = e.touches ? e.touches[0] : e;
      const sx = pt.clientX, sy = pt.clientY;
      const ox = this._st.x,  oy = this._st.y;
      const wasGeo = this._geoLocked;
      const onMove = (e2) => {
        const p = e2.touches ? e2.touches[0] : e2;
        this._st.x = ox + (p.clientX - sx);
        this._st.y = oy + (p.clientY - sy);
        this._applyState();
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup',   onUp);
        document.removeEventListener('touchend',  onUp);
        if (wasGeo) {
          const map = MapManager.map;
          const { x, y, w, h } = this._st;
          this._geoNW = map.containerPointToLatLng(L.point(x,     y    ));
          this._geoSE = map.containerPointToLatLng(L.point(x + w, y + h));
          this._syncFromGeo();
        }
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('mouseup',   onUp);
      document.addEventListener('touchend',  onUp);
    };
    img.addEventListener('mousedown',  onDown);
    img.addEventListener('touchstart', onDown, { passive: false });
  },

  _setupCornerDrag(id, corner) {
    const el = document.getElementById(id);
    el.addEventListener('mousedown',  e => this._cornerDown(e, corner));
    el.addEventListener('touchstart', e => this._cornerDown(e, corner), { passive: false });
  },

  _cornerDown(e, corner) {
    e.preventDefault(); e.stopPropagation();
    const pt = e.touches ? e.touches[0] : e;
    const sx = pt.clientX, sy = pt.clientY;
    const s0 = { ...this._st };
    const MIN = 50;

    const onMove = (e2) => {
      const p  = e2.touches ? e2.touches[0] : e2;
      const dx = p.clientX - sx, dy = p.clientY - sy;
      let { x, y, w, h } = s0;
      if (corner === 'nw') { x += dx; w -= dx; y += dy; h -= dy; }
      if (corner === 'ne') {          w += dx; y += dy; h -= dy; }
      if (corner === 'sw') { x += dx; w -= dx;          h += dy; }
      if (corner === 'se') {          w += dx;           h += dy; }
      if (w < MIN) { w = MIN; if (corner==='nw'||corner==='sw') x = s0.x + s0.w - MIN; }
      if (h < MIN) { h = MIN; if (corner==='nw'||corner==='ne') y = s0.y + s0.h - MIN; }
      this._st = { x, y, w, h };
      this._applyState();
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mouseup',   onUp);
      document.removeEventListener('touchend',  onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup',   onUp);
    document.addEventListener('touchend',  onUp);
  },

  restoreFromProject(ov) {
    if (!ov || !ov.src) return;
    const img = this._img();
    img.src = ov.src;
    img.onload = () => {
      if (ov.st && Number.isFinite(ov.st.x)) this._st = { ...ov.st };
      this._applyState();

      const opacity = Number.isFinite(ov.opacity) ? ov.opacity : 50;
      this._visible = ov.visible !== false;
      img.style.display  = this._visible ? 'block' : 'none';
      img.style.opacity  = this._visible ? opacity / 100 : 0;

      this._geoLocked = false;
      this._geoNW = null; this._geoSE = null;
      this._wrap().classList.remove('geo-locked');
      if (ov.geoLocked && ov.geoNW && ov.geoSE) {
        this._geoNW = L.latLng(ov.geoNW.lat, ov.geoNW.lng);
        this._geoSE = L.latLng(ov.geoSE.lat, ov.geoSE.lng);
        this._geoLocked = true;
        this._wrap().classList.add('geo-locked');
        this._syncFromGeo();
      }

      this._loaded = true;
      this._handlesActive = false;
      this._wrap().classList.remove('handles-active');

      const fn = ov.filename || 'gambar';
      document.getElementById('iop-filename').textContent = fn.length > 28 ? fn.slice(0,25)+'…' : fn;
      document.getElementById('iop-opacity').value = opacity;
      document.getElementById('iop-opacity-val').textContent = opacity + '%';
      const btnVis = document.getElementById('iop-btn-visible');
      btnVis.textContent = this._visible ? '👁' : '🚫';
      this._visible ? btnVis.classList.add('active') : btnVis.classList.remove('active');
      document.getElementById('iop-btn-handles').textContent = '⤢ Edit';
      document.getElementById('iop-btn-handles').classList.remove('active');
      const lb = document.getElementById('iop-btn-lock');
      if (lb) {
        lb.textContent = this._geoLocked ? '📌 Terkunci' : '🔗 Kunci';
        this._geoLocked ? lb.classList.add('active') : lb.classList.remove('active');
      }
      document.getElementById('img-overlay-panel').classList.add('active');
      Toast.show('Overlay gambar dipulihkan dari proyek', 'info');
    };
  },

  init() {
    document.getElementById('img-overlay-input').addEventListener('change', e => {
      const f = e.target.files[0]; if (f) this.loadFile(f);
    });

    const pane = MapManager.map.getPane('imgOverlayPane');
    if (pane) pane.appendChild(this._wrap());

    this._onMapMove = () => {
      if (this._geoLocked) this._syncFromGeo();
      else this._applyState();
    };
    MapManager.map.on('move zoom moveend zoomend', this._onMapMove);

    const openOrToggle = () => {
      if (this._loaded) document.getElementById('img-overlay-panel').classList.toggle('active');
      else this.open();
    };
    document.getElementById('tb-img-overlay').addEventListener('click', openOrToggle);

    document.getElementById('iop-opacity').addEventListener('input', e => this.setOpacity(+e.target.value));
    document.getElementById('iop-btn-visible').addEventListener('click', () => this.toggleVisible());
    document.getElementById('iop-btn-handles').addEventListener('click', () => this.toggleHandles());
    document.getElementById('iop-btn-lock').addEventListener('click',    () => this.lockToMap());
    document.getElementById('iop-btn-remove').addEventListener('click',  () => this.remove());

    this._setupImgDrag();
    this._setupCornerDrag('ioc-nw', 'nw');
    this._setupCornerDrag('ioc-ne', 'ne');
    this._setupCornerDrag('ioc-sw', 'sw');
    this._setupCornerDrag('ioc-se', 'se');
  }
};
