@echo off
setlocal enabledelayedexpansion
REM ============================================================
REM AuroraMaps - pemasangan ke Windows
REM   1. Salin berkas aplikasi ke folder pemasangan
REM      (default: %LOCALAPPDATA%\Programs\AuroraMaps - tanpa admin)
REM   2. Kompilasi AuroraMaps.exe (peluncur mode aplikasi:
REM      Chrome/Edge terbuka TANPA tab & bilah, seperti "Install app")
REM   3. Buat pintasan Start Menu & Desktop
REM   4. Tawarkan langsung menjalankan
REM
REM Pilihan:
REM   pasang-auroramaps.bat                    pasang ke folder pengguna
REM   pasang-auroramaps.bat --program-files    pasang ke %ProgramFiles%\AuroraMaps
REM                                             (harus dengan Run as administrator)
REM   pasang-auroramaps.bat --tanpa-jalankan   jangan langsung dijalankan
REM
REM Syarat: Node.js (https://nodejs.org). Compiler bawaan Windows
REM (csc.exe dari .NET Framework) otomatis dipakai - tanpa instal apa pun.
REM ============================================================
cd /d "%~dp0"

set "TUJUAN=%LOCALAPPDATA%\Programs\AuroraMaps"
if /i "%~1"=="--program-files" set "TUJUAN=%ProgramFiles%\AuroraMaps"
set "LANGSUNG=1"
if /i "%~1"=="--tanpa-jalankan" set "LANGSUNG="
if /i "%~2"=="--tanpa-jalankan" set "LANGSUNG="

echo.
echo   AuroraMaps - pemasangan ke Windows
echo   Tujuan: %TUJUAN%
echo.

REM --- 0) Syarat ------------------------------------------------------------
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo   GAGAL: compiler bawaan Windows ^(csc.exe^) tidak ditemukan.
  echo   Pasang .NET Framework 4.x dari https://dotnet.microsoft.com/download
  echo.
  pause
  exit /b 1
)
if not exist "local-server.mjs" (
  echo   GAGAL: jalankan berkas ini dari folder sumber/clone AuroraMaps
  echo   ^(di dalamnya ada local-server.mjs^).
  echo.
  pause
  exit /b 1
)

REM --- 1) Folder tujuan (uji bisa ditulis / dibuat) --------------------------
if not exist "%TUJUAN%" mkdir "%TUJUAN%" 2>nul
if not exist "%TUJUAN%" (
  echo   GAGAL: tidak bisa membuat folder tujuan.
  echo   Untuk %ProgramFiles% diperlukan "Run as administrator".
  echo.
  pause
  exit /b 1
)

REM --- 2) Salin berkas ------------------------------------------------------
REM   File tunggal: perintah copy bawaan cmd.
REM   Folder      : robocopy (punya /XD & /XF). xcopy di Windows ini TIDAK
Rem   memilikinya - hanya menolak dengan "Invalid switch - /X".
REM   robocopy: 0-7 = berhasil, >=8 = gagal.
echo   [1/3] Menyalin berkas aplikasi...
copy /Y "index.html"           "%TUJUAN%\" >nul || goto :salah
copy /Y "service-worker.js"    "%TUJUAN%\" >nul || goto :salah
copy /Y "manifest.webmanifest" "%TUJUAN%\" >nul || goto :salah
copy /Y "local-server.mjs"     "%TUJUAN%\" >nul || goto :salah
copy /Y "jalankan-auroramaps.bat"  "%TUJUAN%\" >nul
copy /Y "jalankan-dari-github.bat" "%TUJUAN%\" >nul

robocopy "src"    "%TUJUAN%\src"    /E /NFL /NDL /NJH /NJS /R:1 /W:1 >nul
if !errorlevel! GEQ 8 goto :salah
robocopy "assets" "%TUJUAN%\assets" /E /NFL /NDL /NJH /NJS /R:1 /W:1 >nul
if !errorlevel! GEQ 8 goto :salah
REM /XD = KECUALIKAN folder profil browser (sesi login BHUMI, 300 MB)
robocopy "windows-app\tools\bhumi-bridge" "%TUJUAN%\tools\bhumi-bridge" /E /XD .chrome-bhumi-profile /XF *.log /NFL /NDL /NJH /NJS /R:1 /W:1 >nul
if !errorlevel! GEQ 8 goto :salah
robocopy "windows-app\tools\installer" "%TUJUAN%\tools\installer" /E /XF *.exe *.log /NFL /NDL /NJH /NJS /R:1 /W:1 >nul
if !errorlevel! GEQ 8 goto :salah
echo         Selesai.

REM --- 3) Kompilasi AuroraMaps.exe -----------------------------------------
echo   [2/3] Mengompilasi AuroraMaps.exe...
"%CSC%" /nologo /target:winexe /out:"%TUJUAN%\AuroraMaps.exe" "%TUJUAN%\tools\installer\AuroraMaps.cs"
if errorlevel 1 (
  echo   GAGAL: kompilasi gagal. Lihat pesan galat di atas.
  echo.
  pause
  exit /b 1
)
echo         %TUJUAN%\AuroraMaps.exe

REM --- 4) Pintasan ----------------------------------------------------------
echo   [3/3] Membuat pintasan Start Menu dan Desktop...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$w=New-Object -ComObject WScript.Shell; $exe='%TUJUAN%\AuroraMaps.exe'; $targets=@((Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs\AuroraMaps.lnk'), (Join-Path ([Environment]::GetFolderPath('Desktop')) 'AuroraMaps.lnk')); foreach($p in $targets){ $s=$w.CreateShortcut($p); $s.TargetPath=$exe; $s.WorkingDirectory='%TUJUAN%'; $s.WindowStyle=7; $s.Description='AuroraMaps - GIS Viewer'; $s.Save() }"
if errorlevel 1 (
  echo   Peringatan: pintasan gagal dibuat - aplikasi tetap bisa dibuka dari:
  echo   %TUJUAN%\AuroraMaps.exe
) else (
  echo         Pintasan dibuat.
)

echo.
echo   Pemasangan selesai.
echo     Aplikasi   : %TUJUAN%
echo     Cara buka  : klik pintasan "AuroraMaps" di Desktop / Start Menu
echo     Jendela    : Chrome mode aplikasi ^(tanpa tab dan bilah^)
echo     Berhenti   : tutup jendela "AuroraMaps Server" yang diperkecil
echo     Copot      : hapus folder di atas + pintasannya
echo.

if not defined LANGSUNG goto :selesai
choice /c YN /n /m "   Jalankan AuroraMaps sekarang? [Y/N] "
if errorlevel 2 goto :selesai
start "" "%TUJUAN%\AuroraMaps.exe"

:selesai
echo.
pause
exit /b 0

:salah
echo   GAGAL: penyalinan berkas tidak berhasil. Periksa folder sumber.
echo.
pause
exit /b 1