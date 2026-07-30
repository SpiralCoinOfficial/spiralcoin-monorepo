$paths = @(
  "$env:USERPROFILE\Documents",
  "$env:USERPROFILE\Downloads",
  "$env:USERPROFILE\Videos",
  "$env:USERPROFILE\Pictures",
  "$env:USERPROFILE\Desktop",
  "$env:USERPROFILE\OneDrive",
  "$env:LOCALAPPDATA",
  "$env:APPDATA",
  "$env:USERPROFILE\.vscode",
  "$env:USERPROFILE\node_modules",
  "$env:USERPROFILE\.android",
  "$env:USERPROFILE\.aitk",
  "$env:USERPROFILE\.gradle",
  "$env:USERPROFILE\.cache",
  "C:\Windows.old",
  "C:\Windows\SoftwareDistribution\Download",
  "C:\Windows\Installer",
  "C:\hiberfil.sys",
  "C:\pagefile.sys",
  "C:\swapfile.sys"
)
$results = @()
foreach ($p in $paths) {
  if (Test-Path -LiteralPath $p) {
    try {
      $sum = (Get-ChildItem -LiteralPath $p -File -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    } catch { $sum = 0 }
    if ($null -eq $sum) { $sum = 0 }
    $results += [PSCustomObject]@{ GB = [math]::Round($sum/1GB,2); Path = $p }
  }
}
$results | Sort-Object GB -Descending | Format-Table -AutoSize
