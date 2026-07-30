# Inject Content-Security-Policy as a <meta http-equiv> tag into every HTML file.
# Belt-and-suspenders for cases where the .htaccess Header directive is
# stripped, cached stale, or not honored by the host.

$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = "C:\Users\Trisha Dreyer\Documents\ionos-migration" }

$csp = "default-src 'self' https:; " +
       "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://unpkg.com https://cdn.jsdelivr.net https://stream.binance.us https://stream.binance.us:9443 https://api.binance.us; " +
       "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
       "font-src 'self' https://fonts.gstatic.com data:; " +
       "img-src 'self' data: blob: https:; " +
       "connect-src 'self' https://api.binance.us wss://stream.binance.us wss://stream.binance.us:9443 https://corsproxy.io https://query1.finance.yahoo.com https://www.google-analytics.com https://api.coingecko.com https://*.g.alchemy.com wss://*.g.alchemy.com https://*.infura.io wss://*.infura.io; " +
       "frame-src 'self' https:; " +
       "object-src 'none'; " +
       "base-uri 'self'; " +
       "form-action 'self'"

$cspTag = "  <meta http-equiv=`"Content-Security-Policy`" content=`"$csp`">"
$marker = 'http-equiv="Content-Security-Policy"'

$htmlFiles = Get-ChildItem -Path $root -Filter *.html -File
$updated = 0
$skipped = 0

foreach ($f in $htmlFiles) {
  $content = Get-Content -Raw -LiteralPath $f.FullName

  if ($content -match [regex]::Escape($marker)) {
    # Already has a CSP meta — replace that line
    $new = [regex]::Replace(
      $content,
      '(?im)^[ \t]*<meta\s+http-equiv="Content-Security-Policy"[^>]*>[ \t]*\r?\n?',
      ($cspTag + "`r`n")
    )
    if ($new -ne $content) {
      Set-Content -LiteralPath $f.FullName -Value $new -NoNewline
      Write-Host ("  updated CSP in {0}" -f $f.Name) -ForegroundColor Yellow
      $updated++
    } else {
      $skipped++
    }
    continue
  }

  # Inject right after the FIRST <meta charset...> tag
  if ($content -match '(?i)<meta\s+charset[^>]*>') {
    $new = [regex]::Replace(
      $content,
      '(?i)(<meta\s+charset[^>]*>)',
      ('$1' + "`r`n" + $cspTag),
      1
    )
    Set-Content -LiteralPath $f.FullName -Value $new -NoNewline
    Write-Host ("  injected CSP in {0}" -f $f.Name) -ForegroundColor Green
    $updated++
  } else {
    Write-Host ("  SKIP (no <meta charset>): {0}" -f $f.Name) -ForegroundColor DarkGray
    $skipped++
  }
}

Write-Host ""
Write-Host "Done. Updated: $updated  Skipped: $skipped" -ForegroundColor Cyan
Write-Host "Now run:  .\deploy\upload-ionos.ps1" -ForegroundColor Yellow
