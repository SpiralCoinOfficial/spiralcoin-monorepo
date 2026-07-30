# Rebuild PNG banner exports from display-creative.html via headless Chrome.
# Usage:  pwsh -File funding/ads/render-banners.ps1
$ErrorActionPreference = 'Stop'
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { throw "Chrome not found at $chrome" }
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = (Resolve-Path (Join-Path $root 'display-creative.html')).Path -replace '\\', '/'
$dst = Join-Path $root 'exports'
New-Item -ItemType Directory -Path $dst -Force | Out-Null
$dstFwd = ($dst -replace '\\', '/')

$banners = @(
    @{ b = 'lead';   w = 1200; h = 628  },
    @{ b = 'square'; w = 1080; h = 1080 },
    @{ b = 'story';  w = 1080; h = 1920 }
)
foreach ($p in $banners) {
    $out = "$dstFwd/banner-$($p.b)-$($p.w)x$($p.h).png"
    & $chrome --headless=new --disable-gpu --hide-scrollbars --no-sandbox `
        "--screenshot=$out" `
        "--window-size=$($p.w),$($p.h)" `
        "file:///$src`?b=$($p.b)" 2>&1 | Out-Null
    if (Test-Path $out) {
        $kb = [math]::Round((Get-Item $out).Length / 1KB, 1)
        Write-Host ("OK  $out  ({0} KB)" -f $kb)
    } else {
        Write-Host "FAIL $out"
    }
}
