# ============================================================================
#  upload-do.ps1
#  Sync SpiralCoin static + PHP files to DigitalOcean droplet over SFTP
#  Uses WinSCP CLI (winscp.com) — assumes SSH key auth (or saved session)
# ============================================================================
[CmdletBinding()]
param(
    [string]$DropletHost = '174.138.37.6',
    [string]$DropletUser = 'root',
    [string]$RemoteRoot  = '/var/www/spiralcoin',
    [string]$WinScp      = "$env:LOCALAPPDATA\Programs\WinSCP\WinSCP.com",
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$LocalRoot = Split-Path -Parent $PSScriptRoot   # workspace root
Set-Location $LocalRoot

if (-not (Test-Path $WinScp)) { throw "WinSCP CLI not found at $WinScp" }

# Items to push (relative to workspace root). Keep this list explicit
# so we never leak .env / .git / contracts / private files.
$Include = @(
    # ---- top-level pages ----
    'index.html','account.html','analytics.html','charts.html','community.html',
    'crypto.html','dashboard.html','documents.html','markets.html','news.html',
    'portfolio.html','pricing.html','settings.html','signup.html','splc.html',
    'stocks-coming-soon.html','taxes.html','trade-confirm.html','trade.html',
    'watchlist.html','404.html','spiralcoin_ads_landing.html',
    'spiralcoin_oneliner.html','spiralcoin_platform_embed.html',
    'spiralcoin_trading_platform.html',
    'robots.txt','sitemap.xml','CNAME','.htaccess',
    # ---- directories ----
    'assets','app','api','indexer','SPLC'
)

# Explicit excludes (paths within $Include dirs we must NEVER ship)
$Exclude = @(
    '*.env','*.env.*','*.bak','*.bak-*','*.log','*.sql','*.md','*.bat','*.ps1',
    '*.example.js','live-config.example.js',
    '.git','.gitignore','.gitkeep','node_modules','__pycache__','.DS_Store',
    'package-lock.json','yarn.lock'
)

# Build WinSCP script
$tmp = New-TemporaryFile
$script = @()
$script += "option batch abort"
$script += "option confirm off"
$script += "option transfer binary"
$script += "option exclude `"$($Exclude -join ';')`""
$script += "open sftp://${DropletUser}@${DropletHost}/ -hostkey=*"
$script += "cd $RemoteRoot"
$script += "lcd `"$LocalRoot`""

foreach ($item in $Include) {
    $local = Join-Path $LocalRoot $item
    if (-not (Test-Path $local)) {
        Write-Host "  skip (missing): $item" -ForegroundColor DarkYellow
        continue
    }
    if (Test-Path $local -PathType Container) {
        # mkdir + synchronize directory
        $script += "call mkdir -p $RemoteRoot/$item"
        $script += "synchronize remote `"$local`" `"$RemoteRoot/$item`""
    } else {
        $script += "put `"$local`" `"$RemoteRoot/$item`""
    }
}

$script += "call chown -R www-data:www-data $RemoteRoot"
$script += "exit"

Set-Content -Path $tmp -Value $script -Encoding ASCII
Write-Host "WinSCP script:" -ForegroundColor Cyan
Get-Content $tmp | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }

if ($DryRun) {
    Write-Host "`n(DryRun) — not executing." -ForegroundColor Yellow
    Remove-Item $tmp
    exit 0
}

Write-Host "`nLaunching WinSCP…" -ForegroundColor Cyan
& $WinScp /ini=nul /script=$tmp
$code = $LASTEXITCODE
Remove-Item $tmp

if ($code -ne 0) { Write-Host "WinSCP exited with code $code" -ForegroundColor Red; exit $code }
Write-Host "`n✓ Sync complete. Visit: http://$DropletHost/  (then add HTTPS via certbot)" -ForegroundColor Green
