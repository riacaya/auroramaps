# =====================================================
# Pemasang Ekstensi AuroraMaps BHUMI Bridge (sekali klik)
# Dipanggil oleh Pasang-Ekstensi.bat, atau dijalankan langsung:
#   powershell -ExecutionPolicy Bypass -File Pasang-Ekstensi.ps1
# =====================================================
param(
    # Mode uji: instal ke folder sementara, buat pintasan di %TEMP%, jangan buka browser
    [switch]$Uji,
    # Alamat halaman aplikasi yang dibuka pintasan
    [string]$Alamat = "https://riacaya.github.io/auroramaps/"
)

$ErrorActionPreference = "Stop"

# 1) Folder tempat berkas pemasang ini berada (= isi paket)
$paket = Split-Path -Parent $MyInvocation.MyCommand.Path

# 2) Lokasi instalasi
if ($Uji) {
    $tujuan  = Join-Path $env:TEMP "auroramaps-ekstensi-uji"
    $desktop = $env:TEMP
} else {
    $tujuan  = Join-Path $env:LOCALAPPDATA "AuroraMapsBHUMI"
    $desktop = [Environment]::GetFolderPath('Desktop')
}

# 3) Salin berkas ekstensi (hanya file yang dibutuhkan browser)
$ext = Join-Path $tujuan "ekstensi"
New-Item -ItemType Directory -Force -Path $ext | Out-Null
$berkas = @(
    'manifest.json',
    'background.js',
    'sidecar-inject.js',
    'bhumi-main-adapter.js',
    'bhumi-page.js',
    'page-shim.js',
    'app-bridge.js'
)
foreach ($f in $berkas) {
    $asal = Join-Path $paket $f
    if (-not (Test-Path $asal)) { throw "Berkas hilang: $f (paket tidak lengkap)" }
    Copy-Item -Force $asal (Join-Path $ext $f)
}
Write-Host "Berkas ekstensi disalin ke: $ext"

# 3b) Ikon ikut dipindah ke folder instalasi — supaya pintasan tetap berlogo
#     walau folder asal (hasil ekstrak zip) dihapus.
$icoInstal = Join-Path $tujuan 'auroramaps.ico'
$icoPaket  = Join-Path $paket 'auroramaps.ico'
if (Test-Path $icoPaket) { Copy-Item -Force $icoPaket $icoInstal }

# 4) Cari browser (Edge didahulukan, lalu Chrome; instalasi per-pengguna)
$akar = @(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA) |
    Where-Object { $_ -and (Test-Path $_) }
$urut = @(
    'Microsoft\Edge\Application\msedge.exe',
    'Google\Chrome\Application\chrome.exe',
    'Microsoft\Edge\Application\msedge.exe',
    'Google\Chrome\Application\chrome.exe'
)
$browser = $null
foreach ($a in $akar) {
    foreach ($rel in $urut) {
        $c = Join-Path $a $rel
        if (Test-Path $c) { $browser = $c; break }
    }
    if ($browser) { break }
}
if (-not $browser) { throw 'Microsoft Edge / Google Chrome tidak ditemukan di komputer ini.' }
Write-Host "Browser: $browser"

# 5) Pintasan Desktop -> browser ber-profil khusus + ekstensi termuat
$lnkPath = Join-Path $desktop 'AuroraMaps.lnk'
$profil  = Join-Path $tujuan 'profil'
$ws  = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath   = $browser
$lnk.Arguments    = '--user-data-dir="{0}" --load-extension="{1}" --no-first-run --no-default-browser-check --start-maximized "{2}"' -f $profil, $ext, $Alamat
$lnk.WorkingDirectory = $tujuan
$lnk.Description  = 'AuroraMaps - Peta Interaktif BHUMI ATR/BPN'
$ico = $icoInstal
if (-not (Test-Path $ico)) { $ico = $icoPaket }
if (-not (Test-Path $ico)) { $ico = Join-Path (Split-Path -Parent $paket) (Join-Path 'tools\installer' 'auroramaps.ico') }
if (Test-Path $ico) { $lnk.IconLocation = "$ico,0" } else { $lnk.IconLocation = "$browser,0" }
$lnk.Save()
if (-not (Test-Path $lnkPath)) { throw 'Gagal membuat pintasan Desktop.' }
Write-Host "Pintasan dibuat: $lnkPath"

# 6) Selesai — mode normal langsung membuka aplikasinya
if (-not $Uji) {
    Start-Process $lnkPath
    Write-Host ''
    Write-Host 'PEMASANGAN SELESAI. Jendela AuroraMaps terbuka otomatis.' -ForegroundColor Green
    Write-Host 'Pertama kali: login BHUMI sekali di jendela yang muncul, lalu jendela itu'
    Write-Host 'menyimpan diri sendiri. Setelah ini cukup klik pintasan "AuroraMaps" di Desktop.'
}
exit 0
