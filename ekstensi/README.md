# AuroraMaps BHUMI Bridge — ekstensi Chrome/Edge (MV3)

Ekstensi ini membuat **halaman AuroraMaps di GitHub Pages (dan Blogger)
berfungsi penuh di komputer mana pun — tanpa memasang aplikasi PC**.
Cek bidang (NIB/luas), zona RTRW Pro/Kab, tab Analisa, pencarian, dan tile
semuanya jalan; halaman cukup memanggil sisi "sidecar" yang disediakan
ekstensi ini.

## Cara kerja (ringkas)

```
Halaman AuroraMaps (github.io / blog)
  window.AuroraBhumiSidecarClient  ← di-patch oleh page-shim.js (MAIN world)
        │ window.postMessage
  app-bridge.js (isolated) → chrome.runtime
        │
  background.js  — menjaga 1 jendela BHUMI, router, alarm tiap menit
        │ chrome.tabs.sendMessage
  bhumi-page.js (isolated di halaman BHUMI) → window.postMessage
        │
  sidecar-inject.js + bhumi-main-adapter.js (MAIN world halaman BHUMI)
        │ fetch dengan Origin halaman BHUMI
  server BHUMI ✓ (lolos WAF — sama persis dengan sidecar PC)
```

- **Satu-satunya yang di-patch** adalah objek `AuroraBhumiSidecarClient` di
  halaman → kode sumber aplikasi (`src/`) TIDAK berubah, jadi app PC, APK,
  dan versi tanpa ekstensi tetap berjalan seperti sediakala.
- `sidecar-inject.js` disalin persis dari sisi PC (auth-ticket ECDH,
  dekripsi, whitelist tile, klik "Saya Setuju", refresh token, analisa).

## Pasang — SATU KLIK (sekali di tiap komputer)

Untuk pengguna awam, paket ini sudah menyertakan pemasang:

1. Buka `AuroraMaps-BHUMI-Bridge.zip`, keluarkan isinya ke folder mana pun.
2. **DOBEL-KLIK `Pasang-Ekstensi.bat`.** Selesai — tidak perlu
   `chrome://extensions`, tidak perlu Developer mode.

Yang dilakukan pemasang (sekali jalan):

- menyalin 7 berkas ekstensi ke `%LOCALAPPDATA%\AuroraMapsBHUMI\ekstensi`
  (paket tidak perlu disimpan di tempat tetap — aman dihapus dari folder asal);
- membuat pintasan **AuroraMaps** di Desktop (ikon logo AuroraMaps) yang
  membuka Edge/Chrome dengan **profil khusus AuroraMaps** + ekstensi termuat
  otomatis, langsung ke halaman aplikasi;
- membuka aplikasinya segera untuk memastikan jalan.

Setelah itu **pemakaian sehari-hari = satu klik pintasan "AuroraMaps" di
Desktop.** Pertama kali: login BHUMI sekali di jendela yang muncul, lalu
jendela itu minimize sendiri — setelahnya semua fitur (Bidang, RTRW,
Analisa, pencarian, tile) berfungsi penuh.

### Cara alternatif (manual, untuk pengembang)

1. Buka `chrome://extensions` (Edge: `edge://extensions`).
2. Aktifkan **Developer mode** (sakelar kanan atas).
3. Klik **Load unpacked** → pilih folder ini.
4. Buka `https://riacaya.github.io/auroramaps/`, login BHUMI sekali di
   jendela pendamping, jendela itu akan minimize sendiri.

## Tentang "tab tersembunyi"

Chrome MV3 **tidak memiliki API tab tersembunyi**, dan server BHUMI
memblokir iframe (`frame-ancestors 'self' https://*.atrbpn.go.id`,
`X-Frame-Options: SAMEORIGIN`) sehingga offscreen/iframe tidak mungkin.
Bentuk tersembunyi terbaik yang sah adalah **jendela terpisah yang
di-minimize** — halaman tetap berjalan penuh (token di-refresh otomatis tiap
±15 menit) tanpa mengganggu layar.

Jaga-jaga: Chrome "Memory Saver" bisa menidurkan tab minimize. Alarm tiap
menit di `background.js` mengecek dan **membuka/memuat ulang otomatis** bila
tab tidak menjawab.

## Menambah situs lain (mis. blog domain sendiri)

Tambahkan dua tempat di `manifest.json`:

- `host_permissions`: `"https://namadomain-anda.com/*"`
- `content_scripts` pada dua blok (masing-masing `page-shim.js`+`app-bridge.js`
  dan `bhumi-*`), sesuaikan `matches`.

Lalu muat ulang ekstensi (tombol 🔄 di chrome://extensions).

## Batasan jujur

- Login BHUMI tetap **sekali per komputer/per profil browser** (situs yang
  menentukan; ekstensi tidak bisa menyiasatinya).
- Ekstensi ini menjalankan sesi login BHUMI Anda di dalam tab yang dikelola
  browser Anda sendiri — tidak ada kredensial yang dikirim ke mana pun
  selain server BHUMI.
- Pemakaian sendiri: cukup Load unpacked. Mau disebarluaskan → perlu
  publikasi di Chrome Web Store (kebijakan melarang kode jarak jauh; semua
  berkas sudah lokal di folder ini).
- Butuh Chrome/Edge dengan dukungan MV3 `content_scripts.world` (Chrome 111+;
  versi Anda 155 ✓).

## Berkas

| Berkas | Dunia | Peran |
|---|---|---|
| `manifest.json` | — | Izin, pemasangan konten script |
| `background.js` | service worker | Jendela BHUMI (minimize), router, alarm keepalive |
| `sidecar-inject.js` | MAIN (bhumi) | Mesin API — sama dengan sisi PC |
| `bhumi-main-adapter.js` | MAIN (bhumi) | postMessage → `AuroraBhumiSidecar` |
| `bhumi-page.js` | isolated (bhumi) | chrome.runtime ↔ postMessage + ping |
| `page-shim.js` | MAIN (app) | Patch `_post`/`_probe` klien AuroraMaps |
| `app-bridge.js` | isolated (app) | postMessage ↔ chrome.runtime |
