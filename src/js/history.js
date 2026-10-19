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
    // Saat mode menggambar aktif (PC & HP), undo/redo berlaku pada titik
    // gambar — jadi status tombol menyesuaikan jumlah titik, bukan history.
    const inDraw = !!State.activeDrawTool;
    const drawUndo = inDraw && !!(State.activeDrawTool._markers && State.activeDrawTool._markers.length > 0);
    const drawRedo = inDraw && MobileUI._vertexRedo.length > 0;
    const bu = document.getElementById('btn-undo');
    const br = document.getElementById('btn-redo');
    if (bu) bu.style.opacity = (inDraw ? drawUndo : canUndo) ? '1' : '0.4';
    if (br) br.style.opacity = (inDraw ? drawRedo : canRedo) ? '1' : '0.4';
    const mbu = document.getElementById('mb-undo');
    if (mbu) mbu.classList.toggle('mb-disabled', !(inDraw ? drawUndo : canUndo));
    const mbr = document.getElementById('mb-redo');
    if (mbr) mbr.classList.toggle('mb-disabled', !(inDraw ? drawRedo : canRedo));
  }
};
