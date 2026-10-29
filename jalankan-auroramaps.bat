@echo off
setlocal enabledelayedexpansion
REM ====================================================================
REM  AURORAMAPS (folder kerja asli) - SATU KLIK, tanpa pertanyaan
REM
REM   1) Cek Node.js
REM   2) SIDECAR  relai BHUMI di port 8322 (tile bidang, cari SHM, klik bidang)
REM   3) SERVER   server aplikasi di port 8321
REM   4) BUKA     jendela aplikasi Chrome/Edge tanpa bilah
REM
REM  Pemakaian:
REM    jalankan-auroramaps.bat          nyalakan semuanya, buka aplikasi
REM    jalankan-auroramaps.bat login    sama + jendela login BHUMI
REM    jalankan-auroramaps.bat --show   (sama dengan "login")
REM
REM  Yang sudah berjalan TIDAK dimatikan - aman diklik berulang kali.
REM  Berhenti: tutup jendela "AuroraMaps Server" dan "BHUMI Sidecar".
REM
REM  Catatan: folder ini selalu memakai kode TERBARU (hasil edit langsung).
REM  Pemasang Windows + pintasan ada di folder windows-app.
REM ====================================================================
cd /d "%~dp0"
for %%I in ("%~dp0.") do set "APP=%%~fI"
set "MAU_LOGIN="
set "NODEMAJ=0"
set "URL=http://127.0.0.1:8321/"

:ulang-arg
if /i "%~1"=="login"  set "MAU_LOGIN=1"
if /i "%~1"=="--show" set "MAU_LOGIN=1"
shift
if not "%~1"=="" goto :ulang-arg

echo.
echo ============================================================
echo    AURORAMAPS  (folder kerja)
echo ============================================================

REM --- 1) Node.js ------------------------------------------------------------
where node >nul 2>nul
if not errorlevel 1 goto :node-ok
echo.
echo    Node.js belum terpasang di PC ini.
echo    Pasang dulu dari https://nodejs.org ^(versi LTS^),
echo    lalu jalankan kembali berkas ini.
echo.
pause
exit /b 1
:node-ok
for /f "tokens=1 delims=." %%a in ('node -p "process.versions.node"') do set "NODEMAJ=%%a"

REM --- 2) Sidecar BHUMI ------------------------------------------------------
echo    [1/3] Sidecar BHUMI ^(port 8322^)
set "SIDECAR_ARGS="
set "SIDECAR_JALAN="
netstat -ano | findstr /c:":8322 " | findstr /c:"LISTENING" >nul
if not errorlevel 1 set "SIDECAR_JALAN=1"
if not defined SIDECAR_JALAN goto :sidecar-mulai
if not defined MAU_LOGIN goto :sidecar-sudah
echo         Memuat ulang dengan jendela login ^(sidecar lama dihentikan^)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /c:":8322 " ^| findstr /c:"LISTENING"') do taskkill /f /t /pid %%p >nul 2>&1
ping -n 4 127.0.0.1 >nul
set "SIDECAR_JALAN="

:sidecar-mulai
if defined SIDECAR_JALAN goto :sidecar-sudah
if not defined MAU_LOGIN goto :sidecar-tenang
set "SIDECAR_ARGS=--show"
:sidecar-tenang
if !NODEMAJ! geq 22 goto :sidecar-node-ok
echo         Dilewati: butuh Node.js 22 atau lebih baru ^(terpasang: !NODEMAJ!^).
goto :sidecar-selesai
:sidecar-node-ok
set "ADA_BROWSER="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "ADA_BROWSER=1"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "ADA_BROWSER=1"
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "ADA_BROWSER=1"
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "ADA_BROWSER=1"
if defined ADA_BROWSER goto :sidecar-browser-ok
echo         Dilewati: Chrome / Edge tidak ditemukan.
goto :sidecar-selesai
:sidecar-browser-ok
echo         Menyalakan ^(jendela "BHUMI Sidecar"^)...
start "BHUMI Sidecar" cmd /k node "%APP%\windows-app\tools\bhumi-bridge\sidecar-host.mjs" %SIDECAR_ARGS%
set /a nunggu=0
:tunggu-sidecar
ping -n 2 127.0.0.1 >nul
set /a nunggu+=1
netstat -ano | findstr /c:":8322 " | findstr /c:"LISTENING" >nul
if not errorlevel 1 goto :sidecar-siap
if %nunggu% lss 25 goto :tunggu-sidecar
echo         Peringatan: sidecar belum siap dalam 25 detik - dilanjutkan.
goto :sidecar-selesai
:sidecar-sudah
echo         Sudah berjalan.
goto :sidecar-selesai
:sidecar-siap
echo         Siap.
:sidecar-selesai

REM --- cek sesi BHUMI -------------------------------------------------------
netstat -ano | findstr /c:":8322 " | findstr /c:"LISTENING" >nul
if errorlevel 1 goto :sesi-lewati
set "SESIAKTIF=?"
node -e "fetch('http://127.0.0.1:8322/status').then(function(r){return r.json()}).then(function(j){console.log(j.loggedIn?'YA':'TIDAK')}).catch(function(){console.log('?')})" >"%TEMP%\auroramaps-sesi.txt" 2>nul
if exist "%TEMP%\auroramaps-sesi.txt" set /p SESIAKTIF=<"%TEMP%\auroramaps-sesi.txt"
if "%SESIAKTIF%"=="YA" goto :sesi-aktif
echo         Sesi BHUMI: %SESIAKTIF% - tile bidang / cari SHM / klik bidang
echo         baru berfungsi setelah login sekali:
echo.
echo             jalankan-auroramaps.bat login
echo.
goto :sesi-lewati
:sesi-aktif
echo         Sesi BHUMI: aktif.
:sesi-lewati

REM --- 3) Server aplikasi ----------------------------------------------------
echo    [2/3] Server aplikasi ^(port 8321^)
netstat -ano | findstr /c:":8321 " | findstr /c:"LISTENING" >nul
if not errorlevel 1 goto :server-sudah
if not exist "%APP%\local-server.mjs" goto :server-tidak-ada
echo         Menyalakan ^(jendela "AuroraMaps Server"^)...
start "AuroraMaps Server" /min cmd /k node "%APP%\local-server.mjs"
set /a nunggu=0
:tunggu-server
ping -n 2 127.0.0.1 >nul
set /a nunggu+=1
netstat -ano | findstr /c:":8321 " | findstr /c:"LISTENING" >nul
if not errorlevel 1 goto :server-siap
if %nunggu% lss 30 goto :tunggu-server
echo.
echo    GAGAL: server tidak bersedia dalam 30 detik.
echo    Buka jendela "AuroraMaps Server" untuk melihat pesan galatnya.
echo.
pause
exit /b 1
:server-sudah
echo         Sudah berjalan.
goto :server-selesai
:server-tidak-ada
echo.
echo    GAGAL: local-server.mjs tidak ada di folder ini:
echo         %APP%
echo.
pause
exit /b 1
:server-siap
echo         Siap.
:server-selesai

REM --- 4) Buka jendela aplikasi ---------------------------------------------
echo    [3/3] Membuka jendela aplikasi...
set "BROWSER="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if defined BROWSER goto :buka-aplikasi
start "" "%URL%"
goto :buka-selesai
:buka-aplikasi
start "" "%BROWSER%" --app=%URL% --no-first-run --no-default-browser-check
:buka-selesai

echo    Selesai - aplikasi terbuka di %URL%
echo    Berhenti: tutup jendela "AuroraMaps Server" dan "BHUMI Sidecar".
exit /b 0