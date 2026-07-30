<#
.SYNOPSIS
  Run a WinSCP SFTP script template, injecting the password from $env:IONOS_SFTP_PASSWORD.

.DESCRIPTION
  Templates live at the repo root as `_sftp_*.txt` and use the literal token `%PWD%`
  in their `open sftp://USER:%PWD%@HOST/` line. This wrapper:
    1. Reads $env:IONOS_SFTP_PASSWORD (prompts SecureString if missing).
    2. URL-encodes the password.
    3. Writes a temp script with the substitution.
    4. Invokes WinSCP CLI.
    5. Always deletes the temp script (even on failure).

.EXAMPLE
  $env:IONOS_SFTP_PASSWORD = 'your-password'
  .\deploy\run-sftp.ps1 -Script _sftp_full_deploy.txt
  .\deploy\run-sftp.ps1 -Script _sftp_ads_deploy.txt -LogPath _sftp_ads_log.txt
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [string]$Script,
  [string]$LogPath,
  [string]$WinScp = "$env:LOCALAPPDATA\Programs\WinSCP\WinSCP.com"
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $WinScp)) {
  $alt = 'C:\Program Files (x86)\WinSCP\WinSCP.com'
  if (Test-Path $alt) { $WinScp = $alt } else { throw "WinSCP CLI not found. Install from https://winscp.net/" }
}
if (-not (Test-Path $Script)) { throw "Script template not found: $Script" }

$plainPw = $env:IONOS_SFTP_PASSWORD
if (-not $plainPw) {
  $sec = Read-Host -Prompt "IONOS SFTP password" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { $plainPw = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
if (-not $plainPw) { throw "No password supplied." }

Add-Type -AssemblyName System.Web
$encPw = [System.Web.HttpUtility]::UrlEncode($plainPw)

$tpl = Get-Content $Script -Raw
if ($tpl -notmatch '%PWD%') { throw "Template $Script does not contain %PWD% -- refusing to run (may be unsanitized)." }
$resolved = $tpl -replace '%PWD%', $encPw

$tmp = New-TemporaryFile
try {
  Set-Content -Path $tmp.FullName -Value $resolved -NoNewline -Encoding ASCII
  $cliArgs = @("/script=$($tmp.FullName)", '/parameter')
  if ($LogPath) { $cliArgs += "/log=$LogPath" }
  & $WinScp @cliArgs
  $code = $LASTEXITCODE
  if ($code -ne 0) { Write-Warning "WinSCP exited with code $code" }
  exit $code
}
finally {
  if (Test-Path $tmp.FullName) { Remove-Item -Force $tmp.FullName }
  $plainPw = $null; $encPw = $null; $resolved = $null
  [GC]::Collect()
}
