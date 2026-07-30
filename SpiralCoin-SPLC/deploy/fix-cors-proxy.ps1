# Replace failing corsproxy.io with api.allorigins.win in all site files,
# and add allorigins.win to the CSP connect-src so the new proxy isn't blocked.

$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = "C:\Users\Trisha Dreyer\Documents\ionos-migration" }

$targets = Get-ChildItem -Path $root -Include *.html, *.js -File -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\(node_modules|contracts|alchemy-demo|w3a-quick-start|deploy|funding|db|\.git)\\' }

$totalSwaps = 0
$cspUpdates = 0

foreach ($f in $targets) {
  $orig = Get-Content -Raw -LiteralPath $f.FullName

  # 1) swap the proxy URL
  $new = $orig -replace 'https://corsproxy\.io/\?', 'https://api.allorigins.win/raw?url='

  # 2) extend CSP connect-src in <meta> tag to allow allorigins
  $new = $new -replace 'https://corsproxy\.io(?=[ ;])', 'https://api.allorigins.win'

  if ($new -ne $orig) {
    $swaps = ([regex]::Matches($orig, 'corsproxy\.io')).Count
    Set-Content -LiteralPath $f.FullName -Value $new -NoNewline
    Write-Host ("  {0,2} swap(s)  {1}" -f $swaps, $f.FullName.Substring($root.Length + 1)) -ForegroundColor Green
    $totalSwaps += $swaps
  }
}

# 3) also update .htaccess CSP header
$ht = Join-Path $root '.htaccess'
if (Test-Path $ht) {
  $h = Get-Content -Raw -LiteralPath $ht
  $hNew = $h -replace 'https://corsproxy\.io(?=[ ;])', 'https://api.allorigins.win'
  if ($hNew -ne $h) {
    Set-Content -LiteralPath $ht -Value $hNew -NoNewline
    Write-Host "  updated .htaccess CSP" -ForegroundColor Yellow
    $cspUpdates++
  }
}

Write-Host ""
Write-Host "Done. Proxy swaps: $totalSwaps   .htaccess CSP updates: $cspUpdates" -ForegroundColor Cyan
Write-Host "Now run:  .\deploy\upload-ionos.ps1" -ForegroundColor Yellow
