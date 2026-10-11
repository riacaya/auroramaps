# AuroraMaps — GitHub Pages

Folder ini berisi situs statis yang siap diunggah ke root repositori GitHub Pages.
Aset CSS, JavaScript, dan data wilayah tetap terpisah; aplikasi memakai endpoint BHUMI sebagai sumber utama dan file JS lokal sebagai fallback.

## Publikasikan ke GitHub Pages

1. Buat repositori GitHub bernama `AuroraMaps` (atau gunakan nama lain).
2. Unggah **isi folder ini** ke root repositori: `index.html`, `src/`, `assets/`, dan file Blogger.
3. Di GitHub, buka **Settings → Pages**. Pilih deploy dari branch `main`, folder `/ (root)`, lalu simpan.
4. Setelah publik, alamatnya berbentuk `https://USERNAME.github.io/AuroraMaps/`.

Jika nama repositori atau akun berbeda, ganti `AuroraMaps` dan `USERNAME` pada `blogger-page.html` serta `blogger-iframe-snippet.html`.

## Pasang pada Blogger

Cara paling sederhana adalah membuka `blogger-iframe-snippet.html`, mengganti `USERNAME`, lalu menempelkan isinya pada editor Blogger dalam mode HTML. Halaman GitHub Pages menjadi host aplikasi; Blogger menampilkan aplikasi melalui iframe.

`blogger-page.html` adalah alternatif bila Anda memang menyisipkan seluruh dokumen aplikasi ke template Blogger. Semua CSS dan modul aplikasi di file itu menunjuk ke GitHub Pages. Ganti placeholder URL sebelum dipakai.

## File penting

- `index.html`: situs GitHub Pages.
- `blogger-page.html`: dokumen aplikasi dengan aset yang diarahkan ke GitHub Pages.
- `blogger-iframe-snippet.html`: potongan untuk menyematkan aplikasi di Blogger.
- `src/`: stylesheet dan modul aplikasi.
- `assets/*.js`: dataset wilayah untuk fallback lokal.

Data wilayah berukuran sekitar 14 MB. GitHub Pages dapat menyajikannya sebagai file statis; unggah semua file `.js` pada `assets/`.
