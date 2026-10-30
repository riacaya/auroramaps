@echo off
title Pemasang Sidecar AuroraMaps
setlocal EnableExtensions
cd /d "%~dp0"
echo ============================================
echo   PEMASANG SIDECAR AURORAMAPS
echo ============================================
echo.

set "BASE=https://riacaya.github.io/auroramaps/sidecar"

rem -- Paket lokal lengkap (hasil ekstrak zip)? Jalankan apa adanya, offline. --
if exist "%~dp0Pasang-Sidecar.ps1" if exist "%~dp0node.exe" goto :jalankan

rem -- Selain itu (.bat didownload sendiri) = unduh paket zip dari GitHub --
set "KERJA=%USERPROFILE%\Downloads\AuroraMaps-Sidecar"
set "ZIP=%TEMP%\AuroraMaps-Sidecar.zip"
if not exist "%KERJA%" mkdir "%KERJA%"
echo Mengunduh paket sidecar (±33 MB, sekali saja) dari GitHub...
where curl.exe >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '%BASE%/AuroraMaps-Sidecar.zip' -OutFile '%ZIP%'"
) else (
  curl.exe -L --fail --silent --show-error --output "%ZIP%" "%BASE%/AuroraMaps-Sidecar.zip"
)
if errorlevel 1 goto :gagal
echo Mengekstrak ke:
echo   %KERJA%
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Force -Path '%ZIP%' -DestinationPath '%KERJA%'"
if errorlevel 1 goto :gagal
echo.
set "PS1PATH=%KERJA%\Pasang-Sidecar.ps1"
goto :jalankanPS

:jalankan
set "PS1PATH=%~dp0Pasang-Sidecar.ps1"

:jalankanPS
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1PATH%" %*
if errorlevel 1 (
    echo.
    echo [GAGAL] Pemasangan tidak selesai. Baca pesan di atas.
    echo.
    pause
    exit /b 1
)
echo.
echo Berkas paket tersimpan di: %PS1PATH%
echo (folder itu juga dipakai ulang bila pemasang dijalankan lagi)
echo.
pause
exit /b 0

:gagal
echo.
echo [GAGAL] Paket tidak bisa diunduh. Periksa koneksi internet lalu coba lagi.
echo.
pause
exit /b 1
