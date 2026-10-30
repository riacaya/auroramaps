@echo off
title Pemasang Sidecar AuroraMaps
setlocal EnableExtensions
cd /d "%~dp0"
echo ============================================
echo   PEMASANG SIDECAR AURORAMAPS
echo ============================================
echo.

set "BASE=https://riacaya.github.io/auroramaps/sidecar"

rem -- Paket lokal lengkap (folder hasil ekstrak)? Jalankan pemasangnya. --
if exist "%~dp0Pasang-Sidecar.ps1" if exist "%~dp0node.exe" goto :paket

rem -- Mode unduh: ambil Pasang-Sidecar.exe (jendela GUI: judul, ikon,
rem    teks panduan, progress bar %, dialog penutup) dari situs. --
set "EXE=%TEMP%\Pasang-Sidecar.exe"
echo Mengunduh pemasang Pasang-Sidecar.exe (±26 MB, sekali saja)...
echo Persentase tampil di bawah -- jangan tutup jendela ini dulu.
echo.
where curl.exe >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '%BASE%/Pasang-Sidecar.exe' -OutFile '%EXE%'"
) else (
  curl.exe -L --fail --show-error --output "%EXE%" "%BASE%/Pasang-Sidecar.exe"
)
if errorlevel 1 goto :gagal
echo.
echo Unduhan selesai (100 persen). Menjalankan pemasang...
start "" "%EXE%"
exit /b 0

:paket
echo Menjalankan pemasang dari paket lokal...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Pasang-Sidecar.ps1"
if errorlevel 1 (
    echo.
    echo [GAGAL] Pemasangan tidak selesai. Baca pesan di atas.
    echo.
    pause
    exit /b 1
)
echo.
echo PEMASANGAN SELESAI. Buka aplikasi lewat pintasan "AuroraMaps".
echo.
pause
exit /b 0

:gagal
echo.
echo [GAGAL] Pemasang tidak bisa diunduh. Periksa koneksi internet lalu coba lagi.
echo.
pause
exit /b 1
