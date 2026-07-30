#requires -Version 5.1
<#
.SYNOPSIS
  One-off uploader for /api/.env (the only file that bypasses the *.env exclude
  rule in the main upload script).
.DESCRIPTION
  - Prompts for the IONOS SFTP password if $env:IONOS_SFTP_PASSWORD is unset.
  - Uploads only api/.env to /api/.env with chmod 600.
  - Apache denies direct HTTP access via the FilesMatch rule in .htaccess.
.EXAMPLE
  .\deploy\upload-env.ps1
#>
[CmdletBinding()]
param(
  [string]$SftpHost   = 'access-5020476011.webspace-host.com',
  [string]$SftpUser   = 'a2797960',
  [string]$RemoteDir  = '/api',
  [string]$WinScp     = "$env:LOCALAPPDATA\Programs\WinSCP\WinSCP.com"
)

$ErrorActionPreference = 'Stop'

$repo    = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repo 'api\.env'

if (-not (Test-Path $envFile)) {
  throw "api\.env not found at $envFile. Create it first."
}
if (-not (Test-Path $WinScp)) {
  throw "WinSCP CLI not found at $WinScp"
}

# -- creds (same pattern as upload-ionos.ps1) --
$plainPw = $env:IONOS_SFTP_PASSWORD
if (-not $plainPw) {
  $sec = Read-Host -Prompt "IONOS SFTP password for $SftpUser@$SftpHost" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { $plainPw = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
if (-not $plainPw) { throw "No password supplied." }

Add-Type -AssemblyName System.Web
$encPw   = [System.Web.HttpUtility]::UrlEncode($plainPw)
$openUrl = "sftp://${SftpUser}:${encPw}@${SftpHost}/ -hostkey=* -timeout=20"

$script = @"
option batch abort
option confirm off
open $openUrl
cd $RemoteDir
put -nopreservetime "$envFile" .env
chmod 600 .env
exit
"@

$tmp = New-TemporaryFile
Set-Content -Path $tmp -Value $script -Encoding ASCII

try {
  & $WinScp /ini=nul /script=$tmp
  $code = $LASTEXITCODE
  if ($code -eq 0) {
    Write-Host ""
    Write-Host "Uploaded api/.env to ${RemoteDir}/.env (chmod 600)" -ForegroundColor Green
    Write-Host "Apache denies HTTP access via FilesMatch in .htaccess." -ForegroundColor Cyan
  } else {
    Write-Host "WinSCP exited with code $code" -ForegroundColor Red
    exit $code
  }
} finally {
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}
