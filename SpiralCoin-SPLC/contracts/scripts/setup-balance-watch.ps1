# setup-balance-watch.ps1
#
# Registers a Windows Scheduled Task that runs check-balance.js every 15
# minutes and appends to contracts/balance-alerts.log.
#
# Run as your normal user (no admin required for per-user tasks):
#   powershell -ExecutionPolicy Bypass -File scripts/setup-balance-watch.ps1
#
# To remove later:
#   Unregister-ScheduledTask -TaskName "SpiralCoinDeployerBalanceWatch" -Confirm:$false

$ErrorActionPreference = 'Stop'
$here       = Split-Path -Parent $MyInvocation.MyCommand.Path
$contracts  = Split-Path -Parent $here
$node       = (Get-Command node).Source
$script     = Join-Path $here 'check-balance.js'
$logFile    = Join-Path $contracts 'balance-watch.log'
$taskName   = 'SpiralCoinDeployerBalanceWatch'

if (-not (Test-Path $script)) {
    throw "check-balance.js not found at $script"
}

$action = New-ScheduledTaskAction `
    -Execute $node `
    -Argument "`"$script`"" `
    -WorkingDirectory $contracts

# Run every 15 minutes, indefinitely, starting 1 minute from now.
$trigger = New-ScheduledTaskTrigger `
    -Once -At ((Get-Date).AddMinutes(1)) `
    -RepetitionInterval (New-TimeSpan -Minutes 15)

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Write-Host "Task '$taskName' already exists — replacing." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

Register-ScheduledTask `
    -TaskName $taskName `
    -Description 'SpiralCoin deployer ETH balance watchdog (Sepolia + Arb Sepolia)' `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings | Out-Null

Write-Host ""
Write-Host "✓ Scheduled task '$taskName' registered." -ForegroundColor Green
Write-Host "  Runs every 15 minutes."
Write-Host "  Alerts appended to: $contracts\balance-alerts.log"
Write-Host ""
Write-Host "Inspect with:    Get-ScheduledTask -TaskName $taskName | Get-ScheduledTaskInfo"
Write-Host "Run on-demand:   Start-ScheduledTask -TaskName $taskName"
Write-Host "Remove with:     Unregister-ScheduledTask -TaskName $taskName -Confirm:`$false"
