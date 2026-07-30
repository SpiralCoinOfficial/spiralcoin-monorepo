# Run as administrator
Write-Host "=== Disk free before ===" -ForegroundColor Cyan
Get-PSDrive C | Select-Object @{n='FreeGB';e={[math]::Round($_.Free/1GB,2)}} | Format-Table

Write-Host "`n=== 1/3 Deleting System Restore shadow copies ===" -ForegroundColor Cyan
vssadmin delete shadows /all /quiet

Write-Host "`n=== 2/3 Setting pagefile to 2048 MB (effective after reboot) ===" -ForegroundColor Cyan
$cs = Get-CimInstance -ClassName Win32_ComputerSystem
if ($cs.AutomaticManagedPagefile) {
  Set-CimInstance -InputObject $cs -Property @{ AutomaticManagedPagefile = $false }
  Write-Host "Disabled automatic pagefile management"
}
$pf = Get-CimInstance -ClassName Win32_PageFileSetting -ErrorAction SilentlyContinue
if ($pf) {
  Set-CimInstance -InputObject $pf -Property @{ InitialSize = 2048; MaximumSize = 2048 }
  Write-Host "Pagefile resized to 2048 MB (reboot to apply)"
} else {
  New-CimInstance -ClassName Win32_PageFileSetting -Property @{ Name = 'C:\pagefile.sys'; InitialSize = 2048; MaximumSize = 2048 } | Out-Null
  Write-Host "Pagefile created at 2048 MB"
}

Write-Host "`n=== 3/3 Uninstalling Perplexity ===" -ForegroundColor Cyan
$perp = Get-ChildItem -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall","HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall","HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" -ErrorAction SilentlyContinue |
  ForEach-Object { Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue } |
  Where-Object { $_.DisplayName -like "*Perplexity*" }
foreach ($p in $perp) {
  Write-Host "Found: $($p.DisplayName) @ $($p.UninstallString)"
  $u = $p.QuietUninstallString
  if (-not $u) { $u = $p.UninstallString }
  if ($u) {
    $exe = $null; $uargs =    ''
    if ($u -match '^"([^"] *(.*)$') {
      $exe = $matches[1]; $uargs = $matches[2]
    } elseif ($u -match '^(\S+)\s*(.*)$') {
      $exe = $matches[1]; $uargs = $matches[2]
    }
    if ($uargs -notmatch '/S|/silent|/quiet') { $uargs = "$uargs /S".Trim() }
    Write-Host "Running: $exe $uargs"
    if ($exe) { Start-Process -FilePath $exe -ArgumentList $uargs -Wait -ErrorAction SilentlyContinue }
  }
}

Write-Host "`n=== Disk free after ===" -ForegroundColor Cyan
Get-PSDrive C | Select-Object @{n='FreeGB';e={[math]::Round($_.Free/1GB,2)}} | Format-Table
Write-Host "`nDone. Reboot recommended to fully reclaim pagefile space." -ForegroundColor Green
Read-Host "Press Enter to close"
