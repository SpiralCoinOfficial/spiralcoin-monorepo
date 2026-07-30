[CmdletBinding()]
param(
    [string] $RemoteHost = 'access-5020476011.webspace-host.com',
    [string] $UserName   = 'a2797960',
    [int]    $Port       = 22
)

$ErrorActionPreference = 'Stop'
Import-Module Posh-SSH

$secure = Read-Host -Prompt 'IONOS SFTP password' -AsSecureString
$cred   = New-Object System.Management.Automation.PSCredential ($UserName, $secure)
$s = New-SFTPSession -ComputerName $RemoteHost -Port $Port -Credential $cred -AcceptKey

Write-Host '--- Home directory (/) ---' -ForegroundColor Cyan
Get-SFTPChildItem -SessionId $s.SessionId -Path '/' | Select-Object FullName,Length | Format-Table -AutoSize

Write-Host '--- /api ---' -ForegroundColor Cyan
try { Get-SFTPChildItem -SessionId $s.SessionId -Path '/api' | Select-Object FullName,Length | Format-Table -AutoSize } catch { Write-Host "(no /api)" -ForegroundColor Red }

Write-Host '--- /private ---' -ForegroundColor Cyan
try { Get-SFTPChildItem -SessionId $s.SessionId -Path '/private' | Select-Object FullName,Length | Format-Table -AutoSize } catch { Write-Host "(no /private)" -ForegroundColor Red }

Write-Host '--- /funding ---' -ForegroundColor Cyan
try { Get-SFTPChildItem -SessionId $s.SessionId -Path '/funding' | Select-Object FullName,Length | Format-Table -AutoSize } catch { Write-Host "(no /funding)" -ForegroundColor Red }

# Check for literal-backslash garbage dirs
Write-Host '--- Looking for literal backslash dirs ---' -ForegroundColor Cyan
$items = Get-SFTPChildItem -SessionId $s.SessionId -Path '/'
$bad = $items | Where-Object { $_.Name -match '\\' }
if ($bad) {
    Write-Host '[FOUND] Literal-backslash dirs:' -ForegroundColor Red
    $bad | Select-Object FullName,Length | Format-Table -AutoSize
} else {
    Write-Host '[ok] No literal backslash dirs.' -ForegroundColor Green
}

Remove-SFTPSession -SessionId $s.SessionId | Out-Null
$cred=$null; $secure.Dispose() 2>$null
