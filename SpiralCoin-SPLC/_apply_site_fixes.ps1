# One-shot site-wide fix script.
# 1. GA4 -> Plausible (privacy-friendly analytics).
# 2. CSP updated to allow plausible.io (script + connect), drop googletagmanager.
# 3. MATIC -> POL display + symbol rename (Polygon rebrand).
# 4. trade.html Sign Out anchor: href="javascript:void(0)" (no fragment jump).

[CmdletBinding()]
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$plausibleTag = '  <script defer data-domain="spiralcoin.net" src="https://plausible.io/js/script.js"></script>'

# Match GA4 loader + inline config block (two consecutive lines, with leading whitespace).
$gaLoaderRx = '(?m)^\s*<script async src="https://www\.googletagmanager\.com/gtag/js\?id=[^"]+"></script>\r?\n'
$gaConfigRx = '(?m)^\s*<script>\s*window\.dataLayer[\s\S]*?gtag\(''config''[^)]*\);\s*</script>\r?\n'

# MATIC display + symbol rebrand. Order matters: do longest first.
$matMap = [ordered]@{
  "MATIC / USDT"          = "POL / USDT"
  "MATIC/USDT"            = "POL/USDT"
  "MATICUSDT"             = "POLUSDT"
  "abbr: 'MATIC'"         = "abbr: 'POL'"
  "sym: 'MATIC'"          = "sym: 'POL'"
}

$files = Get-ChildItem -File -Filter *.html
$report = @()

foreach ($f in $files) {
  $orig = Get-Content -Raw $f.FullName
  $txt  = $orig
  $changes = @()

  # --- Strip GA4 script blocks FIRST (before CSP rewrite changes the URL).
  if ($txt -match $gaLoaderRx) {
    $txt = [regex]::Replace($txt, $gaLoaderRx, '')
    $changes += 'ga4:loader'
  }
  if ($txt -match $gaConfigRx) {
    $txt = [regex]::Replace($txt, $gaConfigRx, '')
    $changes += 'ga4:config'
  }

  # --- CSP: swap googletagmanager -> plausible.io for script-src; add plausible.io to connect-src.
  if ($txt -match 'https://www\.googletagmanager\.com') {
    $txt = $txt -replace 'https://www\.googletagmanager\.com', 'https://plausible.io'
    $changes += 'csp:script-src'
  }
  if ($txt -match 'https://www\.google-analytics\.com') {
    $txt = $txt -replace 'https://www\.google-analytics\.com', 'https://plausible.io'
    $changes += 'csp:connect-src'
  }

  # --- Inject Plausible right after <meta charset...> if not already present.
  if ($txt -notmatch 'plausible\.io/js/script\.js') {
    $injectRx = '(?m)^(\s*<meta\s+charset[^>]*>\r?\n)'
    if ($txt -match $injectRx) {
      $txt = [regex]::Replace($txt, $injectRx, "`$1$plausibleTag`r`n", 1)
      $changes += 'plausible:add'
    } else {
      # Fallback: insert after opening <head>.
      $headRx = '(?m)^(\s*<head[^>]*>\r?\n)'
      if ($txt -match $headRx) {
        $txt = [regex]::Replace($txt, $headRx, "`$1$plausibleTag`r`n", 1)
        $changes += 'plausible:add(head)'
      }
    }
  }

  # --- MATIC -> POL display/symbol.
  foreach ($k in $matMap.Keys) {
    if ($txt.Contains($k)) {
      $txt = $txt.Replace($k, $matMap[$k])
      $changes += "matic:$k"
    }
  }

  # --- trade.html Sign Out anchor.
  if ($f.Name -eq 'trade.html') {
    $oldA = '<a href="#" onclick="doSignOut()"'
    $newA = '<a href="javascript:void(0)" onclick="doSignOut()"'
    if ($txt.Contains($oldA)) {
      $txt = $txt.Replace($oldA, $newA)
      $changes += 'trade:signout-anchor'
    }
  }

  if ($txt -ne $orig) {
    $report += [PSCustomObject]@{ file = $f.Name; changes = ($changes -join ', ') }
    if (-not $DryRun) {
      # Preserve BOM-less UTF-8 (matches existing repo style).
      [System.IO.File]::WriteAllText($f.FullName, $txt, [System.Text.UTF8Encoding]::new($false))
    }
  }
}

$report | Format-Table -AutoSize
"Total files modified: $($report.Count)"
