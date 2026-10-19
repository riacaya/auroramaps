# Panduan Penggunaan AuroraMaps

Panduan ini menjelaskan alur penggunaan AuroraMaps versi web dan Android. Nama menu merujuk pada antarmuka berbahasa Indonesia. Beberapa layanan peta, pencarian, dan data ATR/BPN memerlukan koneksi internet.

## Daftar isi

1. [Memulai](#memulai)
2. [Mengenali tampilan](#mengenali-tampilan)
3. [Navigasi peta dan pencarian](#navigasi-peta-dan-pencarian)
4. [Membuka dan mengelola data](#membuka-dan-mengelola-data)
5. [Menggambar dan mengedit fitur](#menggambar-dan-mengedit-fitur)
6. [Mengatur tampilan layer](#mengatur-tampilan-layer)
7. [Menyimpan proyek](#menyimpan-proyek)
8. [Impor dan ekspor](#impor-dan-ekspor)
9. [Mencetak peta](#mencetak-peta)
10. [Gambar referensi dan overlay](#gambar-referensi-dan-overlay)
11. [ATR/BPN](#atrbpn)
12. [GPS dan pengukuran](#gps-dan-pengukuran)
13. [Peta 3D dan peta dasar](#peta-3d-dan-peta-dasar)
14. [Mode offline dan pengaturan](#mode-offline-dan-pengaturan)
15. [Penggunaan di ponsel](#penggunaan-di-ponsel)
16. [Pemecahan masalah](#pemecahan-masalah)

## Memulai

1. Buka AuroraMaps melalui alamat aplikasi dan masuk atau buat akun jika halaman meminta autentikasi.
2. Pastikan koneksi internet tersedia saat pertama kali membuka peta, mencari lokasi, atau mengambil peta dasar.
3. Untuk memakai lokasi dan GPS, izinkan akses lokasi pada prompt browser. Fitur lokasi memerlukan HTTPS atau `localhost` dan izin lokasi browser.
4. Sebelum mulai mengedit data penting, siapkan berkas proyek `.auroramaps` untuk menyimpan hasil kerja secara berkala.

Jangan membagikan kata sandi atau informasi akun di berkas proyek maupun panduan ini.

## Mengenali tampilan

- **Header/toolbar**: pencarian, berkas, overlay, impor URL, ATR/BPN, simpan, ekspor, cetak, rekam GPS, dan Fit All.
- **Panel kiri**: tab **Layer**, **File**, dan **Bookmark** untuk mengelola data, berkas, serta lokasi tersimpan.
- **Peta**: area utama untuk melihat, memilih, menggambar, dan mengukur fitur.
- **Alat gambar**: titik, garis, poligon, persegi, dan lingkaran.
- **Panel kanan**: tab **Edit**, **Style**, **Geom**, **Stats**, dan **Meta** untuk melihat atau mengubah fitur terpilih.
- **Panel bawah**: tabel atribut, tampilan JSON, konsol, dan koordinat.
- **Kontrol peta**: zoom, lokasi, tampilan 3D, dan pilihan peta dasar.

Di layar kecil, panel dan alat dapat dipindahkan ke menu atau modal. Nama fitur tetap mengikuti fungsi yang sama.

## Navigasi peta dan pencarian

- Geser peta dengan menariknya. Gunakan tombol `+`/`−` atau roda mouse untuk zoom.
- Tekan **Fit All** untuk menyesuaikan tampilan ke seluruh data yang sedang dimuat.
- Ketik nama tempat atau koordinat pada kotak pencarian. Pilih saran atau tekan Enter. Pencarian nama tempat memakai layanan geocoding online dan cakupannya Indonesia.
- Klik kanan pada peta untuk menambahkan penanda, membuat bookmark, menyalin koordinat, atau memulai pengukuran.
- Dari tab **Bookmark**, pilih lokasi tersimpan untuk kembali ke sana; tombol tambah menyimpan tampilan saat ini.

## Membuka dan mengelola data

### Format yang dapat dibuka

AuroraMaps menerima berkas `.geojson`, `.json`, `.kml`, `.kmz`, `.gpx`, dan berkas proyek `.auroramaps` atau `.senjamaps`. Pilih **File** atau **File +** pada panel berkas, atau seret berkas ke area peta. Aplikasi menambahkan data sebagai layer dan biasanya mengarahkan tampilan ke data tersebut.

Untuk mengambil GeoJSON dari web, gunakan **URL** dan masukkan alamat yang dapat diakses publik. CSV adalah format ekspor, bukan format impor aplikasi.

### Mengelola layer dan fitur

- Klik layer untuk memilihnya; ikon mata menyalakan atau menyembunyikan layer.
- Buka panah layer untuk melihat fitur di dalamnya. Tombol tambah pada layer dapat membuat titik, garis, atau poligon baru di layer tersebut.
- Klik kanan layer untuk memperbesar ke layer, mengganti nama, mengubah urutan, mengekspor, menggabungkan layer lain ke layer tujuan, atau menghapusnya.
- Klik kanan fitur untuk memilih/memperbesar, mengedit properti, mengekspor fitur itu saja, atau menghapusnya.
- Penghapusan meminta konfirmasi dan tidak dapat dibatalkan setelah perubahan disimpan.

## Menggambar dan mengedit fitur

### Menggambar

1. Pilih alat titik, garis, poligon, persegi, atau lingkaran.
2. Pada komputer, klik lokasi untuk titik. Untuk garis/poligon, klik setiap simpul lalu klik dua kali untuk mengakhiri. Untuk persegi/lingkaran, tarik dari titik awal ke ukuran yang diinginkan.
3. Pada ponsel, alat poligon memakai bidik di tengah layar: tekan `+` untuk memulai, geser peta agar bidik berada pada simpul berikutnya, lalu tekan `+` lagi. Tekan `+` dua kali untuk menyelesaikan poligon; poligon memerlukan sedikitnya tiga simpul.
4. Tekan `Esc` untuk membatalkan gambar yang sedang berlangsung. Saat menggambar, Undo/Redo dapat menghapus atau mengembalikan simpul terakhir.

Shortcut umum Undo/Redo adalah `Ctrl+Z`/`Ctrl+Y` (Windows) atau `Cmd+Z`/`Cmd+Y` (Mac). Shortcut tidak dijalankan ketika fokus sedang berada di kolom teks.

### Mengedit properti

Pilih fitur pada peta atau dari daftar fitur. Buka tab **Edit** untuk mengubah nama, deskripsi, SHM, NIB, luas, keterangan, dan kolom tambahan yang tersedia. Simpan perubahan dengan tombol simpan pada panel. Anda juga dapat membatalkan atau menghapus fitur dari panel tersebut.

Editor saat ini mengubah atribut/properti fitur; pemindahan simpul geometri yang sudah ada tidak disediakan melalui panel Edit.

## Mengatur tampilan layer

Pilih layer, lalu buka tab **Style**. Atur warna isi dan garis, opasitas, ketebalan, serta pola garis. Pilih label berdasarkan nama, SHM, luas, deskripsi, NIB, keterangan, atau matikan label. Opsi panjang sisi menampilkan ukuran sisi dalam meter. Tekan **Terapkan ke Layer Terpilih** untuk menyimpan gaya.

Tab lain menyediakan informasi geometri (**Geom**), ringkasan statistik (**Stats**), dan metadata (**Meta**) dari fitur/layer yang dipilih.

## Menyimpan proyek

Tekan **Simpan** pada toolbar untuk mengunduh snapshot proyek `.auroramaps`. Snapshot ini menyimpan layer beserta geometri, properti, gaya, visibilitas, bookmark, nama proyek, tampilan peta, dan konfigurasi overlay gambar.

**Simpan proyek secara berkala, terutama setelah mengubah data.** Autosave browser menyimpan pengaturan seperti nama proyek, tema, bookmark, pusat/zoom peta, dan peta dasar; autosave bukan cadangan layer dan fitur. Jika browser ditutup atau data situs dibersihkan sebelum proyek diunduh, perubahan fitur dapat hilang.

Saat membuka proyek, data layer yang sedang aktif akan diganti setelah konfirmasi. Ekspor proyek sebelum memuat proyek lain jika ingin menyimpan keadaan saat ini.

## Impor dan ekspor

### Ekspor data

Tekan **Export** untuk membuka ekspor. Pilih cakupan **Semua**, **Per layer**, atau **Per fitur**, kemudian pilih format GeoJSON/JSON, KML, KMZ, Excel (XLSX), atau **KML Poligon (bersih)**. Hasil beberapa format dapat dikemas sebagai ZIP. Cakupan Semua menggabungkan data terpilih per format; Per layer memisahkan hasil per layer; Per fitur menghasilkan berkas tiap fitur.

Ekspor melalui menu klik kanan layer juga mendukung GeoJSON, KML, KMZ, dan CSV. Menu klik kanan fitur dapat mengekspor fitur tunggal. Tombol Excel pada tabel atribut mengunduh seluruh tabel atribut.

Ada dua cara menggabungkan data: **Gabung** dari ekspor membuat keluaran gabungan dan mempertahankan layer asal; **Gabung layer** dari menu layer memasukkan layer sumber ke layer tujuan dan menghapus layer sumber setelah konfirmasi.

### Tabel atribut

Buka panel bawah **Tabel Atribut** untuk mencari/filter baris dan mengurutkan berdasarkan kolom (klik judul kolom). Pilih baris untuk memilih fiturnya pada peta. Beberapa kolom dapat diedit langsung di tabel. Gunakan tombol Excel untuk mengunduh tabel.

## Mencetak peta

1. Atur peta ke area, zoom, layer, dan label yang ingin dicetak.
2. Tekan **Print/Cetak**, pilih ukuran lebar yang tersedia (A3, A2, A1, A0 atau ukuran lebar dalam meter), DPI 30/50/75/100, dan format PNG/JPG atau SVG vektor.
3. Atur judul/bilah judul jika diperlukan, lalu buat hasil cetak dan periksa berkasnya.

PNG/JPG merender peta yang terlihat, termasuk peta dasar dan overlay. **SVG vektor berisi overlay geometri dengan latar putih; tile peta dasar tidak disertakan.** SVG dapat diperbesar tanpa pecah dan tidak memakai pilihan DPI. Untuk cetak raster sangat besar, batas memori browser dapat membatasi hasil; pilih SVG jika sesuai dengan kebutuhan peta.

Jika muncul notifikasi **“Modul gambar cetak belum termuat”**, muat ulang aplikasi dengan `Ctrl+Shift+R` saat online agar skrip terbaru terunduh, kemudian coba lagi. Jika raster masih gagal, gunakan SVG vektor atau ukuran/DPI raster yang lebih kecil.

## Gambar referensi dan overlay

Tekan **Overlay** untuk menambahkan gambar referensi JPEG/PNG. Sesuaikan opasitas dan visibilitas. Gunakan pegangan pada gambar untuk memindahkan atau mengubah ukurannya, kemudian kunci posisinya ke koordinat peta bila sudah tepat. Konfigurasi overlay ikut tersimpan di proyek.

## ATR/BPN

- Tombol **Cari Bidang** menyediakan pencarian berdasarkan sertifikat analog, NIB, atau sertifikat elektronik/NIBEL. Isi kolom wilayah/nomor yang diminta pada tab terkait.
- Tombol **ATRBPN** membuka pilihan layer/zona dan pengaturan opasitas overlay.
- Ketersediaan hasil tergantung koneksi dan layanan/server sumber. Layer yang tidak tersedia dapat ditandai di panel. Overlay ATR/BPN tidak ditampilkan pada mode globe 3D.

Periksa sumber dan tanggal data sebelum menggunakan overlay untuk keputusan lapangan atau administrasi.

## GPS dan pengukuran

- Tombol lokasi meminta izin browser, memusatkan peta pada posisi, dan dapat mengikuti pergerakan. Tekan lagi untuk berhenti mengikuti.
- Tombol rekam GPS mulai merekam lintasan setelah izin lokasi diberikan. Tekan berhenti untuk membuat fitur lintasan. Sedikitnya dua titik diperlukan; jika lintasan kembali dekat ke titik awal (sekitar 10 m) dan memiliki setidaknya tiga titik, hasilnya dapat ditutup sebagai poligon.
- Pengaturan **Sembunyikan peta dasar saat rekam GPS** dapat membantu saat merekam lintasan.
- Klik kanan peta dan pilih pengukuran untuk menambahkan titik; klik dua kali mengakhiri dan menampilkan jarak.

Pastikan izin lokasi aktif dan perangkat memiliki sinyal GPS yang memadai. Hasil GPS disimpan sebagai data proyek ketika Anda menyimpan proyek.

## Peta 3D dan peta dasar

Gunakan pemilih peta dasar untuk **Street**, **Satellite**, **Topographic**, atau **Dark map**. Peta dasar berasal dari layanan daring; tampilan mungkin membutuhkan koneksi dan dapat berubah mengikuti layanan penyedia.

Tekan **3D** untuk membuka tampilan globe Cesium dan melihat layer aplikasi. Gunakan kompas untuk mengembalikan arah utara. Overlay ATR/BPN tidak tersedia dalam tampilan ini.

## Mode offline dan pengaturan

Buka **Pengaturan → Lapangan → Unduh area peta offline** untuk menyimpan tile bagi area tampilan dan peta dasar yang dipilih. Aplikasi menyediakan tingkat zoom 14–17 dan membatasi unduhan hingga 2.500 tile. Pilih area sekecil yang diperlukan agar unduhan tidak berlebihan. Pengunduhan perlu konteks aman (umumnya HTTPS) dan koneksi internet.

Pengaturan juga mencakup tema, bahasa Indonesia/Inggris, autosave, estimasi penyimpanan, instalasi PWA, GPS, dan pengelolaan cache offline. Menghapus autosave atau tile offline menghapus data tersimpan terkait. Simpan proyek `.auroramaps` terpisah sebagai cadangan data.

Penyimpanan tile offline hanya membantu peta dasar yang telah diunduh. Pencarian tempat dan layanan ATR/BPN tetap memerlukan jaringan.

## Penggunaan di ponsel

- Buka situs aplikasi langsung di Chrome untuk pengalaman penuh. Di Android, pilih **Pasang AuroraMaps** atau menu Chrome → **Tambahkan ke layar utama/Install app** jika tersedia.
- Ketuk **Menu** untuk akses toolbar, impor, simpan, ekspor, overlay, dan ATR/BPN.
- Panel layer, atribut, serta edit dapat tampil sebagai panel/modal. Gunakan crosshair dan tombol `+` untuk menggambar poligon.
- Izinkan lokasi untuk GPS. Simpan proyek ke perangkat setelah perubahan data.

## Pemecahan masalah

| Gejala | Yang dapat dicoba |
|---|---|
| Peta dasar kosong atau lambat | Periksa internet, muat ulang halaman, lalu pilih peta dasar lain. Layanan tile pihak ketiga dapat mengalami gangguan atau pembatasan. |
| Pencarian tidak menemukan lokasi | Periksa ejaan/koneksi dan coba nama yang lebih umum atau koordinat. Pencarian nama tempat berfokus pada Indonesia. |
| GPS tidak berjalan | Buka melalui HTTPS/localhost, aktifkan izin lokasi untuk situs dan browser, lalu coba di area dengan penerimaan GPS baik. |
| Layer ATR/BPN kosong/tidak tersedia | Periksa koneksi dan status layanan sumber. Coba lagi nanti; data tersebut bukan bagian dari peta dasar. |
| Cetak raster gagal atau gambar tidak termuat | Lakukan hard reload (`Ctrl+Shift+R`) ketika online. Coba lagi dengan ukuran/DPI lebih kecil atau gunakan SVG vektor. |
| Data hilang setelah refresh | Muat kembali berkas proyek terakhir. Autosave browser tidak mencadangkan geometri layer; simpan melalui tombol **Simpan** sebelum menutup/refresh. |
| Peta offline tidak muncul | Pastikan area dan peta dasar yang benar sudah diunduh, browser mengizinkan penyimpanan situs, dan area berada dalam cakupan tile yang di-cache. |

### Kebiasaan kerja yang disarankan

1. Impor atau gambar data.
2. Periksa atribut dan gaya layer.
3. Simpan proyek `.auroramaps` setelah perubahan penting.
4. Ekspor data ke format pertukaran bila perlu dibuka di perangkat lunak GIS lain.
5. Periksa hasil cetak/ekspor sebelum dibagikan.

