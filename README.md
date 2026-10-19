# AuroraMaps — GitHub Pages

## Repo dan alamat situs

- Repo: https://github.com/riacaya/auroramaps
- Alamat GitHub Pages yang dipakai untuk Blogger: https://riacaya.github.io/auroramaps/

Unggah isi folder ini ke root repo `riacaya/auroramaps` (termasuk `index.html`, `src/`, `assets/`, dan `.nojekyll`). Lalu di GitHub buka **Settings → Pages**, pilih **Deploy from a branch**, branch `main`, folder `/(root)`, lalu simpan. Jika Pages belum aktif, alamat situs mungkin belum bisa dibuka sampai GitHub selesai menerbitkannya.

## Menampilkan di Blogger

Cara yang disarankan: buka `blogger-iframe-snippet.html`, salin seluruh isinya, lalu tempel di editor Blogger dalam mode HTML. Iframe akan menampilkan situs GitHub Pages.

`blogger-page.html` adalah alternatif dokumen aplikasi penuh. Semua CSS dan modul JavaScript lokal diarahkan ke repo Pages `riacaya/auroramaps`; file ini dapat dipakai bila Anda memasang seluruh dokumen aplikasi ke template Blogger.

## Isi folder

- `index.html`: aplikasi untuk GitHub Pages.
- `src/`: modul CSS dan JavaScript.
- `assets/`: data wilayah dalam JavaScript.
- `blogger-page.html`: versi dokumen aplikasi yang merujuk ke file di GitHub Pages.
- `blogger-iframe-snippet.html`: kode semat untuk Blogger.
- `panduan.html`: panduan lengkap aplikasi yang dapat dibuka dari menu.
- `.nojekyll`: mencegah GitHub Pages memproses folder aset melalui Jekyll.

## Panduan aplikasi

Buka [panduan.html](panduan.html) untuk membaca panduan penggunaan AuroraMaps.

## Instal di Android

Buka https://riacaya.github.io/auroramaps/ langsung di Chrome Android. Jika tombol **Pasang AuroraMaps** belum muncul, buka menu Chrome (⋮) lalu pilih **Install app** atau **Tambahkan ke layar utama**. Saat dibuka dari ikon, aplikasi memakai mode standalone tanpa bilah Chrome. Tombol pada halaman Blogger membuka versi GitHub Pages yang installable; manifest PWA tidak dapat dipasang lintas origin sebagai aplikasi Blogger.
