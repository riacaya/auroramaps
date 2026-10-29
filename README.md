# AuroraMaps — GitHub Pages

## Repo dan alamat situs

- Repo: https://github.com/riacaya/auroramaps
- Alamat GitHub Pages yang dipakai untuk Blogger: https://riacaya.github.io/auroramaps/

Isi repo ini murni **situs web** (`index.html`, `src/`, `assets/`,
`.nojekyll`) — tidak ada lagi berkas Windows/Node di dalamnya. Jika Pages
belum aktif, buka **Settings → Pages**, pilih **Deploy from a branch**,
branch `main`, folder `/(root)`, lalu simpan.

## Fitur cek bidang, zona RTRW & Analisa: pasang ekstensi (sekali klik)

Supaya **komputer mana pun** bisa memakai fitur cek bidang (NIB/luas), zona
RTRW Pro/Kab, dan Analisa dari halaman ini — tanpa memasang aplikasi PC,
tanpa Node.js, tanpa sidecar lokal — pasang ekstensi **AuroraMaps BHUMI
Bridge** sekali di tiap komputer:

1. Klik ikon ekstensi di header aplikasi — file **`Pasang-Ekstensi.bat`**
   terunduh ke folder Download.
2. **DOBEL-KLIK `Pasang-Ekstensi.bat`** — file itu mengunduh komponen
   ekstensi dari halaman ini lalu pintasan **AuroraMaps** muncul di Desktop
   dan langsung membuka aplikasi dengan ekstensi termuat. (Alternatif offline:
   ekstrak `AuroraMaps-BHUMI-Bridge.zip` lalu dobel-klik `Pasang-Ekstensi.bat`
   di dalamnya — pemasang memakai berkas lokal bila ada.)
3. Login BHUMI **sekali** di jendela yang terbuka; jendela itu minimize
   sendiri, sesi dijaga otomatis.

Setelah itu cukup klik pintasan AuroraMaps. Ekstensi menjalankan mesin API
yang sama dengan versi PC (auth-ticket ECDH, whitelist tile, klik
"Saya Setuju", refresh token, analisa) di dalam jendela BHUMI yang dikelola
browser itu sendiri.

Fitur dasar peta (tampilan wilayah, pencarian umum, panduan) tetap jalan
tanpa ekstensi.

## Menampilkan di Blogger

`blogger-page.html` adalah dokumen aplikasi penuh untuk template Blogger:
semua CSS dan modul JavaScript lokal diarahkan ke repo Pages
`riacaya/auroramaps`. Halaman Blogger yang dibuka lewat ekstensi juga
mendapat fitur cek bidang selama ekstensi terpasang.

## Isi folder

- `index.html`: aplikasi untuk GitHub Pages.
- `src/`: modul CSS dan JavaScript (termasuk `src/js/panduan.js` — konten
  panduan yang mengikuti tema aktif).
- `assets/`: data wilayah dalam JavaScript.
- `blogger-page.html`: versi dokumen aplikasi yang merujuk ke file di GitHub Pages.
- `service-worker.js`, `manifest.webmanifest`: dukungan PWA (mode standalone).
- `.nojekyll`: mencegah GitHub Pages memproses folder aset melalui Jekyll.

Yang **tidak ada lagi** di repo ini (dihapus, bekas alur lama): berkas
`.bat`, `local-server.mjs`, `cloudflare-worker.js`, dan folder `tools/`.

## Versi PC, Android, dan ekstensi

Ada di repo sumber (bukan repo ini):

- `windows-app/` — paket Windows (setup + sidecar lokal port 8322).
- `android-app/` — build APK.
- `extension/` + `AuroraMaps-BHUMI-Bridge.zip` — ekstensi peramban untuk
  halaman GitHub/Blogger ini.

## Panduan aplikasi

Buka **Panduan penggunaan** dari menu atau tautan pada panel About untuk
membaca panduan AuroraMaps.

## Instal di Android

Buka https://riacaya.github.io/auroramaps/ langsung di Chrome Android. Jika
tombol **Pasang AuroraMaps** belum muncul, buka menu Chrome (⋮) lalu pilih
**Install app** atau **Tambahkan ke layar utama**. Saat dibuka dari ikon,
aplikasi memakai mode standalone tanpa bilah Chrome. Catatan: fitur cek
bidang di Android memakai APK (android-app), bukan ekstensi peramban.
