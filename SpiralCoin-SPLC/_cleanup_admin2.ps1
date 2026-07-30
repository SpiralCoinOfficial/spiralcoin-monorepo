# Run as administrator — second pass cleanup targeting the real bloat
$ErrorActionPreference = 'Continue'
function Free { [math]::Round((Get-PSDrive C).Free / 1MB, 0) }
$start = Free
Write-Host "=== Disk free at start: $start MB ===" -ForegroundColor Cyan

Write-Host "`n--- Largest top-level dirs on C:\ ---" -ForegroundColor Cyan
Get-ChildItem C:\ -Directory -Force -EA SilentlyContinue | ForEach-Object {
  $n = $_.FullName
  $s = (Get-ChildItem $n -Recurse -Force -File -EA SilentlyContinue | Measure-Object Length -Sum).Sum
  [PSCustomObject]@{ GB = [math]::Round($s/1GB,2); Path = $n }
} | Sort-Object GB -Descending | Select-Object -First 10 | Format-Table -AutoSize

Write-Host "--- System files in C:\ root ---" -ForegroundColor Cyan
Get-ChildItem C:\ -Force -File -EA SilentlyContinue |
  Where-Object { $_.Length -gt 500MB } |
  Select-Object Name, @{N='GB';E={[math]::Round($_.Length/1GB,2)}} |
  Format-Table -AutoSize

Write-Host "`n=== 1/5 Disabling hibernation (frees hiberfil.sys, often 8-16 GB) ===" -ForegroundColor Cyan
powercfg /h off

Write-Host "`n=== 2/5 Windows Update component cleanup (DISM) ===" -ForegroundColor Cyan
DISM.exe /Online /Cleanup-Image /StartComponentCleanup /ResetBase

Write-Host "`n=== 3/5 Clearing Windows.old + SoftwareDistribution caches ===" -ForegroundColor Cyan
Stop-Service wuauserv -Force -EA SilentlyContinue
Remove-Item 'C:\Windows.old' -Recurse -Force -EA SilentlyContinue
Remove-Item 'C:\Windows\SoftwareDistribution\Download\*' -Recurse -Force -EA SilentlyContinue
Start-Service wuauserv -EA SilentlyContinue

Write-Host "`n=== 4/5 Clearing system temp + delivery optimization ===" -ForegroundColor Cyan
Remove-Item 'C:\Windows\Temp\*' -Recurse -Force -EA SilentlyContinue
Remove-Item 'C:\ProgramData\Microsoft\Windows\DeliveryOptimization\Cache\*' -Recurse -Force -EA SilentlyContinue

Write-Host "`n=== 5/5 Running Disk Cleanup (sagerun:99) ===" -ForegroundColor Cyan
# Enable common cleanup items under sageset 99 in registry
$keys = @(
  'Active Setup Temp Folders','BranchCache','Downloaded Program Files','Internet Cache Files',
  'Memory Dump Files','Old ChkDsk Files','Previous Installations','Recycle Bin',
  'Service Pack Cleanup','Setup Log Files','System error memory dump files',
  'System error minidump files','Temporary Files','Temporary Setup Files',
  'Temporary Sync Files','Thumbnail Cache','Update Cleanup','Upgrade Discarded Files',
  'User file versions','Windows Defender','Windows Error Reporting Files',
  'Windows ESD installation files','Windows Upgrade Log Files'
)
$base = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VolumeCaches'
foreach ($k in $keys) {
  $p = Join-Path $base $k
  if (Test-Path $p) { Set-ItemProperty -Path $p -Name StateFlags0099 -Value 2 -Type DWord -EA SilentlyContinue }
}
Start-Process -FilePath cleanmgr.exe -ArgumentList '/sagerun:99' -Wait

$end = Free
Write-Host ("`n=== Disk free at end: $end MB  (delta: {0:+#;-#;0} MB) ===" -f ($end - $start)) -ForegroundColor Green
Read-Host "`nDone. Press Enter to close"
