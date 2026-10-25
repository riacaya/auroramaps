@echo off
setlocal enabledelayedexpansion
REM ============================================================
REM AuroraMaps - jalankan aplikasi di PC ini (mode lokal PC)
REM
REM   Klik dua kali ........... jalankan server + buka browser
REM   Dari CMD, dengan sidecar: jalankan-auroramaps.bat sidecar
REM     (sidecar = relai BHUMI Node, pengganti ekstensi: tile,
REM      cari SHM, klik bidang lewat browser pendamping Edge/Chrome)
REM
REM Tidak butuh Cloudflare, tidak butuh npm install - semua
REM berkas sudah ada di folder ini dan servernya zero-dependency.
REM ============================================================
cd /d "%~dp0"

REM --- 1) Node.js wajib ada --------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js belum terpasang di PC ini.
  echo   Pasang dulu dari https://nodejs.org ^(versi LTS^),
  echo   lalu jalankan kembali berkas ini.
  echo.
  pause
  exit /b 1
)

REM --- 2) Server aplikasi di 127.0.0.1:8321 ---------------------------------
netstat -ano | findstr /c:":8321 " | findstr /c:"LISTENING" >nul
if not errorlevel 1 (
  echo   Server AuroraMaps sudah berjalan di port 8321.
) else (
  echo   Menyalakan server AuroraMaps -^> http://127.0.0.1:8321/
  start "AuroraMaps Server" /min cmd /k node "%~dp0local-server.mjs"
)

REM --- 3) Sidecar BHUMI (opsional) ------------------------------------------
set "MAU_SIDECAR="
if /i "%~1"=="sidecar" set "MAU_SIDECAR=1"
if not defined MAU_SIDECAR (
  choice /c YN /n /m "  Sekalian nyalakan sidecar BHUMI (klik/cari bidang tanpa ekstensi)? [Y/N] "
  if errorlevel 2 set "MAU_SIDECAR="
  if not errorlevel 2 set "MAU_SIDECAR=1"
)

if defined MAU_SIDECAR (
  set "NODEMAJ=0"
  for /f "tokens=1 delims=." %%a in ('node -p "process.versions.node"') do set "NODEMAJ=%%a"
  if !NODEMAJ! lss 22 (
    echo   Sidecar dilewati: butuh Node.js 22 atau lebih baru ^(terpasang: !NODEMAJ!^).
  ) else (
    set "ADA_BROWSER="
    if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "ADA_BROWSER=1"
    if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" set "ADA_BROWSER=1"
    where chrome >nul 2>nul && set "ADA_BROWSER=1"
    if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "ADA_BROWSER=1"
    if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "ADA_BROWSER=1"
    if not defined ADA_BROWSER (
      echo   Edge/Chrome tidak ditemukan - sidecar dilewati ^(tile tetap jalan via proxy^).
      set "MAU_SIDECAR="
    )
    if defined MAU_SIDECAR (
      echo   Menyalakan sidecar BHUMI - berjalan diam-diam tanpa jendela ^(headless^).
      echo   Belum pernah login? Jalankan sekali: tools\bhumi-bridge\jalankan-sidecar.bat --show
      start "BHUMI Sidecar" cmd /k node "%~dp0tools\bhumi-bridge\sidecar-host.mjs"
      timeout /t 6 /nobreak >nul
    )
  )
)

REM --- 4) Buka aplikasi ------------------------------------------------------
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8321/"
echo.
echo   AuroraMaps siap di http://127.0.0.1:8321/
echo   Menghentikan aplikasi: tutup jendela "AuroraMaps Server".
echo.
pause
endlocal