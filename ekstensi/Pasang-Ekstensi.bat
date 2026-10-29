@echo off
title Pemasang Ekstensi AuroraMaps
setlocal EnableExtensions
cd /d "%~dp0"
echo ============================================
echo   PEMASANG EKSTENSI AURORAMAPS - BHUMI
echo ============================================
echo.

set "BASE=https://riacaya.github.io/auroramaps/ekstensi"
set "PS1PATH=%~dp0Pasang-Ekstensi.ps1"

rem -- Paket lokal lengkap (hasil ekstrak zip)? Pakai apa adanya, offline. --
if exist "%~dp0manifest.json" if exist "%PS1PATH%" goto :jalankan

rem -- Selain itu (file .bat didownload sendiri) = ambil komponen dari GitHub --
set "KERJA=%LOCALAPPDATA%\AuroraMapsBHUMI\unduhan"
if not exist "%KERJA%" mkdir "%KERJA%"
set "PS1PATH=%KERJA%\Pasang-Ekstensi.ps1"
echo Mengunduh komponen pemasang dari GitHub...
for %%F in (Pasang-Ekstensi.ps1 manifest.json background.js sidecar-inject.js bhumi-main-adapter.js bhumi-page.js page-shim.js app-bridge.js auroramaps.ico) do (
  call :unduh "%%F"
  if errorlevel 1 goto :gagal
)
echo.

:jalankan
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1PATH%" %*
if errorlevel 1 (
    echo.
    echo [GAGAL] Pemasangan tidak selesai. Baca pesan di atas.
    echo.
    pause
    exit /b 1
)
rem -- Mode unduh: buang folder staging --
rem Tinggal %LOCALAPPDATA%\AuroraMapsBHUMI\ekstensi (7 file yang dibuka
rem browser), persis seperti folder ekstensi/ di GitHub. Folder unduhan
rem hanya jembatan sementara, tidak perlu disimpan.
if defined KERJA rmdir /s /q "%KERJA%" >nul 2>&1
echo.
pause
exit /b 0

rem -- unduh NAMA berkas dari GitHub ke %KERJA% (curl bawaan Windows; fallback PowerShell)
:unduh
echo   - %~1
where curl.exe >nul 2>&1
if errorlevel 1 goto :unduhPS
curl.exe -L --fail --silent --show-error --output "%KERJA%\%~1" "%BASE%/%~1"
exit /b %errorlevel%
:unduhPS
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '%BASE%/%~1' -OutFile '%KERJA%\%~1'"
exit /b %errorlevel%

:gagal
echo.
echo [GAGAL] Berkas tidak bisa diunduh. Periksa koneksi internet lalu coba lagi.
echo.
pause
exit /b 1
