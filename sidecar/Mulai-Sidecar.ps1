# =====================================================
# Mulai-Sidecar.ps1 — dijalankan otomatis saat Windows LOGIN (tersembunyi)
# Dipanggil oleh pintasan "AuroraMaps Sidecar" di folder Startup.
# Tugas: kalau sidecar belum jalan, nyalakan hidden; kalau sudah, selesai.
# =====================================================
$sudah = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*sidecar-host*' }
if ($sudah) { exit 0 }   # sudah berjalan — jangan dobel

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = Join-Path $dir 'node.exe'
$host1 = Join-Path $dir 'sidecar-host.mjs'
if (-not (Test-Path $node) -or -not (Test-Path $host1)) { exit 1 }

Start-Process -FilePath $node -ArgumentList ('"' + $host1 + '"') `
    -WorkingDirectory $dir -WindowStyle Hidden
