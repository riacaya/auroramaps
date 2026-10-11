// =====================================================
// AuroraMaps · history.js — Undo/redo history
// =====================================================
'use strict';

// =====================================================
// HISTORY (UNDO/REDO)
// =====================================================
const History = {
  push(action) {
    State.history = State.history.slice(0, State.historyIndex + 1);
    State.history.push(action);
    State.historyIndex = State.history.length - 1;
    if (State.history.length > Config.maxHistorySize) {
      State.history.shift();
      State.historyIndex--;
    }
    this._updateButtons();
  },

  undo() {
    if (State.historyIndex < 0) { Toast.show('Nothing to undo', 'warn'); return; }
    const action = State.history[State.historyIndex];
    State.historyIndex--;
    AppConsole.log(`Undo: ${action.type}`, 'info');
    Toast.show('Undo: ' + action.type, 'info');
    this._updateButtons();
  },

  redo() {
    if (State.historyIndex >= State.history.length - 1) { Toast.show('Nothing to redo', 'warn'); return; }
    State.historyIndex++;
    const action = State.history[State.historyIndex];
    AppConsole.log(`Redo: ${action.type}`, 'info');
    Toast.show('Redo: ' + action.type, 'info');
    this._updateButtons();
  },

  _updateButtons() {
    const canUndo = State.historyIndex >= 0;
    const canRedo = State.historyIndex < State.history.length - 1;
    document.getElementById('btn-undo').style.opacity = canUndo ? '1' : '0.4';
    document.getElementById('btn-redo').style.opacity = canRedo ? '1' : '0.4';
    const mbu = document.getElementById('mb-undo');
    const mbr = document.getElementById('mb-redo');
    if (mbu) {
      const inDraw = State.activeDrawTool && MobileUI._isMobile();
      const mbCanUndo = inDraw
        ? (State.activeDrawTool._markers && State.activeDrawTool._markers.length > 0)
        : canUndo;
      mbu.classList.toggle('mb-disabled', !mbCanUndo);
    }
    if (mbr) {
      const inDraw = State.activeDrawTool && MobileUI._isMobile();
      const mbCanRedo = inDraw ? MobileUI._vertexRedo.length > 0 : canRedo;
      mbr.classList.toggle('mb-disabled', !mbCanRedo);
    }
  }
};
