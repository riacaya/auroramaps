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
- `src/js/panduan.js`: konten panduan yang dibuka di panel aplikasi dan mengikuti tema aktif.
- `.nojekyll`: mencegah GitHub Pages memproses folder aset melalui Jekyll.
- `local-server.mjs`: server statis + proxy lokal `/bhumi-proxy/*` (WAF bhumi
  butuh Referer `https://bhumi.atrbpn.go.id/` yang tidak bisa dibuat browser).
- `jalankan-auroramaps.bat`: jalankan server + sidecar di PC ini.
- `jalankan-dari-github.bat`: tarik berkas terbaru dari GitHub lalu jalankan.
- `pasang-auroramaps.bat`: pasang sebagai aplikasi Windows (pintasan + .exe).
- `tools/bhumi-bridge/`: sidecar BHUMI (browser pendamping headless).
- `tools/installer/AuroraMaps.cs`: sumber peluncur `AuroraMaps.exe`.

## Menjalankan di PC lain (tarik dari GitHub)

Berkas dan peralatan diambil dari repo ini, tetapi **dijalankan sepenuhnya di PC
tersebut** — tanpa Cloudflare, tanpa npm install, cukup Node.js.

1. Pasang [Git](https://git-scm.com/download/win) dan [Node.js LTS](https://nodejs.org).
2. Ambil berkas sekali: `git clone https://github.com/riacaya/auroramaps.git`
   (atau unduh ZIP dari GitHub lalu ekstrak ke folder mana pun).
3. Klik dua kali **`jalankan-dari-github.bat`**.

Yang dilakukan launcher itu:

- **Perbarui**: `git pull --ff-only` bila folder ini clone git, atau unduh
  `main.zip` bila bukan — jadi tanpa Git pun tetap bisa.
- **Jalankan**: `local-server.mjs` di `http://127.0.0.1:8321` (file statis +
  proxy yang meng-inject Referer bhumi) lalu membuka browser.
- **Sidecar (opsional)**: `tools/bhumi-bridge/sidecar-host.mjs` — Edge/Chrome
  pendamping yang berjalan diam-diam (headless) dan menyimpan sesi login BHUMI
  di `tools/bhumi-bridge/.chrome-bhumi-profile/`. Folder profil itu masuk
  `.gitignore` dan **tidak akan pernah ikut ter-commit**.

Pilihan perintah:

| Perintah | Fungsi |
|---|---|
| `jalankan-dari-github.bat` | perbarui + jalankan (ditanya mau sidecar?) |
| `jalankan-dari-github.bat sidecar` | perbarui + jalankan + sidecar langsung |
| `jalankan-dari-github.bat --hanya-update` | perbarui berkas saja |
| `jalankan-dari-github.bat --tanpa-update` | jalankan tanpa menarik update |
| `tools\bhumi-bridge\jalankan-sidecar.bat --show` | login BHUMI sekali (jendela terbuka) |

> Kenapa lokal, bukan dibuka dari `riacaya.github.io`: halaman https tidak boleh
> memanggil `http://127.0.0.1` (mixed content + izin Local Network Access Chrome),
> dan rute `/bhumi-proxy` hanya ada di server Node lokal.

## Memasang sebagai aplikasi Windows

Agar AuroraMaps tampil seperti aplikasi biasa — ikon di Start Menu/Desktop dan
jendela Chrome **tanpa tab serta bilah** (sama seperti hasil *Install app*) —
dobel-klik `pasang-auroramaps.bat`:

1. Pasang [Node.js LTS](https://nodejs.org) bila belum ada.
2. Dobel-klik `pasang-auroramaps.bat`.
3. Pilih **Y** saat ditanya ingin langsung dijalankan.

Yang dilakukan installer:

- menyalin berkas ke `%LOCALAPPDATA%\Programs\AuroraMaps` (tanpa administrator);
  tambahkan argumen `--program-files` untuk `%ProgramFiles%\AuroraMaps`
  (harus dengan *Run as administrator*);
- mengompilasi `AuroraMaps.exe` memakai compiler bawaan Windows (`csc.exe`
  dari .NET Framework) — tidak perlu memasang toolchain apa pun;
- membuat pintasan **Start Menu** dan **Desktop**.

Cara kerja `AuroraMaps.exe`: menyalakan `local-server.mjs` (jendela
“AuroraMaps Server” diperkecil — tutup jendela itu untuk berhenti) dan sidecar
BHUMI (headless), lalu membuka Chrome/Edge dengan `--app=http://127.0.0.1:8321/`.
Argumen: `--tanpa-jalankan` (pasang saja), dan pada peluncur `--kering`
(cetak rencana tanpa menjalankan) serta `--tanpa-sidecar`.

## Panduan aplikasi

Buka **Panduan penggunaan** dari menu atau tautan pada panel About untuk membaca panduan AuroraMaps.

## Instal di Android

Buka https://riacaya.github.io/auroramaps/ langsung di Chrome Android. Jika tombol **Pasang AuroraMaps** belum muncul, buka menu Chrome (⋮) lalu pilih **Install app** atau **Tambahkan ke layar utama**. Saat dibuka dari ikon, aplikasi memakai mode standalone tanpa bilah Chrome. Tombol pada halaman Blogger membuka versi GitHub Pages yang installable; manifest PWA tidak dapat dipasang lintas origin sebagai aplikasi Blogger.
