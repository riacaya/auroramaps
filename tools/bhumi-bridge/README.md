# AuroraMaps BHUMI Bridge (uji lokal)

Bridge ini meminta tab BHUMI yang sudah dibuka di Chrome/Edge melakukan identifikasi koordinat, lalu mengembalikan data fitur persil ke AuroraMaps lokal. Kredensial, cookie, token reCAPTCHA, auth-ticket, dan header autentikasi tidak diteruskan ke AuroraMaps.

## Mode Sidecar — tanpa ekstensi (baru, 25 Okt 2026)

Seluruh fungsi bridge kini juga tersedia sebagai **sidecar lokal** yang tidak
memerlukan ekstensi sama sekali — khusus untuk mode lokal PC:

1. Jalankan `tools\bhumi-bridge\jalankan-sidecar.bat` (atau
   `node tools/bhumi-bridge/sidecar-host.mjs`).
2. Browser pendamping (utama: **Edge bawaan Windows**, cadangan Chrome; profil
   khusus) membuka `https://bhumi.atrbpn.go.id/peta` **dalam mode headless —
   tanpa jendela, sepenuhnya di latar belakang**. Login BHUMI cukup sekali:
   jalankan `jalankan-sidecar.bat --show` untuk membuka jendela, login di sana
   (sesi tersimpan di profil `.chrome-bhumi-profile`), tutup, lalu jalankan
   normal kembali. Bila belum login, statusnya dilaporkan lewat log host.
3. Host menyisipkan `sidecar-inject.js` ke dalam konteks halaman lewat CDP
   (`Page.addScriptToEvaluateOnNewDocument`), lalu menyajikan API loopback
   di `http://127.0.0.1:8322`:
   `GET /status`, `POST /search`, `POST /identify`, `POST /tile`, `POST /token-sync`.
4. AuroraMaps (mode Lokal) membaca `window.__AURORAMAPS_SIDECAR__` dan
   memakai sidecar itu sebagai pengganti relai ekstensi; bila tidak ada,
   otomatis kembali ke relai ekstensi / jalur proxy lama.

Catatan: semua request data dijalankan **di dalam halaman BHUMI** lewat
`Runtime.evaluate` (Origin/Referer asli → lolos WAF); CORS server dibatasi
origin `localhost`/`127.0.0.1` saja, dan whitelist tile/endpoint sama persis
dengan ekstensi. Opsi: `--port <n>`, `--attach <url-cdp>` (pakai Chrome yang
sudah berjalan dengan `--remote-debugging-port`).

## Pencarian bidang (baru, 24 Okt 2026)

Sejak WAF ATR/BPN menutup akses langsung /expapi (403/404 "Forbidden" utk klien
tanpa sesi login), pencarian SHM/NIB/NIBEL di AuroraMaps juga dapat dilewatkan
lewat bridge: permintaan POST /expapi/getBidang atau /expapi/getBidang2
dijalankan sebagai fetch dari dalam halaman BHUMI (memakai sesi login tab itu,
termasuk token Authorization bila tersimpan di halaman), lalu hasil fitur
dikembalikan ke AuroraMaps. Endpoint dibatasi ketat hanya dua rute itu dan
ukuran body maksimal 8 KB; tab BHUMI tidak dinavigasi ulang untuk pencarian.

Selain itu bhumi-main.js kini mendekripsi sendiri envelope getPersil yang
terenkripsi statis ({encrypted,data} tanpa ecdh) — sebelumnya respons seperti
ini dibuang sehingga klik bidang menggantung sampai timeout 60 detik.

## Relai tile Bidang Tanah (baru, 24 Okt 2026)

WAF ATR/BPN menolak permintaan cross-site dan non-browser ke ruang /mprx &
/expapi, sehingga layer tile "Bidang Tanah" di AuroraMaps tidak dapat dimuat
langsung (relay lokal dibalas 403, <img> dari origin app pun ditolak). Ekstensi
kini meneruskan URL tile WMS persil ke tab BHUMI, mengambil gambarnya di dalam
halaman itu (same-site, sesi & cookie tab), lalu mengembalikannya sebagai
object URL ke AuroraMaps. Whitelist ketat: tiga endpoint BIDANG_SOURCES
(/mprx/service, /expapi/bhumigeos/umum/wms, /expapi/bhumigs/umum/wms) ditambah
/expapi/umum/wms (gambar bidang transparan hasil klik identify — URL aslinya
direkam dari halaman BHUMI: layer=Persil&filter=<persilpasifid terenkripsi>&BBOX),
balasan
wajib gambar, maksimal 2 MB per tile, timeout 25 detik. Tile tidak butuh login —
cukup tab BHUMI terbuka di browser yang sama. Tanpa ekstensi, AuroraMaps memakai
jalur proxy lama tanpa perubahan perilaku.

## Relai tile RTRW Provinsi, LSD & Kawasan Hutan (baru, 24 Okt 2026)
Selain persil, kini layer LSD, Kawasan Hutan, dan RTRW Provinsi juga dilewatkan
lewat tab BHUMI bila situs berjalan di hosting. LSD & Kawasan Hutan memakai
WMS bhumi yang sama (whitelist lama sudah mencakupnya); RTRW Provinsi memakai
WMS gistaru-app — server gistaru hanya menerima Referer https://bhumi.atrbpn.go.id/
(403 "Akses ditolak" tanpa itu; teruji 24 Okt 2026) dan host cloud tidak
terjangkau (522), jadi URL asli gistaru diambil dari dalam halaman BHUMI
dengan credentials:'omit' (ACAO '*' tanpa Allow-Credentials). Di PC lokal
RTRW Provinsi tetap memakai rute /gistaru local-server.mjs (tanpa relai).
Gerbang origin kini mengizinkan juga https://riacaya.github.io/ (situs
GitHub Pages AuroraMaps) selain localhost:8321.

## Sinkron token BHUMI saat app login (baru, 24 Okt 2026)

Berkas 8815 milik situs BHUMI menunjukkan token dikelola lewat POST
/expapi/loginApi {recaptchaToken} (reCAPTCHA render-only, action "login"),
hasilnya disimpan sebagai localStorage.tokens. Karena /expapi tertutup untuk
klien lintas-origin, ekstensi kini menyalin alur itu di dalam tab BHUMI:
saat AuroraMaps login (App.init) — atau saat pencarian kena HTTP 401 —
AuroraMaps mengirim pesan token-sync; bhumi-main memicu loginApi dari dalam
halaman (memuat grecaptcha bila perlu) lalu menulis token baru ke storage
tab itu. Token yang masih berlaku TIDAK disentuh (hemat kuota reCAPTCHA);
penyegaran paksa tersedia via AuroraBhumiAuth.ensure(true) di console.

## Memuat ekstensi

1. Buka `chrome://extensions` (Chrome) atau `edge://extensions` (Edge).
2. Aktifkan **Developer mode**.
3. Pilih **Load unpacked** dan pilih folder `D:\AuroraMaps\tools\bhumi-bridge`.
4. Buka AuroraMaps di `http://127.0.0.1:8321/` atau `https://riacaya.github.io/auroramaps/`, dan buka BHUMI di tab browser yang sama. Login BHUMI dan tunggu peta siap.
5. Di AuroraMaps, aktifkan panel ATR/BPN → Bidang Tanah, lalu klik lokasi persil.

Bridge memakai tab BHUMI yang sudah terbuka TANPA menavigasinya ulang: identifikasi
(getPersil) dan pencarian (getBidang) dijalankan sebagai fetch dari dalam halaman
BHUMI, sehingga peta yang sedang dilihat tidak terganggu. Tile cukup membuka tab
BHUMI (tanpa login); klik & cari bidang butuh sesi login BHUMI di tab itu, dan
balasannya (401 bila belum login) diteruskan apa adanya ke AuroraMaps. Tab browser
internal tidak mendukung ekstensi; gunakan Chrome/Edge PC.

Hasil identifikasi dibaca langsung dari respons getPersil (didekripsi di tab BHUMI,
termasuk envelope ber-ecdh); tanpa login, pesan galat 401 yang jelas dikirim balik. Uji ini tidak memintas login, CAPTCHA, atau pemeriksaan akses BHUMI.
