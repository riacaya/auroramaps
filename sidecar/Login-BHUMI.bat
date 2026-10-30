@echo off
rem =====================================================
rem Login BHUMI sekali (hanya bila status /status loggedIn:false)
rem Membuka jendela pendamping supaya Anda bisa klik "Saya Setuju".
rem Sesudah itu sesi tersimpan di profil dan tidak perlu login lagi.
rem =====================================================
cd /d "%~dp0"
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*sidecar-host*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
timeout /t 2 >nul
start "" node.exe sidecar-host.mjs --show
echo Jendela pendamping terbuka - klik "Saya Setuju" di sana.
echo Setelah statusnya jalan, tutup jendela pendamping; sidecar login hidden
echo akan dilanjutkan oleh pintasan AuroraMaps Sidecar saat login berikutnya.
pause
