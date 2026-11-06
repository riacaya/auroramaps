// =====================================================
// AuroraMaps · storage.js — Persistence (Storage + AutoSave)
// =====================================================
'use strict';

// =====================================================
// STORAGE
// =====================================================
const Storage = {
  save(key, val) {
    try { localStorage.setItem('gisv_' + key, JSON.stringify(val)); } catch(e) {}
  },
  load(key, def) {
    try {
      const v = localStorage.getItem('gisv_' + key);
      return v ? JSON.parse(v) : def;
    } catch(e) { return def; }
  },
  remove(key) { localStorage.removeItem('gisv_' + key); }
};

// =====================================================
// AUTO SAVE
// =====================================================
const AutoSave = {
  timer: null,
  isEnabled() { return Storage.load('autosave-enabled', false) === true; },
  setEnabled(enabled) { Storage.save('autosave-enabled', !!enabled); if (enabled && !this.timer) this.start(); if (!enabled && this.timer) { clearInterval(this.timer); this.timer = null; } },

  start() {
    if (!this.isEnabled() || this.timer) return;
    this.timer = setInterval(() => this.save(), Config.autoSaveInterval);
  },

  save() {
    if (!this.isEnabled()) return;
    const data = {
      projectName: document.getElementById('project-name-display').textContent,
      theme: State.theme,
      bookmarks: State.bookmarks,
      mapCenter: MapManager.map?.getCenter(),
      mapZoom: MapManager.map?.getZoom(),
      currentBasemap: State.currentBasemap,
      lastBhumi: this.lastBhumi || null,
      savedAt: new Date().toISOString()
    };
    Storage.save('autosave', data);
    document.getElementById('status-ready').textContent = 'Auto-saved';
    setTimeout(() => document.getElementById('status-ready').textContent = 'Ready', 2000);
  },

  load() {
    const data = Storage.load('autosave', null);
    if (!data) return;
    if (data.theme) Theme.apply(data.theme);
    if (data.bookmarks) { State.bookmarks = data.bookmarks; Bookmarks.render(); }
    if (data.currentBasemap) MapManager.switchBasemap(data.currentBasemap);
    if (data.mapCenter && data.mapZoom) MapManager.map.setView([data.mapCenter.lat, data.mapCenter.lng], data.mapZoom);
    if (data.projectName) document.getElementById('project-name-display').textContent = data.projectName;
  }
};
