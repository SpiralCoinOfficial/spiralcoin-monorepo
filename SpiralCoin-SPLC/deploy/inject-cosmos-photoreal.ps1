# Inject photoreal NASA Hubble/JWST background.
# - Adds fixed background image of JWST Carina Nebula (real-life space photo)
# - Slow Ken Burns animation (pan + zoom) so it feels alive
# - Hides the procedural canvas (#splc-cosmos) from the v3 inline cosmos block
# - Adds vignette + slight darkening so foreground text stays readable
# Idempotent via marker SPLC_COSMOS_PHOTOREAL_v1.
#
# Image source: NASA / ESA / CSA / STScI - James Webb Space Telescope
#   "Cosmic Cliffs" in the Carina Nebula. Public domain.
# Hosted via Wikimedia Commons CDN (rock-solid + CSP-allowed under img-src https:).

$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = "C:\Users\Trisha Dreyer\Documents\ionos-migration" }

$v = Get-Date -Format 'yyyyMMddHHmm'

# NASA JWST Carina Nebula "Cosmic Cliffs" - public domain
$NASA_IMG = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/%22Cosmic_Cliffs%22_in_the_Carina_Nebula_%28NIRCam_Image%29.jpg/2880px-%22Cosmic_Cliffs%22_in_the_Carina_Nebula_%28NIRCam_Image%29.jpg'

$photoBlock = @"
<style id="splc-cosmos-photoreal">
/* SPLC_COSMOS_PHOTOREAL_v2 - real NASA JWST image, Ken Burns motion */
/* Disable the procedural cartoon canvas from cosmos v3 */
#splc-cosmos, canvas#splc-cosmos { display: none !important; }

/* Override the v3 inline rule `body > *:not(#splc-cosmos){position:relative;z-index:1}`
   which otherwise strips fixed positioning from our photo + veil layers. */
body > #splc-cosmos-photo,
body > #splc-cosmos-veil {
  position: fixed !important;
  inset: 0 !important;
  z-index: 0 !important;
  pointer-events: none !important;
}

#splc-cosmos-photo {
  position: fixed !important;
  inset: 0 !important;
  z-index: 0 !important;
  background-image: url('$NASA_IMG') !important;
  background-size: cover !important;
  background-position: center center !important;
  background-repeat: no-repeat !important;
  background-color: #02040a !important;
  transform-origin: 55% 45%;
  animation: splcKenBurns 120s ease-in-out infinite alternate;
  will-change: transform;
  pointer-events: none !important;
}
#splc-cosmos-veil {
  position: fixed !important;
  inset: 0 !important;
  z-index: 1 !important;
  pointer-events: none !important;
  background:
    radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.32) 60%, rgba(0,0,0,0.72) 100%),
    linear-gradient(180deg, rgba(6,10,16,0.35) 0%, rgba(6,10,16,0.20) 35%, rgba(6,10,16,0.50) 100%) !important;
}
/* All actual page content must sit above the veil */
body > *:not(#splc-cosmos-photo):not(#splc-cosmos-veil):not(#splc-cosmos) {
  position: relative;
  z-index: 2;
}
@keyframes splcKenBurns {
  0%   { transform: scale(1.00) translate3d(0, 0, 0); }
  50%  { transform: scale(1.10) translate3d(-1.5%, -1%, 0); }
  100% { transform: scale(1.05) translate3d(1.5%, 1%, 0); }
}
@media (prefers-reduced-motion: reduce) {
  #splc-cosmos-photo { animation: none !important; }
}
/* Body needs to be transparent so the bg shows */
html, body { background-color: transparent !important; }
body { background-image: none !important; }
</style>
<script>
(function(){
  if (window.__SPLC_COSMOS_PHOTOREAL__) return;
  window.__SPLC_COSMOS_PHOTOREAL__ = true;
  function mount() {
    if (document.getElementById('splc-cosmos-photo')) return;
    var photo = document.createElement('div');
    photo.id = 'splc-cosmos-photo';
    var veil = document.createElement('div');
    veil.id = 'splc-cosmos-veil';
    var b = document.body || document.documentElement;
    b.insertBefore(veil, b.firstChild);
    b.insertBefore(photo, b.firstChild);
    console.info('%c[SpiralCoin] photoreal cosmos v1 boot', 'color:#c9a227;font-weight:bold');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else { mount(); }
})();
</script>
"@

$htmlFiles = Get-ChildItem -Path $root -Filter *.html -File -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\(node_modules|contracts|alchemy-demo|w3a-quick-start|deploy|funding|db|\.git|app)\\' }

$updated = 0
foreach ($f in $htmlFiles) {
  $orig = Get-Content -Raw -LiteralPath $f.FullName
  $new  = $orig

  # Strip any prior photoreal block (handles re-runs/cache bumps)
  $new = [Regex]::Replace($new, '(?s)<style id="splc-cosmos-photoreal">.*?</style>\s*', '')
  $new = [Regex]::Replace($new, '(?s)<script>\s*\(function\(\)\{\s*if\s*\(window\.__SPLC_COSMOS_PHOTOREAL__\).*?\}\)\(\);\s*</script>\s*', '')

  # Inject fresh block right before </head>
  if ($new -match '</head>') {
    $new = $new -replace '</head>', ("  $photoBlock`r`n</head>")
  } else {
    Write-Host ("  no </head> in {0}, skipping" -f $f.Name) -ForegroundColor Yellow
    continue
  }

  if ($new -ne $orig) {
    Set-Content -LiteralPath $f.FullName -Value $new -NoNewline
    Write-Host ("  photoreal {0}" -f $f.Name) -ForegroundColor Green
    $updated++
  } else {
    Write-Host ("  no change {0}" -f $f.Name) -ForegroundColor DarkGray
  }
}

Write-Host ""
Write-Host "Files updated: $updated" -ForegroundColor Cyan
Write-Host "Cache-bust version: $v" -ForegroundColor Cyan
Write-Host "Image: $NASA_IMG" -ForegroundColor Cyan
Write-Host "Now run:  .\deploy\upload-ionos.ps1" -ForegroundColor Yellow
