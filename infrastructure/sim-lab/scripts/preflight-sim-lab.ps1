#Requires -Version 5.1
<#
.SYNOPSIS
  Sim-lab preflight: health, scale-preflight, optional live/batch idle check.

.EXAMPLE
  $env:SIM_LAB_API_BASE = "http://localhost:8000/api"
  .\infrastructure\sim-lab\scripts\preflight-sim-lab.ps1

.EXAMPLE
  .\infrastructure\sim-lab\scripts\preflight-sim-lab.ps1 -ApiBase https://backend-sim.up.railway.app/api
#>
param(
    [string]$ApiBase = "",
    [string]$Username = "global_owner",
    [string]$Password = "",
    [int]$TargetUsers = 300000,
    [double]$ActiveRatio = 0.17
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
. (Join-Path $Root "scripts\_sim-lab-resolve.ps1")

$ApiBase = Resolve-SimLabApiBase -ApiBase $ApiBase
Test-ProdApiGuard -ApiBase $ApiBase

if (-not $Password) { $Password = $env:ADMIN_PASS }
if (-not $Password) { throw "Set ADMIN_PASS or -Password" }

$backendRoot = $ApiBase -replace '/api$', ''
Write-Host "=== Sim-lab preflight ===" -ForegroundColor Cyan
Write-Host "API: $ApiBase"

$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $health = Invoke-WebRequest -Uri "$backendRoot/health/" -UseBasicParsing -TimeoutSec 60
    Write-Host ("health: {0} ({1}ms)" -f $health.StatusCode, $sw.ElapsedMilliseconds)
} catch {
    throw "Backend unreachable: $($_.Exception.Message)"
}

$authBody = @{ username = $Username; password = $Password } | ConvertTo-Json
$sw.Restart()
$token = (Invoke-RestMethod -Uri "$ApiBase/auth/token/" -Method POST -ContentType "application/json" -Body $authBody -TimeoutSec 120).access
Write-Host ("auth: OK ({0}ms)" -f $sw.ElapsedMilliseconds)
$h = @{ Authorization = "Bearer $token" }

$sw.Restart()
$pf = Invoke-RestMethod -Uri "$ApiBase/activities/admin/scale-preflight/?target_users=$TargetUsers&active_ratio=$ActiveRatio&skip_activities=true" -Headers $h -TimeoutSec 120
Write-Host ("preflight: OK ({0}ms)" -f $sw.ElapsedMilliseconds)
Write-Host ("  athletes_in_db={0} disk_est_300k_gb={1} max_riders={2}" -f $pf.athletes_in_db, $pf.estimated_disk_gb, $pf.limits.MAX_CONCURRENT_RIDERS)

$bs = Invoke-RestMethod -Uri "$ApiBase/activities/admin/simulate/" -Headers $h -TimeoutSec 60
$ls = Invoke-RestMethod -Uri "$ApiBase/activities/admin/live-simulate/" -Headers $h -TimeoutSec 60
Write-Host ("batch: running={0} phase={1} users={2}" -f $bs.running, $bs.current_phase, $bs.users_created)
Write-Host ("live:  running={0} active={1} target={2}" -f $ls.running, $ls.ride_active, $ls.target_on_map)

if ($bs.running) { Write-Warning "Batch still running — wait before ramp." }
if ($ls.running) { Write-Warning "Live sim running — stop before new ramp unless intentional." }

Write-Host "Preflight PASS" -ForegroundColor Green
