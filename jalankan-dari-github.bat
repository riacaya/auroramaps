@echo off
setlocal enabledelayedexpansion
REM ============================================================
REM AuroraMaps - perbarui dari GitHub, lalu jalankan di PC ini
REM
REM   Berkas aplikasi & peralatan (server lokal, sidecar) diambil dari
REM   https://github.com/riacaya/auroramaps (branch main), lalu dijalankan
REM   SEPENUHNYA di PC ini:
REM     - server lokal  -> http://127.0.0.1:8321
REM     - sidecar BHUMI -> browser pendamping Edge/Chrome (headless)
REM
REM   Pemakaian:
REM     jalankan-dari-github.bat                 perbarui + jalankan (ditanya sidecar)
REM     jalankan-dari-github.bat sidecar         perbarui + jalankan + sidecar
REM     jalankan-dari-github.bat --hanya-update  perbarui saja, tidak dijalankan
REM     jalankan-dari-github.bat --tanpa-update  jalankan tanpa menarik update
REM
REM   Syarat: Node.js (https://nodejs.org, versi LTS) + internet saat update.
REM   Bila folder ini adalah clone git  -> git pull --ff-only.
REM   Bila bukan (hasil ekstrak zip)    -> unduh ulang arsip dari GitHub.
REM ============================================================
cd /d "%~dp0"
set "REPO=https://github.com/riacaya/auroramaps.git"
set "ZIP=https://github.com/riacaya/auroramaps/archive/refs/heads/main.zip"

if /i "%~1"=="--hanya-update" goto :hanya_update
if /i "%~1"=="--tanpa-update" goto :jalankan

REM --- 1) Sinkron dari GitHub ------------------------------------------------
call :update

REM --- 2) Jalankan ----------------------------------------------------------
goto :jalankan

:hanya_update
call :update
echo.
echo   Selesai - berkas sudah setara dengan GitHub.
echo.
pause
exit /b 0

:jalankan
if not exist "local-server.mjs" (
  echo.
  echo   Berkas local-server.mjs tidak ada - unduhan dari GitHub kemungkinan
  echo   gagal. Periksa koneksi internet lalu jalankan kembali berkas ini.
  echo.
  pause
  exit /b 1
)
echo.
echo   Menjalankan aplikasi...
if /i "%~1"=="--tanpa-update" (
  call "%~dp0jalankan-auroramaps.bat" %2 %3 %4
) else (
  call "%~dp0jalankan-auroramaps.bat" %1 %2 %3 %4
)
exit /b 0

REM ============================================================
REM :update - tarik berkas terbaru dari GitHub
REM ============================================================
:update
echo.
echo   [1/2] Menyinkronkan berkas dari GitHub...
if exist ".git" goto :update_git
goto :update_zip

:update_git
where git >nul 2>nul
if errorlevel 1 (
  echo     Git tidak ditemukan di PC ini - memakai berkas yang sudah ada.
  echo     Pasang Git dari https://git-scm.com/download/win bila ingin update otomatis.
  goto :eof
)
git pull --ff-only
if errorlevel 1 (
  echo     Peringatan: git pull gagal ^(!errorlevel!^) - memakai berkas yang sudah ada.
) else (
  echo     Selesai: cabang main diperbarui.
)
goto :eof

:update_zip
echo     Bukan folder clone git - mengunduh arsip main.zip ^(butuh internet^)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $zip=Join-Path $env:TEMP 'auroramaps-main.zip'; $tmp=Join-Path $env:TEMP ('auroramaps-' + [guid]::NewGuid().ToString('N')); Invoke-WebRequest -Uri '%ZIP%' -OutFile $zip -UseBasicParsing; Expand-Archive -Path $zip -DestinationPath $tmp -Force; $src=(Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName; Copy-Item -Path (Join-Path $src '*') -Destination '.' -Recurse -Force; Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item $zip -Force -ErrorAction SilentlyContinue; Write-Host '      Berkas diperbarui dari GitHub.'"
if errorlevel 1 (
  echo     Gagal mengunduh - memakai berkas yang sudah ada ^(periksa internet^).
)
goto :eof