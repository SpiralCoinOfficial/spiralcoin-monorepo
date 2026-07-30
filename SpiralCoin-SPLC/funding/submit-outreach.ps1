# submit-outreach.ps1
# One-command helper: opens every submission destination in browser tabs so you
# can paste-and-send the DMs and grant applications in a single sitting.
#
# Usage:
#   .\funding\submit-outreach.ps1                  # opens everything
#   .\funding\submit-outreach.ps1 -DMsOnly         # only the 10 X DM targets
#   .\funding\submit-outreach.ps1 -GrantsOnly      # only the 3 grant forums
#
# Notes:
# - Does NOT actually post anything. Just opens tabs. YOU paste from the
#   matching .md files and click send.
# - X.com may rate-limit if 10 tabs open at once. Open in batches of 3-5 if so.

[CmdletBinding()]
param(
    [switch]$DMsOnly,
    [switch]$GrantsOnly
)

$ErrorActionPreference = 'Stop'

$dmTargets = @(
    @{ Name = 'Cobie';            Url = 'https://x.com/cobie' }
    @{ Name = 'Robert Leshner';   Url = 'https://x.com/rleshner' }
    @{ Name = 'Tarun Chitra';     Url = 'https://x.com/tarunchitra' }
    @{ Name = 'Hasu';             Url = 'https://x.com/hasufl' }
    @{ Name = 'Hugh Karp';        Url = 'https://x.com/HughKarp' }
    @{ Name = 'Loi Luu';          Url = 'https://x.com/loi_luu' }
    @{ Name = 'Mariano Conti';    Url = 'https://x.com/nanexcool' }
    @{ Name = 'Smokey The Bera';  Url = 'https://x.com/SmokeyTheBera' }
    @{ Name = 'DCF GOD';          Url = 'https://x.com/dcfgod' }
)

$grantDestinations = @(
    @{ Name = 'MetaMask Grants DAO (forum)'; Url = 'https://forum.metamask-grants.org/' }
    @{ Name = 'MetaMask Grants criteria';    Url = 'https://metamask-grants.org/' }
    @{ Name = 'CoW DAO Grants (forum)';      Url = 'https://forum.cow.fi/c/cowdao/cowdao-grants/19' }
    @{ Name = 'CoW DAO Grants criteria';     Url = 'https://grants.cow.fi/' }
    @{ Name = 'Across Forum (Ecosystem)';    Url = 'https://forum.across.to/' }
)

function Open-Tabs {
    param([array]$Items, [string]$Heading)
    Write-Host ""
    Write-Host "== $Heading ==" -ForegroundColor Cyan
    foreach ($i in $Items) {
        Write-Host ("  -> {0,-32} {1}" -f $i.Name, $i.Url) -ForegroundColor Gray
        Start-Process $i.Url
        Start-Sleep -Milliseconds 350
    }
}

Write-Host ""
Write-Host "SpiralCoin outreach launcher" -ForegroundColor Yellow
Write-Host "============================" -ForegroundColor Yellow

if (-not $GrantsOnly) {
    Open-Tabs -Items $dmTargets -Heading "10 X DM targets (paste from funding/dm-batch-2026-05-28.md)"
    Write-Host ""
    Write-Host "PACING REMINDER:" -ForegroundColor Yellow
    Write-Host "  - send max 15 DMs per day from one X account"
    Write-Host "  - wait at least 60 seconds between sends"
    Write-Host "  - if anyone replies, STOP the batch and respond first"
}

if (-not $DMsOnly) {
    Open-Tabs -Items $grantDestinations -Heading "3 grant submissions (paste from funding/grant-apps/*.md)"
    Write-Host ""
    Write-Host "GRANT REMINDER:" -ForegroundColor Yellow
    Write-Host "  - register forum accounts FIRST (each forum requires email signup)"
    Write-Host "  - paste the .md body into the 'New Topic' editor"
    Write-Host "  - use the exact title line from the .md as the topic title"
    Write-Host "  - back-fill the [FILL IN AFTER FORUM REGISTRATION] field with your forum handle"
}

Write-Host ""
Write-Host "Done. Now go close some capital." -ForegroundColor Green
Write-Host ""
