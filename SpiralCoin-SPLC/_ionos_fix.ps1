# =============================================================================
#  IONOS deploy FIX  - corrects backslash-path bug, cleans up garbage,
#  redeploys with forward slashes, installs private/.htaccess.
# =============================================================================

[CmdletBinding()]
param(
    [string] $RemoteHost = 'access-5020476011.webspace-host.com',
    [string] $UserName   = 'a2797960',
    [int]    $Port       = 22
)

$ErrorActionPreference = 'Stop'
Import-Module Posh-SSH

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

# (Local, RemoteDir) - RemoteDir uses forward slashes only, hardcoded.
# Set-SFTPItem will append the local file's basename to RemoteDir.
$uploads = @(
    ,@('api\_auth0_verify.php',              '/api')
    ,@('api\wallet-nonce.php',               '/api')
    ,@('api\bind-wallet.php',                '/api')
    ,@('api\sponsor-webhook.php',            '/api')
    ,@('api\sponsors-list.php',              '/api')
    ,@('api\site-status.php',                '/api')
    ,@('assets\js\wallet-bind.js',           '/assets/js')
    ,@('funding\sponsors.html',              '/funding')
    ,@('index.html',                         '/')
    ,@('private\.htaccess',                  '/private')
    ,@('private\sponsor-webhook-secret.txt', '/private')
)

# Garbage directories to remove (literal backslash names from the bad run).
$garbageDirs = @('/\api', '/\private', '/\funding', '/\assets\js', '/\assets', '/\')

# Remote dirs we MUST have (forward slash).
$remoteDirs = @('/api', '/funding', '/private', '/assets', '/assets/js')

$secure = Read-Host -Prompt 'IONOS SFTP password' -AsSecureString
$cred   = New-Object System.Management.Automation.PSCredential ($UserName, $secure)
$s = New-SFTPSession -ComputerName $RemoteHost -Port $Port -Credential $cred -AcceptKey
Write-Host "[ok] Connected. Session #$($s.SessionId)" -ForegroundColor Green

# ---- 1. Clean up garbage dirs (delete contents then dir) -------------------
Write-Host "`n[cleanup] Removing literal-backslash directories..." -ForegroundColor Cyan
foreach ($g in $garbageDirs) {
    try {
        $kids = Get-SFTPChildItem -SessionId $s.SessionId -Path $g -ErrorAction SilentlyContinue
        foreach ($k in $kids) {
            try {
                Remove-SFTPItem -SessionId $s.SessionId -Path $k.FullName -Force -ErrorAction Stop
                Write-Host "  [del] $($k.FullName)" -ForegroundColor DarkGray
            } catch {
                Write-Host "  [skip] $($k.FullName) - $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
        Remove-SFTPItem -SessionId $s.SessionId -Path $g -Force -ErrorAction Stop
        Write-Host "  [rmdir] $g" -ForegroundColor DarkGray
    } catch {
        Write-Host "  [skip] $g - $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# ---- 2. Ensure proper remote dirs exist ------------------------------------
Write-Host "`n[mkdir] Ensuring forward-slash dirs..." -ForegroundColor Cyan
foreach ($d in $remoteDirs) {
    if (-not (Test-SFTPPath -SessionId $s.SessionId -Path $d)) {
        New-SFTPItem -SessionId $s.SessionId -Path $d -ItemType Directory | Out-Null
        Write-Host "  [created] $d" -ForegroundColor Green
    } else {
        Write-Host "  [exists]  $d" -ForegroundColor DarkGray
    }
}

# ---- 3. Upload via Set-SFTPItem (dest is forward-slash dir, hardcoded) -----
Write-Host "`n[upload] Pushing files..." -ForegroundColor Cyan
$ok = 0; $fail = 0
foreach ($u in $uploads) {
    $localFull = Join-Path $here $u[0]
    $remoteDir = $u[1]
    $expectedRemote = if ($remoteDir -eq '/') { '/' + (Split-Path $localFull -Leaf) } else { $remoteDir + '/' + (Split-Path $localFull -Leaf) }
    if (-not (Test-Path $localFull)) {
        Write-Host "  [miss] local file not found: $localFull" -ForegroundColor Red
        $fail++; continue
    }
    try {
        Set-SFTPItem -SessionId $s.SessionId -Path $localFull -Destination $remoteDir -Force
        $bytes = (Get-Item $localFull).Length
        Write-Host ("  [ok]   {0,7} bytes -> {1}" -f $bytes, $expectedRemote) -ForegroundColor Green
        $ok++
    } catch {
        Write-Host "  [fail] $expectedRemote : $($_.Exception.Message)" -ForegroundColor Red
        $fail++
    }
}

Remove-SFTPSession -SessionId $s.SessionId | Out-Null
$cred = $null; $secure.Dispose() 2>$null
[System.GC]::Collect()

Write-Host ""
Write-Host "Done. uploaded=$ok  failed=$fail" -ForegroundColor Cyan

# ---- 4. Verify -------------------------------------------------------------
Write-Host "`n[probe] Endpoint check..." -ForegroundColor Cyan
$apiFiles = 'site-status.php','sponsor-webhook.php','sponsors-list.php','wallet-nonce.php','bind-wallet.php'
foreach ($f in $apiFiles) {
    $r = & curl.exe -s -o NUL -w '%{http_code} %{content_type}' "https://www.spiralcoin.net/api/$f"
    "  {0,-22} {1}" -f $f, $r
}
$r2 = & curl.exe -s -o NUL -w '%{http_code} %{content_type}' "https://www.spiralcoin.net/private/sponsor-webhook-secret.txt"
"  {0,-22} {1}  (should be 403)" -f 'secret-file', $r2
