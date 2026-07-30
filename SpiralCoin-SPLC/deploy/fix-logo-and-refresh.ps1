# Swap the heavy PNG logo for a crisp transparent SVG mark in favicons + nav,
# and tighten the one slow polling timer (analytics tickers) from 60s -> 15s.
# OG / Twitter image tags keep the PNG (social cards require raster).

$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = "C:\Users\Trisha Dreyer\Documents\ionos-migration" }

$htmlFiles = Get-ChildItem -Path $root -Filter *.html -File -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\(node_modules|contracts|alchemy-demo|w3a-quick-start|deploy|funding|db|\.git|app)\\' }

$swapTotal = 0
foreach ($f in $htmlFiles) {
  $orig = Get-Content -Raw -LiteralPath $f.FullName
  $new  = $orig

  # 1) Favicon -> SVG (smaller, sharper, instant load)
  $new = $new -replace `
    '<link rel="icon"[^>]*href="/spiralcoin_logo\.png"[^>]*>', `
    '<link rel="icon" type="image/svg+xml" href="/assets/spiralcoin-mark.svg">'

  # 2) Apple touch icon stays PNG (iOS doesn't reliably accept SVG) – leave alone.

  # 3) Nav brand <img> -> SVG with explicit size (no layout shift, no blur)
  $new = $new -replace `
    '<img src="/spiralcoin_logo\.png" alt="([^"]*)">', `
    '<img src="/assets/spiralcoin-mark.svg" alt="$1" width="28" height="28" decoding="async">'

  # 4) The big "SPLC Logo" hero on index.html – give it crisp rendering
  $new = $new -replace `
    '<img src="/spiralcoin_logo\.png" alt="SPLC Logo">', `
    '<img src="/spiralcoin_logo.png" alt="SPLC Logo" width="200" height="200" decoding="async" loading="eager">'

  # 5) Speed up analytics polling 60s -> 15s
  if ($f.Name -eq 'analytics.html') {
    $new = $new -replace 'setInterval\(loadTickers, 60000\)', 'setInterval(loadTickers, 15000)'
    $new = $new -replace '24h snapshot refreshes every 60s', '24h snapshot refreshes every 15s'
  }

  if ($new -ne $orig) {
    Set-Content -LiteralPath $f.FullName -Value $new -NoNewline
    Write-Host ("  updated  {0}" -f $f.FullName.Substring($root.Length + 1)) -ForegroundColor Green
    $swapTotal++
  }
}

Write-Host ""
Write-Host "Files updated: $swapTotal" -ForegroundColor Cyan
Write-Host "Now run:  .\deploy\upload-ionos.ps1" -ForegroundColor Yellow
