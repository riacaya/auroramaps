@echo off
rem =====================================================
rem AURORAMAPS BHUMI SIDECAR - launcher
rem Relai BHUMI untuk MODE LOKAL PC — jalur ekstensi sudah dihapus.
rem Menjalankan browser pendamping - Edge bawaan Windows, cadangan Chrome
rem (buka https://bhumi.atrbpn.go.id/peta,
rem sisipkan sidecar-inject.js) + server HTTP 127.0.0.1:8322.
rem MODE DEFAULT: headless (tanpa jendela, jalan di latar belakang).
rem Login BHUMI: jalankan sekali dengan argumen --show untuk membuka jendela
rem dan login di sana; sesi tersimpan di profil, setelah itu cukup headless.
rem =====================================================
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [SIDEcar] Node.js tidak ditemukan. Pasang dari https://nodejs.org lalu jalankan ulang.
  pause
  exit /b 1
)
echo [Sidecar] Menjalankan sidecar-host.mjs ...
node "%~dp0sidecar-host.mjs" %*
echo.
echo [Sidecar] Berhenti. Tekan sembarang tombol untuk menutup.
pause >nul