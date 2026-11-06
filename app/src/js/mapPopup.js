// =====================================================
// AuroraMaps · mapPopup.js — Popup bersama di kiri bawah
// Digunakan oleh BhumiIdentify (bidang ATR/BPN) dan fitur manual (polygon/garis/titik)
// Tanpa auto-hide: popup bertahan sampai ditutup manual (tombol ✕ di header)
// atau diganti popup baru saat klik koordinat lain.
// =====================================================
'use strict';

const MapPopup = {
  _el: null,

  _fitBetweenBars() {
    if (!this._el) return;
    const header = document.getElementById('header');
    const toolbar = document.getElementById('toolbar');
    const footer = document.getElementById('statusbar');
    const headerBottom = header?.getBoundingClientRect().bottom || 0;
    const toolbarBottom = toolbar && getComputedStyle(toolbar).display !== 'none'
      ? toolbar.getBoundingClientRect().bottom : headerBottom;
    const footerTop = footer && getComputedStyle(footer).display !== 'none'
      ? footer.getBoundingClientRect().top : window.innerHeight;
    const gap = 8;
    const top = Math.max(headerBottom, toolbarBottom) + gap;
    const bottom = Math.max(0, window.innerHeight - footerTop) + gap;
    this._el.style.top = `${top}px`;
    this._el.style.bottom = `${bottom}px`;
    this._el.style.maxHeight = `calc(100dvh - ${top + bottom}px)`;
  },

  _ensureEl() {
    if (this._el) return;
    this._el = document.createElement('div');
    this._el.className = 'map-popup-panel';
    this._el.style.display = 'none';
    document.body.appendChild(this._el);
  },

  /**
   * Tampilkan popup — atau refresh isi popup yang sedang tampil
   * (konten lama langsung diganti, jadi klik koordinat lain = popup baru).
   * @param {string} html — konten HTML
   */
  show(html) {
    this._ensureEl();
    this._el.innerHTML = html;
    this._bindTabs();
    this._fitBetweenBars();
    this._el.style.opacity = '0';
    this._el.style.transform = 'translateY(8px)';
    this._el.style.display = '';
    requestAnimationFrame(() => {
      this._el.style.transition = 'opacity .2s ease, transform .2s ease';
      this._el.style.opacity = '1';
      this._el.style.transform = 'none';
    });
  },

  _bindTabs() {
    if (!this._el) return;
    const tabs = Array.from(this._el.querySelectorAll('[data-mp-tab]'));
    const panes = Array.from(this._el.querySelectorAll('[data-mp-pane]'));
    const selectTab = id => {
      if (!tabs.some(tab => tab.dataset.mpTab === id)) return;
      this._activeTab = id;
      tabs.forEach(tab => {
        const selected = tab.dataset.mpTab === id;
        tab.classList.toggle('active', selected);
        tab.setAttribute('aria-selected', String(selected));
      });
      panes.forEach(pane => { pane.hidden = pane.dataset.mpPane !== id; });
    };
    tabs.forEach(button => button.addEventListener('click', () => selectTab(button.dataset.mpTab)));
    if (tabs.some(tab => tab.dataset.mpTab === this._activeTab)) selectTab(this._activeTab);
    else this._activeTab = tabs.find(tab => tab.getAttribute('aria-selected') === 'true')?.dataset.mpTab || '';
  },

  hide() {
    if (this._el) this._el.style.display = 'none';
  },

  _resizeBound: false,
  bindResize() {
    if (this._resizeBound) return;
    this._resizeBound = true;
    window.addEventListener('resize', () => this._fitBetweenBars());
  }
};

MapPopup.bindResize();
