# Replace Binance.com with Binance.US across all site HTML + assets.
# Binance.com geo-blocks US IPs, causing WebSocket failures for US visitors.
# Binance.US (api.binance.us, stream.binance.us) supports the major USDT pairs.

$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = "C:\Users\Trisha Dreyer\Documents\ionos-migration" }
Write-Host "Scanning $root ..." -ForegroundColor Cyan

$targets = @(
  "$root\*.html",
  "$root\assets\*.js"
)

$files = Get-ChildItem -Path $targets -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer }
$totalReplacements = 0
$touched = @()

foreach ($f in $files) {
  $orig = Get-Content -Raw -LiteralPath $f.FullName
  $new  = $orig `
    -replace 'wss://stream\.binance\.com:9443', 'wss://stream.binance.us:9443' `
    -replace 'https://api\.binance\.com',       'https://api.binance.us' `
    -replace 'http://api\.binance\.com',        'https://api.binance.us'

  if ($new -ne $orig) {
    $count = ([regex]::Matches($orig, 'binance\.com')).Count - ([regex]::Matches($new, 'binance\.com')).Count
    Set-Content -LiteralPath $f.FullName -Value $new -NoNewline
    $totalReplacements += $count
    $touched += "{0,4}  {1}" -f $count, $f.FullName.Substring($root.Length + 1)
  }
}

Write-Host ""
Write-Host "Replaced $totalReplacements occurrences across $($touched.Count) files:" -ForegroundColor Green
$touched | ForEach-Object { Write-Host "  $_" }
Write-Host ""
Write-Host "Now re-deploy:  .\deploy\upload-ionos.ps1" -ForegroundColor Yellow
