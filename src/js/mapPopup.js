// =====================================================
// AuroraMaps · mapPopup.js — Popup bersama di kiri bawah
// Digunakan oleh BhumiIdentify (bidang ATR/BPN) dan fitur manual (polygon/garis/titik)
// Tanpa auto-hide: popup bertahan sampai ditutup manual (tombol ✕ di header)
// atau diganti popup baru saat klik koordinat lain.
// =====================================================
'use strict';

const MapPopup = {
  _el: null,

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
    this._el.classList.toggle('mp-wide', String(html).includes('class="mp-zones"'));
    this._el.innerHTML = html;
    this._el.style.opacity = '0';
    this._el.style.transform = 'translateY(8px)';
    this._el.style.display = '';
    requestAnimationFrame(() => {
      this._el.style.transition = 'opacity .2s ease, transform .2s ease';
      this._el.style.opacity = '1';
      this._el.style.transform = 'none';
    });
  },

  hide() {
    if (this._el) this._el.style.display = 'none';
  }
};
