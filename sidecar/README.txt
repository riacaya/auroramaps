=====================================================
 AURORAMAPS SIDECAR - paket mandiri (tanpa AuroraMaps, tanpa instal Node)
=====================================================
Isi: sidecar (jembatan cek bidang/zona RTRW/analisa BHUMI) + node.exe
portabel + pemasang.

CARA PASANG (sekali saja):
  1. Klik ganda      Pasang-Sidecar.bat
  2. Tunggu sampai   PEMASANGAN SELESAI
  3. Buka app lewat  pintasan "AuroraMaps" di Desktop / menu Mulai
     (jendela aplikasi TANPA bar/tab browser, seperti aplikasi terpasang)
  4. Bila statusnya belum login: jalankan Login-BHUMI.bat sekali,
     klik "Saya Setuju" di jendela pendamping, tutup. Selesai.

YANG TERJADI:
  - Sidecar terpasang di %LOCALAPPDATA%\AuroraMapsSidecar
    (±88 MB, berisi node.exe portabel - TIDAK perlu instal Node)
  - Sidecar berjalan TERSEMBUNYI dan hidup lagi otomatis tiap login Windows
  - Profil sesi BHUMI dibuat & tumbuh OTOMATIS di folder itu
  - Semua browser di PC ini (Chrome/Edge/Firefox) bisa cek bidang dari
    https://riacaya.github.io/auroramaps/ dan https://auroramaps.blogspot.com/
    TANPA ekstensi di browser dan TANPA AuroraMaps.exe

KONFIGURASI DOMAIN YANG DIIZINKAN:
  Edit sidecar-origins.json di folder instalasi (format JSON array),
  lalu hentikan proses node sidecar-host dan jalankan ulang
  (pintasan startup akan menyalakannya lagi di login berikutnya).

MENGHAPUS:
  1. Hapus pintasan "AuroraMaps Sidecar" dari folder Startup
     (%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup)
  2. Hapus pintasan "AuroraMaps" dari Desktop dan menu Mulai
  3. Hapus folder %LOCALAPPDATA%\AuroraMapsSidecar

CATATAN TEKNIS:
  - TIDAK perlu admin, TIDAK perlu instal Node, TIDAK perlu internet saat
    pemasangan (internet hanya diperlukan saat membuka peta)
  - Port lokal 127.0.0.1:8322 - hanya bisa diakses dari PC ini sendiri
  - Pendamping BHUMI berjalan headless (Edge/Chrome bawaan Windows)
  - Profil sesi tumbuh otomatis di %LOCALAPPDATA%\AuroraMapsSidecar
  - Periksa kapan saja: buka http://127.0.0.1:8322/status
  - Sangat jarang: bila node.exe gagal start karena VCRUNTIME140.dll
    hilang, pasang "Microsoft Visual C++ Redistributable" (bawaan
    hampir semua PC Windows 10/11 - Edge/Chrome sudah memakainya)
