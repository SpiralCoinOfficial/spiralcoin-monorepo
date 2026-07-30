$winscp = "$env:LOCALAPPDATA\Programs\WinSCP\WinSCP.com"
$tmp = New-TemporaryFile
$user = "a2797960"
$host_ = "access-5020476011.webspace-host.com"
if (-not $env:IONOS_SFTP_PASSWORD) { Write-Host "ERROR: `$env:IONOS_SFTP_PASSWORD not set in this terminal." -ForegroundColor Red; exit 1 }
Add-Type -AssemblyName System.Web
$encPw = [System.Web.HttpUtility]::UrlEncode($env:IONOS_SFTP_PASSWORD)
@"
option batch abort
open sftp://${user}:${encPw}@${host_}/ -hostkey=*
ls /
exit
"@ | Set-Content -Path $tmp -Encoding ASCII
& $winscp /ini=nul /script=$tmp | Where-Object { $_ -match '\.htaccess|\.git|contracts|alchemy|w3a|^Active|^Error|^WARN' }
Remove-Item $tmp
