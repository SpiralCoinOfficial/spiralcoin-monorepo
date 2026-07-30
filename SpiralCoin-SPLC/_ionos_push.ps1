# =============================================================================
#  SpiralCoin -> IONOS one-shot SFTP push  (Posh-SSH, pure PowerShell)
# -----------------------------------------------------------------------------
#  Usage:   .\_ionos_push.ps1
#  - Prompts ONCE for the IONOS SFTP password (Read-Host -AsSecureString).
#  - Password is held only as a SecureString + brief plaintext span in this
#    process; it is never written to disk, never logged, never sent over chat.
#  - Uploads all changed/new files, creates remote dirs as needed, chmods
#    the secret file to 600, then disconnects.
# =============================================================================

[CmdletBinding()]
param(
    [string] $RemoteHost = 'access-5020476011.webspace-host.com',
    [string] $UserName   = 'a2797960',
    [int]    $Port       = 22
)

$ErrorActionPreference = 'Stop'

# ---- Ensure Posh-SSH is installed -------------------------------------------
if (-not (Get-Module -ListAvailable -Name Posh-SSH)) {
    Write-Host '[setup] Installing Posh-SSH (one-time, current user)...' -ForegroundColor Cyan
    if (-not (Get-PackageProvider -Name NuGet -ErrorAction SilentlyContinue)) {
        Install-PackageProvider -Name NuGet -Force -Scope CurrentUser | Out-Null
    }
    Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue
    Install-Module -Name Posh-SSH -Scope CurrentUser -Force -AllowClobber
}
Import-Module Posh-SSH

# ---- Files to push ----------------------------------------------------------
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

# (localPath, remotePath, remoteMode-or-$null)
$uploads = @(
    @{ Local='api\_auth0_verify.php';                 Remote='/api/_auth0_verify.php';                Mode=$null },
    @{ Local='api\wallet-nonce.php';                  Remote='/api/wallet-nonce.php';                 Mode=$null },
    @{ Local='api\bind-wallet.php';                   Remote='/api/bind-wallet.php';                  Mode=$null },
    @{ Local='api\sponsor-webhook.php';               Remote='/api/sponsor-webhook.php';              Mode=$null },
    @{ Local='api\sponsors-list.php';                 Remote='/api/sponsors-list.php';                Mode=$null },
    @{ Local='api\site-status.php';                   Remote='/api/site-status.php';                  Mode=$null },
    @{ Local='assets\js\wallet-bind.js';              Remote='/assets/js/wallet-bind.js';             Mode=$null },
    @{ Local='funding\sponsors.html';                 Remote='/funding/sponsors.html';                Mode=$null },
    @{ Local='index.html';                            Remote='/index.html';                           Mode=$null },
    @{ Local='private\sponsor-webhook-secret.txt';    Remote='/private/sponsor-webhook-secret.txt';   Mode=600 }
)

# ---- Validate locals --------------------------------------------------------
$missing = $uploads | Where-Object { -not (Test-Path (Join-Path $here $_.Local)) }
if ($missing) {
    Write-Host "[error] Missing local files:" -ForegroundColor Red
    $missing | ForEach-Object { "   $($_.Local)" }
    exit 1
}

# ---- Credentials (LOCAL ONLY - never echoed, never logged) ------------------
Write-Host ''
Write-Host "Connecting to $UserName@${RemoteHost}:$Port" -ForegroundColor Cyan
$secure = Read-Host -Prompt 'IONOS SFTP password' -AsSecureString
$cred   = New-Object System.Management.Automation.PSCredential ($UserName, $secure)

# ---- Connect ----------------------------------------------------------------
$session = New-SFTPSession -ComputerName $RemoteHost -Port $Port -Credential $cred `
                           -AcceptKey -ConnectionTimeout 30 -ErrorAction Stop
Write-Host "[ok] Connected. Session #$($session.SessionId)" -ForegroundColor Green

# ---- Ensure remote dirs -----------------------------------------------------
$dirs = $uploads | ForEach-Object { Split-Path $_.Remote -Parent } | Sort-Object -Unique
foreach ($d in $dirs) {
    if (-not (Test-SFTPPath -SessionId $session.SessionId -Path $d)) {
        Write-Host "[mkdir] $d" -ForegroundColor Yellow
        New-SFTPItem -SessionId $session.SessionId -Path $d -ItemType Directory | Out-Null
    }
}

# ---- Upload -----------------------------------------------------------------
$ok = 0; $fail = 0
foreach ($u in $uploads) {
    $localFull = Join-Path $here $u.Local
    $remoteDir = Split-Path $u.Remote -Parent
    try {
        Set-SFTPItem -SessionId $session.SessionId -Path $localFull -Destination $remoteDir -Force
        $bytes = (Get-Item $localFull).Length
        Write-Host ("[ok] {0,-10} bytes -> {1}" -f $bytes, $u.Remote) -ForegroundColor Green
        if ($null -ne $u.Mode) {
            # Set permissions on the remote file
            Set-SFTPPathAttribute -SessionId $session.SessionId -Path $u.Remote `
                                  -FileMode $u.Mode -ErrorAction SilentlyContinue
        }
        $ok++
    } catch {
        Write-Host "[fail] $($u.Remote): $($_.Exception.Message)" -ForegroundColor Red
        $fail++
    }
}

# ---- Disconnect -------------------------------------------------------------
Remove-SFTPSession -SessionId $session.SessionId | Out-Null

# ---- Wipe in-memory secrets -------------------------------------------------
$cred   = $null
$secure.Dispose() 2>$null
[System.GC]::Collect()

Write-Host ''
Write-Host "Done. uploaded=$ok  failed=$fail" -ForegroundColor Cyan
if ($fail -gt 0) { exit 2 }

# ---- Verify -----------------------------------------------------------------
Write-Host ''
Write-Host 'Probing endpoints...' -ForegroundColor Cyan
@('site-status.php','sponsor-webhook.php','sponsors-list.php','wallet-nonce.php','bind-wallet.php') |
    ForEach-Object {
        $r = & curl.exe -s -o NUL -w '%{http_code} %{content_type}' "https://www.spiralcoin.net/api/$_"
        "  {0,-22} {1}" -f $_, $r
    }
