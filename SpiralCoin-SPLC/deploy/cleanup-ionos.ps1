#requires -Version 5.1
<#
.SYNOPSIS
  Remove sensitive/development folders from the IONOS web server.

.DESCRIPTION
  Deletes recursively:
    - .git/      (full git history, includes any committed secrets)
    - .github/   (workflow files)
    - contracts/ (Hardhat project; may contain .env with private keys!)
    - alchemy-demo/, w3a-quick-start/
  Also deletes file:
    - .gitignore
  Keeps:
    - .htaccess (Apache config — needed)
    - All HTML pages, assets/, app/, api/, indexer/, SPLC/

  Uses IONOS_SFTP_PASSWORD env var (same as upload-ionos.ps1).
#>
[CmdletBinding()]
param(
  [string]$SftpHost   = 'access-5020476011.webspace-host.com',
  [string]$SftpUser   = 'a2797960',
  [string]$WinScp     = "$env:LOCALAPPDATA\Programs\WinSCP\WinSCP.com",
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $WinScp)) { throw "WinSCP CLI not found at $WinScp" }

$plainPw = $env:IONOS_SFTP_PASSWORD
if (-not $plainPw) { throw "Set `$env:IONOS_SFTP_PASSWORD first." }

Add-Type -AssemblyName System.Web
$encPw = [System.Web.HttpUtility]::UrlEncode($plainPw)
$openCmd = "open sftp://${SftpUser}:${encPw}@${SftpHost}/ -hostkey=* -timeout=20"

# Targets
$dirsToDelete = @('.git','.github','contracts','alchemy-demo','w3a-quick-start')
$filesToDelete = @('.gitignore')

$tmp = New-TemporaryFile
try {
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine('option batch continue')   # tolerate "not found"
  [void]$sb.AppendLine('option confirm off')
  [void]$sb.AppendLine($openCmd)
  [void]$sb.AppendLine('cd /')
  [void]$sb.AppendLine('ls')

  foreach ($d in $dirsToDelete) {
    if ($DryRun) {
      [void]$sb.AppendLine("# would rm -rf /$d")
    } else {
      [void]$sb.AppendLine("rm `"/$d`"")
    }
  }
  foreach ($f in $filesToDelete) {
    if ($DryRun) {
      [void]$sb.AppendLine("# would rm /$f")
    } else {
      [void]$sb.AppendLine("rm `"/$f`"")
    }
  }

  [void]$sb.AppendLine('ls')
  [void]$sb.AppendLine('exit')

  Set-Content -Path $tmp -Value $sb.ToString() -Encoding ASCII

  Write-Host "Running cleanup..." -ForegroundColor Yellow
  & $WinScp /ini=nul /log="$PSScriptRoot\winscp-cleanup.log" /loglevel=1 /script="$tmp"
  $code = $LASTEXITCODE
  Write-Host "WinSCP exit code: $code"
}
finally {
  Remove-Item $tmp -ErrorAction SilentlyContinue
  $plainPw = $null; $encPw = $null
  [System.GC]::Collect()
}

Write-Host "DONE." -ForegroundColor Green
