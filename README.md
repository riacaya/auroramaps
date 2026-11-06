# AuroraMaps — GitHub Pages

## Repo dan alamat situs

- Repo: https://github.com/riacaya/auroramaps
- Beranda (halaman unduhan): https://riacaya.github.io/auroramaps/
- Aplikasi web (dimuat cangkang): https://riacaya.github.io/auroramaps/app/
- Dipakai juga oleh halaman Blogger: https://auroramaps.blogspot.com/

Repo ini berisi **situs unduhan + aplikasi web**. Akar situs hanya
menampilkan halaman unduhan (`index.html`, isinya sama dengan `home.html`);
aplikasi penuh tinggal di `app/` dan dimuat oleh AuroraShell di PC serta APK
Android — pengunjung tidak diarahkan ke sana.

Jika Pages belum aktif, buka **Settings → Pages**, pilih
**Deploy from a branch**, branch `main`, folder `/(root)`, lalu simpan.

## Fitur cek bidang, zona RTRW & Analisa: jalankan AuroraShell

Supaya **komputer mana pun** bisa memakai fitur cek bidang (NIB/luas), zona
RTRW Pro/Kab, dan Analisa — tanpa memasang Node.js dan tanpa ekstensi
peramban — pasang **paket AuroraShell** sekali di tiap komputer:

1. Klik tombol **Download For Windows** di beranda — `AuroraShell-Windows.zip`
   (±1,3 MB) terunduh.
2. Ekstrak zip-nya, lalu **dobel-klik `setup.exe`** untuk memasang pintasan
   Desktop/Start Menu — atau `AuroraShell.exe` untuk langsung menjalankan
   tanpa memasang. Satu EXE memuat cangkang `/app/`, pendamping BHUMI
   tersembunyi, dan relai `127.0.0.1:8322`.
   - Syaratnya hanya runtime **Microsoft Edge WebView2**, yang sudah
     terpasang bawaan Windows 11 dan hampir semua Windows 10.
   - Bila Windows menampilkan **"Windows protected your PC"**: klik
     **Info lainnya** lalu **Jalankan saja**. File belum ditandatangani
     sehingga Windows meminta konfirmasi sekali di tiap komputer.
3. Login BHUMI sekali: `AuroraShell.exe --show`, lalu login di jendela
   pendamping yang terbuka. Sesi tersimpan di
   `%LOCALAPPDATA%\AuroraMaps\Bhumi`.

Fitur dasar peta (tampilan wilayah, pencarian umum, panduan) tetap jalan
tanpa AuroraShell.

## Isi folder

- `index.html`: beranda situs — halaman unduhan (APK + AuroraShell).
- `home.html`: halaman yang sama, versi untuk ditempel ke Blogger; keduanya
  dihasilkan otomatis dari `blogger-landing.html` oleh `build-blogger.mjs`.
- `app/`: aplikasi web penuh (`index.html`, `src/`, `assets/`,
  `service-worker.js`, `manifest.webmanifest`) — dimuat oleh AuroraShell dan
  APK Android.
- `downloads/AuroraShell-Windows.zip`: paket Windows (EXE cangkang WebView2 +
  DLL + runtimes + `sidecar-inject.js` + `setup.exe`), dirakit otomatis oleh
  `deploy.ps1` dari `windows-app/`.
- `downloads/AuroraMaps.apk`: cangkang Android.
- `.nojekyll`: mencegah GitHub Pages memproses folder aset melalui Jekyll.

Yang **tidak ada lagi** di repo ini (dihapus, bekas alur lama): berkas
`.bat` di root, `local-server.mjs`, `cloudflare-worker.js`, folder `tools/`,
folder `ekstensi/`, `sidecar/Pasang-Sidecar.exe` (diganti paket AuroraShell,
6 Nov 2026), dan `blogger-page.html` (diganti `home.html`).

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

Unduh https://riacaya.github.io/auroramaps/downloads/AuroraMaps.apk lalu buka
file-nya (izinkan pemasangan dari sumber tidak dikenal bila diminta). APK
adalah cangkang: seluruh isi aplikasi dimuat dari `/app/` di GitHub Pages,
jadi perubahan situs langsung terbawa tanpa build ulang. Fitur cek bidang di
Android memakai APK (android-app), bukan ekstensi peramban.
