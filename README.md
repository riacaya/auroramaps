# AuroraMaps — GitHub Pages

## Repo dan alamat situs

- Repo: https://github.com/riacaya/auroramaps
- Alamat GitHub Pages yang dipakai untuk Blogger: https://riacaya.github.io/auroramaps/

Isi repo ini murni **situs web** (`index.html`, `src/`, `assets/`,
`sidecar/`, `.nojekyll`) — berkas proyek Windows/Node lama sudah tidak ada;
`sidecar/` hanya berisi dua berkas unduhan: `Pasang-Sidecar.bat` dan paket
`AuroraMaps-Sidecar.zip`. Jika Pages
belum aktif, buka **Settings → Pages**, pilih **Deploy from a branch**,
branch `main`, folder `/(root)`, lalu simpan.

## Fitur cek bidang, zona RTRW & Analisa: pasang sidecar (sekali klik)

Supaya **komputer mana pun** bisa memakai fitur cek bidang (NIB/luas), zona
RTRW Pro/Kab, dan Analisa dari halaman ini — tanpa memasang aplikasi PC,
tanpa Node.js, tanpa ekstensi peramban — pasang **sidecar AuroraMaps**
sekali di tiap komputer:

1. Klik ikon di header aplikasi — file **`Pasang-Sidecar.bat`** terunduh
   ke folder Download.
2. **DOBEL-KLIK `Pasang-Sidecar.bat`** — file itu mengunduh paket
   `AuroraMaps-Sidecar.zip` (±33 MB, sudah termasuk node.exe portabel)
   dari folder `sidecar/` di halaman ini, mengekstrak ke
   `Downloads\AuroraMaps-Sidecar`, lalu pemasang berjalan: sidecar
   terpasang di `%LOCALAPPDATA%\AuroraMapsSidecar`, berjalan
   **tersembunyi**, dan hidup lagi otomatis tiap login Windows. Pintasan
   **AuroraMaps** (jendela aplikasi tanpa bar browser) muncul di Desktop
   dan menu Mulai.
3. Login BHUMI biasanya terjadi otomatis; bila belum, jalankan
   `Login-BHUMI.bat` sekali lalu klik "Saya Setuju".

Setelah itu semua peramban di komputer itu (Chrome/Edge/Firefox) bisa cek
bidang, zona RTRW, dan Analisa dari halaman ini — tanpa ekstensi apa pun
di peramban. Fitur dasar peta (tampilan wilayah, pencarian umum, panduan)
tetap jalan tanpa sidecar.

## Menampilkan di Blogger

`blogger-page.html` adalah dokumen aplikasi penuh untuk template Blogger:
semua CSS dan modul JavaScript lokal diarahkan ke repo Pages
`riacaya/auroramaps`. Halaman Blogger juga mendapat fitur cek bidang
selama sidecar terpasang di komputer itu.

## Isi folder

- `index.html`: aplikasi untuk GitHub Pages.
- `src/`: modul CSS dan JavaScript (termasuk `src/js/panduan.js` — konten
  panduan yang mengikuti tema aktif).
- `assets/`: data wilayah dalam JavaScript.
- `blogger-page.html`: versi dokumen aplikasi yang merujuk ke file di GitHub Pages.
- `service-worker.js`, `manifest.webmanifest`: dukungan PWA (mode standalone).
- `sidecar/`: dua berkas unduhan saja — `Pasang-Sidecar.bat` (diklik dari
  app) dan `AuroraMaps-Sidecar.zip` (±33 MB, diunduh oleh .bat, sudah
  termasuk semua skrip pemasang + node.exe portabel).
- `.nojekyll`: mencegah GitHub Pages memproses folder aset melalui Jekyll.

Yang **tidak ada lagi** di repo ini (dihapus, bekas alur lama): berkas
`.bat` di root, `local-server.mjs`, `cloudflare-worker.js`, folder `tools/`,
dan folder `ekstensi/` (jalur ekstensi diganti `sidecar/`).

## Versi PC, Android, dan sidecar

Ada di repo sumber (bukan repo ini):

- `windows-app/` — paket Windows (setup + sidecar lokal port 8322).
- `android-app/` — build APK.
- `sidecar-installer/` + `AuroraMaps-Sidecar.zip` — paket sidecar untuk
  halaman GitHub/Blogger ini (disinkron ke folder `sidecar/` repo ini).

## Panduan aplikasi

Buka **Panduan penggunaan** dari menu atau tautan pada panel About untuk
membaca panduan AuroraMaps.

## Instal di Android

Buka https://riacaya.github.io/auroramaps/ langsung di Chrome Android. Jika
tombol **Pasang AuroraMaps** belum muncul, buka menu Chrome (⋮) lalu pilih
**Install app** atau **Tambahkan ke layar utama**. Saat dibuka dari ikon,
aplikasi memakai mode standalone tanpa bilah Chrome. Catatan: fitur cek
bidang di Android memakai APK (android-app), bukan ekstensi peramban.
