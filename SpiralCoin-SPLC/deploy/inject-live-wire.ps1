# Inject the live-feed + live-wire scripts and the professional ticker CSS
# into every HTML page. Idempotent via the SPLC_LIVE_WIRE marker.
#
# Adds (in <head>):
#   <script defer src="/assets/live-feed.js?v=YYYYMMDD"></script>
#   <script defer src="/assets/live-wire.js?v=YYYYMMDD"></script>
#   <style id="splc-live-wire">  /* SPLC_LIVE_WIRE_v1 */
#     ...professional ticker spacing overrides...
#   </style>

$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = "C:\Users\Trisha Dreyer\Documents\ionos-migration" }

$v = Get-Date -Format 'yyyyMMddHHmm'
$feedTag = "<script defer src=`"/assets/live-feed.js?v=$v`"></script>"
$wireTag = "<script defer src=`"/assets/live-wire.js?v=$v`"></script>"

$styleBlock = @"
<style id="splc-live-wire">
/* SPLC_LIVE_WIRE_v2 - professional ticker bar, flush under nav */
.status-strip, .ticker-bar, .splc-ticker-bar {
  position: fixed !important;
  top: var(--nav-h, 58px) !important;
  left: 0 !important;
  right: 0 !important;
  margin: 0 !important;
  z-index: 195 !important;
  height: 36px !important;
  background: rgba(6,10,16,0.94) !important;
  border-top: 0 !important;
  border-bottom: 1px solid rgba(201,162,39,0.22) !important;
  backdrop-filter: blur(14px) saturate(1.15);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
  box-shadow: 0 2px 12px rgba(0,0,0,0.35);
}
.strip-scroll {
  gap: 3.25rem !important;
  padding: 0 2.5rem !important;
  animation-duration: 90s !important;
  will-change: transform;
}
.strip-item {
  gap: 0.65rem !important;
  font-size: 0.82rem !important;
  letter-spacing: 0.01em;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1, 'lnum' 1;
}
.strip-sym {
  color: #c9a227 !important;
  font-weight: 700 !important;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.strip-price {
  color: #f4f6fb !important;
  font-weight: 500 !important;
  min-width: 4ch;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.strip-item [data-field="chg"],
.strip-item [data-field="change"],
.strip-item [data-field="pct"] {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  min-width: 5ch;
  text-align: right;
}
.strip-item [data-field="chg"].up,
.strip-item [data-field="change"].up,
.strip-item [data-field="pct"].up { color: #00c97a; }
.strip-item [data-field="chg"].down,
.strip-item [data-field="change"].down,
.strip-item [data-field="pct"].down { color: #ff3d5a; }
.strip-dot {
  box-shadow: 0 0 6px rgba(0,201,122,0.65);
}
/* Push first content section down so it isn't hidden behind nav + strip */
body > main, body > .hero, body > section:first-of-type,
.hero:first-of-type, main > .hero:first-child {
  padding-top: calc(var(--nav-h, 58px) + 36px + 8px) !important;
}
@media (max-width: 720px) {
  .strip-scroll { gap: 2rem !important; padding: 0 1rem !important; }
  .strip-item { font-size: 0.74rem !important; }
}
</style>
"@

$htmlFiles = Get-ChildItem -Path $root -Filter *.html -File -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\(node_modules|contracts|alchemy-demo|w3a-quick-start|deploy|funding|db|\.git|app)\\' }

$updated = 0
foreach ($f in $htmlFiles) {
  $orig = Get-Content -Raw -LiteralPath $f.FullName
  $new  = $orig

  # 1. Strip prior versions of our script tags (handles cache-bump replacements)
  $new = [Regex]::Replace($new, '<script[^>]*src="/assets/live-feed\.js[^"]*"[^>]*></script>\s*', '')
  $new = [Regex]::Replace($new, '<script[^>]*src="/assets/live-wire\.js[^"]*"[^>]*></script>\s*', '')

  # 2. Strip prior live-wire style block
  $new = [Regex]::Replace($new, '(?s)<style id="splc-live-wire">.*?</style>\s*', '')

  # 3. Inject fresh style + script tags right before </head>
  if ($new -match '</head>') {
    $inject = "  $styleBlock`r`n  $feedTag`r`n  $wireTag`r`n"
    $new = $new -replace '</head>', ($inject + '</head>')
  } else {
    Write-Host ("  no </head> in {0}, skipping" -f $f.Name) -ForegroundColor Yellow
    continue
  }

  if ($new -ne $orig) {
    Set-Content -LiteralPath $f.FullName -Value $new -NoNewline
    Write-Host ("  wired {0}" -f $f.Name) -ForegroundColor Green
    $updated++
  } else {
    Write-Host ("  no change {0}" -f $f.Name) -ForegroundColor DarkGray
  }
}

Write-Host ""
Write-Host "Files updated: $updated" -ForegroundColor Cyan
Write-Host "Cache-bust version: $v" -ForegroundColor Cyan
Write-Host "Now run:  .\deploy\upload-ionos.ps1" -ForegroundColor Yellow
