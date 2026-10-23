// =====================================================
// AuroraMaps · feedback.js — Toast + Console + Modal
// =====================================================
'use strict';

// =====================================================
// TOAST
// =====================================================
const Toast = {
  show(msg, type='info') {
    const icons = { info:'ℹ', success:'✓', warn:'⚠', error:'✕' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ'}</span><span>${Utils.escapeHtml(msg)}</span>`;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), Config.toastDuration);
  }
};
// =====================================================
// CONSOLE
// =====================================================
const AppConsole = {
  log(msg, type='info') {
    const el = document.getElementById('console-log');
    const line = document.createElement('div');
    line.className = 'console-line';
    line.innerHTML = `<span class="console-time">${Utils.now()}</span><span class="console-msg ${type}">${Utils.escapeHtml(msg)}</span>`;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  },
  clear() { document.getElementById('console-log').innerHTML = ''; }
};
// =====================================================
// MODAL
// =====================================================
const Modal = {
  open(title, bodyHTML, footer) {
    const modalContainer = document.getElementById('modal-container');
    const canvas = document.getElementById('map-container');
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      modalContainer.style.inset = 'auto';
      modalContainer.style.left = `${r.left}px`;
      modalContainer.style.top = `${r.top}px`;
      modalContainer.style.width = `${r.width}px`;
      modalContainer.style.height = `${r.height}px`;
    }
    const titleEl = document.getElementById('modal-title');
    // Judul boleh sudah memakai emoji; pisahkan agar ikon selalu konsisten.
    const match = String(title).match(/^(\p{Extended_Pictographic}|⚠)\s*/u);
    const icon = match ? match[1] : '▦';
    const label = match ? String(title).slice(match[0].length) : String(title);
    titleEl.replaceChildren();
    const iconEl = document.createElement('span');
    iconEl.className = 'modal-title-icon';
    iconEl.textContent = icon;
    const textEl = document.createElement('span');
    textEl.textContent = label;
    titleEl.append(iconEl, textEl);
    document.getElementById('modal-body').innerHTML = bodyHTML;
    const f = document.getElementById('modal-footer');
    f.innerHTML = '';
    if (footer) {
      footer.forEach(btn => {
        const b = document.createElement('button');
        b.className = 'btn ' + (btn.cls || 'btn-secondary');
        b.textContent = btn.label;
        if (btn.action) b.onclick = btn.action;
        f.appendChild(b);
      });
    }
    modalContainer.classList.add('open');
  },
  close() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.classList.remove('open');
    modalContainer.style.inset = '';
    modalContainer.style.left = '';
    modalContainer.style.top = '';
    modalContainer.style.width = '';
    modalContainer.style.height = '';
    document.querySelector('#modal-container .modal')?.classList.remove('modal-narrow');
  }
};
