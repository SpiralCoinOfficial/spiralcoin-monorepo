#requires -Version 5.1
<#
.SYNOPSIS
  Deploy the SpiralCoin static site to IONOS Web Hosting via SFTP (WinSCP CLI).

.DESCRIPTION
  - Prompts for the IONOS SFTP password securely (no plaintext on disk).
  - Optional -Recon mode: just connects and lists the remote root so we can see
    the layout (some IONOS plans have a per-domain subfolder; others land you
    directly in the document root).
  - Otherwise: syncs the curated list of static files + folders to RemoteRoot.

.EXAMPLE
  .\deploy\upload-ionos.ps1 -Recon
  .\deploy\upload-ionos.ps1 -RemoteRoot /
  .\deploy\upload-ionos.ps1 -RemoteRoot /spiralcoin.net -DryRun
#>
[CmdletBinding()]
param(
  [string]$SftpHost   = 'access-5020476011.webspace-host.com',
  [string]$SftpUser   = 'a2797960',
  [string]$RemoteRoot = '/',
  [string]$LocalRoot  = '',
  [string]$WinScp     = "$env:LOCALAPPDATA\Programs\WinSCP\WinSCP.com",
  [switch]$Recon,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

if (-not $LocalRoot) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $LocalRoot = Split-Path -Parent $scriptDir
}

if (-not (Test-Path $WinScp)) { throw "WinSCP CLI not found at $WinScp" }
if (-not (Test-Path $LocalRoot)) { throw "LocalRoot not found: $LocalRoot" }

# -- creds --
# Prefer env var IONOS_SFTP_PASSWORD (set once in your terminal); fall back to prompt.
$plainPw = $env:IONOS_SFTP_PASSWORD
if (-not $plainPw) {
  $sec = Read-Host -Prompt "IONOS SFTP password for $SftpUser@$SftpHost" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { $plainPw = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
if (-not $plainPw) { throw "No password supplied (set `$env:IONOS_SFTP_PASSWORD or enter at prompt)." }

# URL-encode password for the WinSCP `open` URL
Add-Type -AssemblyName System.Web
$encPw = [System.Web.HttpUtility]::UrlEncode($plainPw)
$openCmd = "open sftp://${SftpUser}:${encPw}@${SftpHost}/ -hostkey=* -timeout=20"

# -- include / exclude lists --
$includeFiles = @(
  'index.html','account.html','analytics.html','charts.html','community.html',
  'crypto.html','dashboard.html','documents.html','markets.html','news.html',
  'portfolio.html','pricing.html','settings.html','signup.html','splc.html',
  'stocks-coming-soon.html','taxes.html','trade-confirm.html','trade.html',
  'watchlist.html','404.html','regd.html',
  'spiralcoin_ads_landing.html','spiralcoin_oneliner.html',
  'spiralcoin_platform_embed.html','spiralcoin_trading_platform.html',
  'manifest.webmanifest','sw.js',
  'robots.txt','sitemap.xml','CNAME','.htaccess'
)
$includeDirs = @('assets','app','api','indexer','SPLC','brand','funding')

# WinSCP -filemask exclusion (semicolon-separated)
$excludeMask = '| *.env; *.env.*; *.bak; *.bak-*; *.log; *.sql; *.md; *.bat; *.ps1; ' +
               '*.example.js; live-config.example.js; .git/; .gitignore; .gitkeep; ' +
               'node_modules/; __pycache__/; .DS_Store; package-lock.json; yarn.lock'

# -- build script --
$tmp = New-TemporaryFile
try {
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine('option batch abort')
  [void]$sb.AppendLine('option confirm off')
  [void]$sb.AppendLine($openCmd)
  [void]$sb.AppendLine('pwd')
  [void]$sb.AppendLine('ls')

  if ($Recon) {
    Write-Host "RECON MODE -- only listing remote root, not uploading." -ForegroundColor Cyan
  } else {
    $remote = if ($RemoteRoot.EndsWith('/')) { $RemoteRoot } else { "$RemoteRoot/" }
    $local  = (Resolve-Path $LocalRoot).Path -replace '\\','/'
    if (-not $local.EndsWith('/')) { $local += '/' }

    # Anchor both sides so plain relative names work
    [void]$sb.AppendLine("lcd `"$local`"")
    [void]$sb.AppendLine("cd `"$remote`"")

    # Files (relative names; lcd/cd handle the rest)
    foreach ($f in $includeFiles) {
      $lp = Join-Path $LocalRoot $f
      if (Test-Path $lp -PathType Leaf) {
        if ($DryRun) {
          [void]$sb.AppendLine("# would put $f")
        } else {
          [void]$sb.AppendLine("put -nopreservetime `"$f`" `"./$f`"")
        }
      } else {
        [void]$sb.AppendLine("# skip missing $f")
      }
    }

    # Dirs - use absolute paths for synchronize (it's more reliable)
    foreach ($d in $includeDirs) {
      $lp = Join-Path $LocalRoot $d
      if (Test-Path $lp -PathType Container) {
        $absLocal  = "$local$d"
        $absRemote = "$remote$d"
        if ($DryRun) {
          [void]$sb.AppendLine("synchronize remote -preview -filemask=`"$excludeMask`" `"$absLocal`" `"$absRemote`"")
        } else {
          # synchronize creates any missing subdirs under the target. The four
          # top-level dirs (assets, app, api, indexer, SPLC) already exist on
          # IONOS, so we skip the cosmetic mkdir noise. If you ever deploy to a
          # fresh host where these don't exist, uncomment the mkdir block below.
          # [void]$sb.AppendLine('option batch continue')
          # [void]$sb.AppendLine("mkdir `"$absRemote`"")
          # [void]$sb.AppendLine('option batch abort')
          [void]$sb.AppendLine("synchronize remote -filemask=`"$excludeMask`" `"$absLocal`" `"$absRemote`"")
        }
      } else {
        [void]$sb.AppendLine("# skip missing dir $d")
      }
    }
  }

  [void]$sb.AppendLine('exit')
  Set-Content -Path $tmp -Value $sb.ToString() -Encoding ASCII

  Write-Host "Running WinSCP..." -ForegroundColor Yellow
  & $WinScp /ini=nul /log="$LocalRoot\deploy\winscp.log" /loglevel=1 /script="$tmp"
  $code = $LASTEXITCODE
  Write-Host "WinSCP exit code: $code"
  if ($code -ne 0) { throw "WinSCP failed (exit $code). See deploy\winscp.log" }
}
finally {
  Remove-Item $tmp -ErrorAction SilentlyContinue
  $plainPw = $null; $encPw = $null
  [System.GC]::Collect()
}

Write-Host "DONE." -ForegroundColor Green
