# AuroraMaps — GitHub Pages

## Repo dan alamat situs

- Repo: https://github.com/riacaya/auroramaps
- Alamat GitHub Pages yang dipakai untuk Blogger: https://riacaya.github.io/auroramaps/

Isi repo ini murni **situs web** (`index.html`, `src/`, `assets/`,
`downloads/`, `.nojekyll`). Unduhan Windows berupa satu ZIP
`downloads/AuroraShell-Windows.zip`; unduhan Android
`downloads/AuroraMaps.apk`. Jika Pages belum aktif, buka
**Settings → Pages**, pilih **Deploy from a branch**, branch `main`,
folder `/(root)`, lalu simpan.

## Fitur cek bidang, zona RTRW & Analisa: jalankan AuroraShell

Supaya **komputer mana pun** bisa memakai fitur cek bidang (NIB/luas), zona
RTRW Pro/Kab, dan Analisa dari halaman ini — tanpa memasang Node.js dan
tanpa ekstensi peramban — pasang **paket AuroraShell** sekali di tiap
komputer:

1. Klik ikon unduh di header aplikasi (atau tombol **Download For Windows**
   di halaman Blogger) — `AuroraShell-Windows.zip` (±1,3 MB) terunduh.
2. Ekstrak zip-nya, lalu **dobel-klik `setup.exe`** untuk memasang pintasan
   Desktop/Start Menu — atau `AuroraShell.exe` untuk langsung menjalankan
   tanpa memasang. Satu EXE memuat cangkang situs ini, pendamping BHUMI
   tersembunyi, dan relai `127.0.0.1:8322`.
   - Syaratnya hanya runtime **Microsoft Edge WebView2**, yang sudah
     terpasang bawaan Windows 11 dan hampir semua Windows 10.
   - Bila Windows menampilkan **"Windows protected your PC"**: klik
     **Info lainnya** lalu **Jalankan saja**. File belum ditandatangani
     sehingga Windows meminta konfirmasi sekali di tiap komputer.
3. Login BHUMI sekali: `AuroraShell.exe --show`, lalu login di jendela
   pendamping yang terbuka. Sesi tersimpan di
   `%LOCALAPPDATA%\AuroraMaps\Bhumi`.

Setelah itu semua peramban di komputer itu (Chrome/Edge/Firefox) bisa cek
bidang, zona RTRW, dan Analisa dari halaman ini — tanpa ekstensi apa pun
di peramban. Fitur dasar peta (tampilan wilayah, pencarian umum, panduan)
tetap jalan tanpa AuroraShell.

## Menampilkan di Blogger

`blogger-page.html` adalah **halaman landing/unduhan** untuk Blogger —
bukan salinan aplikasi. Isinya dua tombol unduhan: APK Android dan
AuroraShell untuk Windows. Halaman ini dihasilkan dari template statis
`blogger-landing.html` oleh `build-blogger.mjs` setiap deploy, lalu isinya
disalin ke editor HTML halaman/post di Blogger
(https://auroramaps.blogspot.com/).

## Isi folder

- `index.html`: aplikasi untuk GitHub Pages.
- `src/`: modul CSS dan JavaScript (termasuk `src/js/panduan.js` — konten
  panduan yang mengikuti tema aktif).
- `assets/`: data wilayah dalam JavaScript.
- `downloads/AuroraShell-Windows.zip`: paket Windows (EXE cangkang WebView2
  + DLL + runtimes + `sidecar-inject.js` + `setup.exe`), dirakit otomatis
  oleh `deploy.ps1` dari `windows-app/`.
- `downloads/AuroraMaps.apk`: cangkang Android.
- `blogger-page.html`: halaman unduhan untuk Blogger.
- `service-worker.js`, `manifest.webmanifest`: dukungan PWA (mode standalone).
- `.nojekyll`: mencegah GitHub Pages memproses folder aset melalui Jekyll.

Yang **tidak ada lagi** di repo ini (dihapus, bekas alur lama): berkas
`.bat` di root, `local-server.mjs`, `cloudflare-worker.js`, folder `tools/`,
folder `ekstensi/`, dan `sidecar/Pasang-Sidecar.exe` (jalur sidecar Node
diganti paket AuroraShell, 6 Nov 2026).

## Versi PC, Android, dan paket Windows

Ada di repo sumber (bukan repo ini):

- `windows-app/` — satu-satunya paket Windows: `AuroraShell.exe` (cangkang
  WebView2 tanpa Node), `setup.exe`, dan sumber `tools/`.
- `android-app/` — build APK.

Paket sidecar Node lama (`sidecar-installer/`, `sfx-build/`,
`Pasang-Sidecar.exe`) sudah dihapus dan tidak dibangun lagi.

## Panduan aplikasi

Buka **Panduan penggunaan** dari menu atau tautan pada panel About untuk
membaca panduan AuroraMaps.

## Instal di Android

Buka https://riacaya.github.io/auroramaps/ langsung di Chrome Android. Jika
tombol **Pasang AuroraMaps** belum muncul, buka menu Chrome (⋮) lalu pilih
**Install app** atau **Tambahkan ke layar utama**. Saat dibuka dari ikon,
aplikasi memakai mode standalone tanpa bilah Chrome. Catatan: fitur cek
bidang di Android memakai APK (android-app), bukan ekstensi peramban.
