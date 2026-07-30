# Inject the galactic backdrop stylesheet + live-cosmos JS into every HTML page.
# Idempotent: re-running adds only what's missing.

$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = "C:\Users\Trisha Dreyer\Documents\ionos-migration" }

$linkTag   = '<link rel="stylesheet" href="/assets/galaxy-bg.css">'
$scriptTag = '<script defer src="/assets/galaxy-bg.js"></script>'

$htmlFiles = Get-ChildItem -Path $root -Filter *.html -File -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\(node_modules|contracts|alchemy-demo|w3a-quick-start|deploy|funding|db|\.git|app)\\' }

$updated = 0
foreach ($f in $htmlFiles) {
  $orig = Get-Content -Raw -LiteralPath $f.FullName
  $new  = $orig
  $changed = $false

  # 1. Ensure CSS link present
  if ($new -notmatch 'galaxy-bg\.css') {
    if ($new -match '(<meta http-equiv="Content-Security-Policy"[^>]*>)') {
      $new = $new -replace '(<meta http-equiv="Content-Security-Policy"[^>]*>)', ("`$1`r`n  $linkTag")
    } elseif ($new -match '(<meta charset="[^"]*">)') {
      $new = $new -replace '(<meta charset="[^"]*">)', ("`$1`r`n  $linkTag")
    } else {
      $new = $new -replace '(<head[^>]*>)', ("`$1`r`n  $linkTag")
    }
    $changed = $true
  }

  # 2. Ensure JS tag present
  if ($new -notmatch 'galaxy-bg\.js') {
    if ($new -match '(<link rel="stylesheet" href="/assets/galaxy-bg\.css">)') {
      $new = $new -replace '(<link rel="stylesheet" href="/assets/galaxy-bg\.css">)', ("`$1`r`n  $scriptTag")
    } elseif ($new -match '(<meta charset="[^"]*">)') {
      $new = $new -replace '(<meta charset="[^"]*">)', ("`$1`r`n  $scriptTag")
    } else {
      $new = $new -replace '(<head[^>]*>)', ("`$1`r`n  $scriptTag")
    }
    $changed = $true
  }

  if ($changed -and $new -ne $orig) {
    Set-Content -LiteralPath $f.FullName -Value $new -NoNewline
    Write-Host ("  injected {0}" -f $f.Name) -ForegroundColor Green
    $updated++
  } else {
    Write-Host ("  skip (already wired) {0}" -f $f.Name) -ForegroundColor DarkGray
  }
}

Write-Host ""
Write-Host "Files updated: $updated" -ForegroundColor Cyan
Write-Host "Now run:  .\deploy\upload-ionos.ps1" -ForegroundColor Yellow
