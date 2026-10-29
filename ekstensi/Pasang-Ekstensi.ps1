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

# Halaman pengembang sesuai browser (tempat sakelar Developer mode)
$halamanDev = 'edge://extensions/'
if ((Split-Path $browser -Leaf) -like 'chrome*') { $halamanDev = 'chrome://extensions/' }

# 5) Pintasan Desktop -> browser ber-profil khusus + ekstensi termuat
$lnkPath = Join-Path $desktop 'AuroraMaps.lnk'
$profil  = Join-Path $tujuan 'profil'
$ws  = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath   = $browser
# Argumen anti-throttle: jendela pendamping BHUMI berjalan minimize — tanpa
# flag ini Chromium memperlambat timer jendela tersembunyi (interval 2 dtk →
# 60 dtk) sehingga tombol "Saya Setuju" telat diklik dan user terpaksa
# membuka tab BHUMI secara manual.
$lnk.Arguments    = '--user-data-dir="{0}" --load-extension="{1}" --disable-features=DisableLoadExtensionCommandLineSwitch --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --no-first-run --no-default-browser-check --start-maximized "{2}"' -f $profil, $ext, $Alamat
$lnk.WorkingDirectory = $tujuan
$lnk.Description  = 'AuroraMaps - Peta Interaktif BHUMI ATR/BPN'
$ico = $icoInstal
if (-not (Test-Path $ico)) { $ico = $icoPaket }
if (-not (Test-Path $ico)) { $ico = Join-Path (Split-Path -Parent $paket) (Join-Path 'tools\installer' 'auroramaps.ico') }
if (Test-Path $ico) { $lnk.IconLocation = "$ico,0" } else { $lnk.IconLocation = "$browser,0" }
$lnk.Save()
if (-not (Test-Path $lnkPath)) { throw 'Gagal membuat pintasan Desktop.' }
Write-Host "Pintasan dibuat: $lnkPath"

# ---- Helper untuk Developer mode otomatis -------------------------------
# Latar (Chromium 134+): ekstensi tetap "terdaftar" tetapi TIDAK AKAN PERNAH
# dimuat selama extensions.developer_mode = false di profil (pesan resmi:
# "To use this extension, turn on developer mode"). Flag --load-extension
# hanya berlaku pada sesi pertama; sesi berikutnya Edge memakai catatan
# tersimpan sehingga Developer mode harus sudah menyala. Tidak ada flag CLI
# maupun kebijakan untuk menyalakannya, jadi pemasang membalik sakelar
# halaman pengembang lewat DevTools Protocol — Edge/Chrome yang menulis
# preferensinya sendiri (MAC-nya sah), lalu sesi dijalankan ulang bersih.

function Stop-ProfilProses {
    Get-CimInstance Win32_Process -Filter "Name='msedge.exe' or Name='chrome.exe'" |
        Where-Object { $_.CommandLine -like "*$profil*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

# JS: temukan sakelar Developer mode (Edge fluent #dev-switch / Chrome) lalu klik.
$jsDevMode = @'
(function(){
  var sw=null;
  function target(el){
    var id=el.id||'';
    if(id==='dev-switch'||id==='on-off-ed'||id==='developer-mode') return true;
    var al=(el.getAttribute&&el.getAttribute('aria-label'))||'';
    if(/developer mode/i.test(al)){
      var role=el.getAttribute&&el.getAttribute('role');
      var tag=el.tagName;
      if(role==='switch'||role==='checkbox'||tag==='FLUENT-SWITCH'||tag==='CR-TOGGLE') return true;
    }
    return false;
  }
  function walk(root,d){
    var els=root.querySelectorAll('*');
    for(var i=0;i<els.length;i++){
      var el=els[i];
      var t=el.tagName;
      if(t==='STYLE'||t==='SCRIPT'||t==='LINK') continue;
      if(el.shadowRoot&&d<12) walk(el.shadowRoot,d+1);
      if(!sw&&target(el)) sw=el;
    }
  }
  walk(document,0);
  function nyala(e){
    if(!e) return false;
    if(e.checked===true) return true;
    var a=e.getAttribute&&e.getAttribute('checked');
    return a!==null&&a!==undefined&&a!=='false';
  }
  if(!sw) return JSON.stringify({ok:false,why:'sakelar tidak ditemukan'});
  var sebelum=nyala(sw);
  if(!sebelum&&sw.click) sw.click();
  var sesudah=nyala(sw);
  return JSON.stringify({ok:true,sebelum:sebelum,sesudah:sesudah});
})()
'@

function Set-DeveloperModeOtomatis {
    param([int]$Port = 9337)
    # Port debug hanya bisa dipasang saat browser start → pastikan profil tertutup
    Stop-ProfilProses
    Start-Sleep -Seconds 2
    $argList = '--user-data-dir="{0}" --load-extension="{1}" --disable-features=DisableLoadExtensionCommandLineSwitch --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --no-first-run --no-default-browser-check --remote-debugging-port={2} "{3}"' -f $profil, $ext, $Port, $Alamat
    Start-Process $browser -ArgumentList $argList
    # Tunggu port CDP siap (profil baru butuh waktu membuat profil)
    $siap = $false
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $r = Invoke-WebRequest "http://127.0.0.1:$Port/json/version" -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200) { $siap = $true; break }
        } catch { }
    }
    if (-not $siap) { return $false }
    # Buka (atau pakai) tab halaman pengembang
    $tab = $null
    try {
        $tab = ((Invoke-WebRequest "http://127.0.0.1:$Port/json/list" -UseBasicParsing).Content | ConvertFrom-Json) |
            Where-Object { $_.type -eq 'page' -and $_.url -like "$halamanDev*" } | Select-Object -First 1
    } catch { }
    if (-not $tab) {
        try {
            $r2 = Invoke-WebRequest -Method Put -Uri ("http://127.0.0.1:$Port/json/new?" + $halamanDev) -UseBasicParsing
            $tab = $r2.Content | ConvertFrom-Json
        } catch { }
    }
    if (-not $tab) { return $false }
    Start-Sleep -Seconds 3
    # DevTools Protocol via WebSocket: evaluasi JS toggle (ulang sampai halaman siap)
    $hasil = $null
    try {
        $wsc = New-Object System.Net.WebSockets.ClientWebSocket
        $cts = New-Object System.Threading.CancellationTokenSource
        $wsc.ConnectAsync([Uri]$tab.webSocketDebuggerUrl, $cts.Token).Wait()
        for ($coba = 0; $coba -lt 8 -and -not $hasil; $coba++) {
            if ($coba -gt 0) { Start-Sleep -Seconds 2 }
            $msg = @{ id = 1; method = 'Runtime.evaluate'; params = @{ expression = $jsDevMode; returnByValue = $true } } |
                ConvertTo-Json -Depth 6
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
            $segKirim = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
            $wsc.SendAsync($segKirim, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token).Wait()
            $ms = New-Object System.IO.MemoryStream
            do {
                $buf = New-Object byte[] 16384
                $segBaca = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
                $rx = $wsc.ReceiveAsync($segBaca, $cts.Token).Result
                $ms.Write($buf, 0, $rx.Count)
            } while (-not $rx.EndOfMessage)
            $balas = [System.Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json
            if ($balas.id -eq 1 -and $balas.result.result.value) {
                $o = $balas.result.result.value | ConvertFrom-Json
                if ($o.ok) { $hasil = $o }
            }
        }
        try { $wsc.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'selesai', $cts.Token).Wait() } catch { }
    } catch { $hasil = $null }
    # Tutup tab pengembang agar jendela aplikasi bersih
    try { Invoke-WebRequest "http://127.0.0.1:$Port/json/close/$($tab.id)" -UseBasicParsing | Out-Null } catch { }
    if (-not $hasil -or -not $hasil.sesudah) { return $false }
    # Edge/Chrome menulis preferensi TERTUNDA (±10 dtk setelah perubahan).
    # Tunggu sampai "developer_mode":true benar-benar ada di berkas — kalau
    # proses dibunuh sebelum itu, toggle hilang dan ekstensi mati lagi pada
    # sesi berikutnya (inilah yang membuat putaran tutup-buka gagal).
    $prefA = Join-Path $profil 'Default\Secure Preferences'
    $prefB = Join-Path $profil 'Default\Preferences'
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        foreach ($f in @($prefA, $prefB)) {
            if (Test-Path $f) {
                try {
                    if ((Get-Content $f -Raw) -match '"developer_mode"\s*:\s*true') { return $true }
                } catch { }
            }
        }
    }
    return $false
}

# 6) Selesai — mode normal: nyalakan Developer mode, lalu buka aplikasi
if (-not $Uji) {
    Write-Host ''
    Write-Host 'Menyalakan Developer mode secara otomatis (sekali di sesi ini)...'
    $devOk = $false
    try { $devOk = Set-DeveloperModeOtomatis }
    catch { Write-Host ("  catatan: " + $_.Exception.Message) }
    # Tutup sesi diagnostik (dengan port) → jalankan pintasan bersih (tanpa port).
    # Langkah ini sekaligus memvalidasi jalur "tutup lalu buka lagi".
    Stop-ProfilProses
    Start-Sleep -Seconds 2
    Start-Process $lnkPath
    if ($devOk) {
        Write-Host 'Developer mode: NYALA (otomatis) - ekstensi akan termuat di setiap sesi.' -ForegroundColor Green
    } else {
        Write-Host 'Developer mode belum terkonfirmasi. Nyalakan MANUAL sekali:' -ForegroundColor Yellow
        Write-Host "  buka $halamanDev lalu klik sakelar \"Developer mode\" (kiri atas) -> ON"
    }
    Write-Host ''
    Write-Host 'PEMASANGAN SELESAI. Jendela AuroraMaps terbuka otomatis.' -ForegroundColor Green
    Write-Host 'Pertama kali: login BHUMI sekali di jendela yang muncul, lalu jendela itu'
    Write-Host 'menyimpan diri sendiri. Setelah ini cukup klik pintasan "AuroraMaps" di Desktop.'
}
exit 0
