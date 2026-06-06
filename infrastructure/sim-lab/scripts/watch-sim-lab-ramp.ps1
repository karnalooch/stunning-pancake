#Requires -Version 5.1
<#
.SYNOPSIS
  Wait for sim-lab live ramp to reach target ACTIVE without stopping sim or redeploying workers.

.EXAMPLE
  $env:ADMIN_PASS = 'admin123'
  .\infrastructure\sim-lab\scripts\watch-sim-lab-ramp.ps1 -TargetActive 50000
#>
param(
    [string]$ApiBase = "",
    [int]$TargetActive = 50000,
    [int]$PollSeconds = 30,
    [int]$TimeoutMin = 120,
    [string]$ReportDir = ""
)

$ErrorActionPreference = "Stop"
$SimLabRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
. (Join-Path $SimLabRoot "scripts\_sim-lab-resolve.ps1")

$ApiBase = Resolve-SimLabApiBase -ApiBase $ApiBase
Test-ProdApiGuard -ApiBase $ApiBase
$Password = $env:ADMIN_PASS
if (-not $Password) { throw "Set ADMIN_PASS" }

if (-not $ReportDir) {
    $ReportDir = Join-Path (Split-Path -Parent (Split-Path -Parent $SimLabRoot)) "scripts\load\reports"
}
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$reportPath = Join-Path $ReportDir ("ramp-watch-{0}.json" -f (Get-Date -Format "yyyyMMdd-HHmmss"))

function Get-LiveState {
    $authBody = @{ username = "global_owner"; password = $Password } | ConvertTo-Json
    $token = (Invoke-RestMethod -Uri "$ApiBase/auth/token/" -Method POST -ContentType "application/json" -Body $authBody -TimeoutSec 60).access
    $hdr = @{ Authorization = "Bearer $token" }
    return Invoke-RestMethod -Uri "$ApiBase/activities/admin/live-simulate/" -Headers $hdr -TimeoutSec 60
}

$samples = @()
$ok = $false
$deadline = (Get-Date).AddMinutes($TimeoutMin)
Write-Host "=== Ramp watch -> $TargetActive ACTIVE (no stop/redeploy) ===" -ForegroundColor Cyan

while ((Get-Date) -lt $deadline) {
    $ls = Get-LiveState
    $active = [int]$ls.ride_active
    $target = [int]$ls.target_on_map
    $sample = @{
        at                = (Get-Date).ToUniversalTime().ToString("o")
        ride_active       = $active
        target_on_map     = $target
        ride_warming      = [int]$ls.ride_warming
        backpressure      = [bool]$ls.routing_backpressure_active
        dispatches_throttled = [bool]$ls.dispatches_throttled
        routing_queue     = [int]$ls.routing_queue_depth
    }
    $samples += $sample
    Write-Host ("  active={0}/{1} warming={2} backpressure={3} throttled={4}" -f `
        $active, $target, $sample.ride_warming, $sample.backpressure, $sample.dispatches_throttled)

    if (-not $ls.running) {
        Write-Warning "Live sim stopped unexpectedly."
        break
    }
    if ($active -ge $TargetActive) {
        Write-Host "Target reached: $active ACTIVE" -ForegroundColor Green
        $ok = $true
        break
    }
    Start-Sleep -Seconds $PollSeconds
}

if (-not $ok) { $ok = ($samples[-1].ride_active -ge $TargetActive) }

@{
    target_active = $TargetActive
    reached       = $ok
    samples       = $samples
} | ConvertTo-Json -Depth 5 | Set-Content -Path $reportPath -Encoding UTF8

Write-Host "Report: $reportPath"
if (-not $ok) { exit 1 }
