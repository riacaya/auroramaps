# AuroraMaps BHUMI Bridge (sidecar lokal)

Bridge meminta **halaman pendamping** `https://bhumi.atrbpn.go.id/peta`
melakukan identifikasi koordinat, pencarian bidang, dan pengambilan tile, lalu
mengembalikan hasilnya ke AuroraMaps lokal. Kredensial, cookie, token
reCAPTCHA, auth-ticket, dan header autentikasi tidak diteruskan ke AuroraMaps.

> Jalur ekstensi Chrome/Edge (`manifest.json`, `background.js`, `bhumi-main.js`
> dsb.) **dihapus 26 Okt 2026** — sidecar menutupi semua kebutuhannya. Bila
> ada sisa dokumen/tulisan lama yang menyebut "pasang ekstensi", abaikan;
> cukup jalankan sidecar.

## Menjalankan

1. Jalankan `tools\bhumi-bridge\jalankan-sidecar.bat` (atau
   `node tools/bhumi-bridge/sidecar-host.mjs`) — lewat
   `jalankan-auroramaps.bat` semuanya menyala otomatis.
2. Browser pendamping (utama: **Edge bawaan Windows**, cadangan Chrome; profil
   khusus `.chrome-bhumi-profile`) membuka `https://bhumi.atrbpn.go.id/peta`
   **mode headless — tanpa jendela, sepenuhnya di latar belakang**.
3. Host menyisipkan `sidecar-inject.js` ke dalam konteks halaman lewat CDP
   (`Page.addScriptToEvaluateOnNewDocument`), lalu menyajikan API loopback di
   `http://127.0.0.1:8322`:
   `GET /status`, `POST /search`, `POST /identify`, `POST /tile`,
   `POST /token-sync`.
4. AuroraMaps (mode Lokal) memakai sidecar itu sebagai jalur prioritas
   (`src/js/bhumiSidecar.js`); bila tidak ada, tile/klik/cari jatuh ke jalur
   proxy lama tanpa perubahan perilaku.

Opsi: `--port <n>`, `--attach <url-cdp>` (pakai Chrome yang sudah berjalan
dengan `--remote-debugging-port`), `--show` / `--jendela` (buka jendela
pendamping untuk login manual).

## Sesi & token (penting)

Semua request data dijalankan **di dalam halaman BHUMI** lewat
`Runtime.evaluate` (Origin/Referer asli → lolos WAF); CORS server dibatasi
origin `localhost`/`127.0.0.1` saja, dan whitelist tile/endpoint sama persis
dengan ekstensi lama.

Token loginApi situs BHUMI **hanya berumur ±15 menit** (terukur 26 Okt 2026),
sehingga `sidecar-inject.js` (v5) menjaga sesi otomatis:

- **Cek kesegaran setiap panggilan** (identify/search/tile): token basi →
  sinkron dulu (loginApi + reCAPTCHA) sebelum request berjalan.
- **Ditolak 401/403 → sinkron paksa lalu ulangi sekali**, dengan antrean
  bersama supaya puluhan tile tidak memicu loginApi serentak.
- **Auto-klik "Saya Setuju"**: disclaimer situs hanya muncul saat sesi mati
  dan tombolnya menjalankan alur login asli situs (`loginApi → 200`); pengamat
  DOM mengecek tiap 2 detik dan mengkliknya otomatis — jendela pendamping
  headless tidak perlu disentuh.

Kalau semua jalur otomatis mentok (mis. WAF menutup `/expapi` sama sekali),
buka jendela pendamping (`jalankan-auroramaps.bat login`) dan klik
"Saya Setuju" sekali di sana.

## Pencarian bidang

Sejak WAF ATR/BPN menutup akses langsung /expapi (403/404 "Forbidden" untuk
klien tanpa sesi login), pencarian SHM/NIB/NIBEL dilewatkan lewat sidecar:
POST `/expapi/getBidang` atau `/expapi/getBidang2` dijalankan sebagai fetch
dari dalam halaman BHUMI (memakai sesi login halaman itu), lalu hasil fitur
dikembalikan ke AuroraMaps. Endpoint dibatasi ketat hanya dua rute itu dan
ukuran body maksimal 8 KB; halaman pendamping tidak dinavigasi ulang untuk
pencarian.

`sidecar-inject.js` juga mendekripsi sendiri envelope getPersil yang
terenkripsi statis (`{encrypted,data}` tanpa ecdh) — respons seperti ini
dulu dibuang sehingga klik bidang menggantung sampai timeout.

## Relai tile Bidang Tanah

WAF ATR/BPN menolak permintaan cross-site dan non-browser ke ruang /mprx &
/expapi, sehingga layer tile "Bidang Tanah" tidak dapat dimuat langsung
(relay lokal dibalas 403, `<img>` dari origin app pun ditolak). Yang masih
dilayani hanya permintaan dari DALAM halaman bhumi.atrbpn.go.id — jadi
sidecar mengambil tile di dalam halaman pendamping, lalu mengembalikannya
sebagai object URL ke AuroraMaps. Whitelist ketat: tiga endpoint BIDANG_SOURCES
(/mprx/service, /expapi/bhumigeos/umum/wms, /expapi/bhumigs/umum/wms) ditambah
/expapi/umum/wms (gambar bidang transparan hasil klik identify — URL aslinya
direkam dari halaman BHUMI: layer=Persil&filter=<persilpasifid terenkripsi>),
balasan wajib gambar, maksimal 2 MB per tile, timeout 25 detik. Tanpa sidecar,
AuroraMaps memakai jalur proxy lama tanpa perubahan perilaku.

## Relai tile RTRW Provinsi, LSD & Kawasan Hutan

Selain persil, layer LSD, Kawasan Hutan, dan RTRW Provinsi juga dilewatkan
lewat halaman pendamping bila situs berjalan di hosting. LSD & Kawasan Hutan
memakai WMS bhumi yang sama (whitelist sudah mencakupnya); RTRW Provinsi
memakai WMS gistaru-app — server gistaru hanya menerima Referer
https://bhumi.atrbpn.go.id/ (403 "Akses ditolak" tanpa itu) dan host cloud
tidak terjangkau (522), jadi URL asli gistaru diambil dari dalam halaman
BHUMI dengan `credentials:'omit'` (ACAO `*` tanpa Allow-Credentials). Di PC
lokal RTRW Provinsi tetap memakai rute `/gistaru` local-server.mjs (tanpa
relai).

## Login BHUMI

Login cukup SEKALI di jendela pendamping (`jalankan-sidecar.bat --show` atau
`jalankan-auroramaps.bat login`); sesi tersimpan di profil
`.chrome-bhumi-profile`. Setelah itu seluruh refresh sesi berjalan otomatis di
latar belakang (lihat bagian "Sesi & token" di atas). Uji bridge tidak
memintas login, CAPTCHA, atau pemeriksaan akses BHUMI.