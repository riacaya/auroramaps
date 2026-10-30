# =====================================================
# Pasang-Sidecar.ps1 — pemasang sidecar AuroraMaps (sekali klik)
# Dipanggil oleh Pasang-Sidecar.bat, atau:
#   powershell -ExecutionPolicy Bypass -File Pasang-Sidecar.ps1
#
# Yang dilakukan:
#   1) Salin skrip sidecar + node.exe portabel ke %LOCALAPPDATA%\AuroraMapsSidecar
#   2) Hentikan sidecar lama (kalau ada) supaya port 8322 bebas
#   3) Jalankan sidecar BARU tersembunyi (tanpa jendela)
#   4) Verifikasi http://127.0.0.1:8322/status
#   5) Pintasan Desktop + menu Mulai untuk app AuroraMaps
#      (mode --app: jendela aplikasi TANPA bar/tab browser)
#   6) Pintasan Startup: sidecar dinyalakan otomatis setiap login Windows
#
# Tidak memerlukan: AuroraMaps, instal Node, maupun ekstensi browser.
# node.exe ikut dalam paket ini dan profil BHUMI dibuat/tumbuh otomatis
# di folder instalasi.
# =====================================================
param(
    # Mode uji: instal ke folder sementara, JANGAN daftarkan startup/pintasan
    [switch]$Uji
)

$ErrorActionPreference = 'Stop'
$paket  = Split-Path -Parent $MyInvocation.MyCommand.Path
$urlApp = 'https://riacaya.github.io/auroramaps/'

$tujuan = if ($Uji) { Join-Path $env:TEMP 'auroramaps-sidecar-uji' }
          else     { Join-Path $env:LOCALAPPDATA 'AuroraMapsSidecar' }

# ---- 1) Salin berkas paket (skrip + node.exe + ikon) -----------------------
$berkas = @('sidecar-host.mjs', 'sidecar-inject.js', 'sidecar-origins.json',
            'node.exe', 'auroramaps.ico', 'Mulai-Sidecar.ps1')
New-Item -ItemType Directory -Force -Path $tujuan | Out-Null
foreach ($f in $berkas) {
    $asal = Join-Path $paket $f
    if (-not (Test-Path $asal)) { throw "Berkas hilang di paket: $f (paket tidak lengkap)" }
    Copy-Item -Force $asal (Join-Path $tujuan $f)
}
Write-Host "Berkas terpasang di: $tujuan" -ForegroundColor Cyan

# ---- 2) Hentikan sidecar lama (semua instance) supaya port 8322 bebas ------
$lama = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*sidecar-host*' }
foreach ($p in $lama) {
    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue } catch { }
    Write-Host ("  sidecar lama dihentikan (PID " + $p.ProcessId + ")")
}
if ($lama) { Start-Sleep -Seconds 2 }

# ---- 3) Jalankan sidecar baru (tersembunyi) --------------------------------
$nodeHost = Join-Path $tujuan 'sidecar-host.mjs'
Start-Process -FilePath (Join-Path $tujuan 'node.exe') `
    -ArgumentList ('"' + $nodeHost + '"') `
    -WorkingDirectory $tujuan -WindowStyle Hidden

# ---- 4) Verifikasi /status --------------------------------------------------
$siap = $false; $statusJson = ''
for ($i = 0; $i -lt 24; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest 'http://127.0.0.1:8322/status' -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) { $siap = $true; $statusJson = $r.Content; break }
    } catch { }
}
if ($siap) {
    Write-Host "Status sidecar: $statusJson" -ForegroundColor Green
} else {
    Write-Host 'PERINGATAN: /status belum menjawab dalam 24 detik.' -ForegroundColor Yellow
    Write-Host '  Jalankan manual untuk melihat pesan galat: node.exe sidecar-host.mjs'
}

# ---- 5) Pintasan Desktop + menu Mulai (mode --app, tanpa bar browser) ------
$browser = $null
$kandidat = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles       'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:LOCALAPPDATA       'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:ProgramFiles       'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe')
)
foreach ($c in $kandidat) { if ($c -and (Test-Path $c)) { $browser = $c; break } }

if ($browser -and -not $Uji) {
    $ws  = New-Object -ComObject WScript.Shell
    $ico = Join-Path $tujuan 'auroramaps.ico'
    $tujuanLnk = @(
        (Join-Path ([Environment]::GetFolderPath('Desktop'))    'AuroraMaps.lnk'),
        (Join-Path ([Environment]::GetFolderPath('Programs'))   'AuroraMaps.lnk')   # menu Mulai
    )
    foreach ($lnkPath in $tujuanLnk) {
        $lnk = $ws.CreateShortcut($lnkPath)
        $lnk.TargetPath   = $browser
        $lnk.Arguments    = '--app=' + $urlApp
        $lnk.WorkingDirectory = Split-Path -Parent $browser
        $lnk.Description  = 'AuroraMaps - peta interaktif (mode aplikasi, tanpa bar browser)'
        if (Test-Path $ico) { $lnk.IconLocation = "$ico,0" }
        $lnk.Save()
        if (Test-Path $lnkPath) { Write-Host "Pintasan dibuat: $lnkPath" }
        else { Write-Host "Gagal membuat pintasan: $lnkPath" -ForegroundColor Yellow }
    }
} elseif (-not $browser) {
    Write-Host 'Browser Edge/Chrome tidak ditemukan - pintasan aplikasi dilewati.' -ForegroundColor Yellow
}

# ---- 6) Startup: sidecar hidup otomatis setiap login Windows ---------------
if (-not $Uji) {
    $ws2 = New-Object -ComObject WScript.Shell
    $lnkS = $ws2.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'AuroraMaps Sidecar.lnk'))
    $lnkS.TargetPath   = 'powershell.exe'
    $lnkS.Arguments    = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' +
                         (Join-Path $tujuan 'Mulai-Sidecar.ps1') + '"'
    $lnkS.WindowStyle  = 7   # minimized
    $lnkS.Description  = 'Sidecar AuroraMaps - jalan otomatis saat login'
    $lnkS.Save()
    Write-Host 'Startup dibuat: "AuroraMaps Sidecar" (hidden setiap login Windows)' -ForegroundColor Cyan
}

# ---- 7) Laporan -------------------------------------------------------------
Write-Host ''
Write-Host 'PEMASANGAN SELESAI.' -ForegroundColor Green
Write-Host "  Folder   : $tujuan"
Write-Host ("  Status   : " + $(if ($siap) { $statusJson } else { 'belum terkonfirmasi' }))
Write-Host '  Aplikasi : pintasan "AuroraMaps" di Desktop & menu Mulai (jendela tanpa bar browser)'
Write-Host '  Startup  : sidecar dinyalakan otomatis tiap login Windows (tersembunyi)'
if ($statusJson -notmatch '"loggedIn":\s*true') {
    Write-Host '  Login    : jalankan Login-BHUMI.bat sekali, klik "Saya Setuju" di jendela yang terbuka' -ForegroundColor Yellow
}
Write-Host '  Semua browser di PC ini (Chrome/Edge/Firefox) kini bisa cek bidang tanpa ekstensi.'
exit 0
