#Requires -Version 5.1
<#
.SYNOPSIS
  Sim-lab infrastructure readiness checklist (API + optional Railway hints).

.EXAMPLE
  .\infrastructure\sim-lab\scripts\preflight-sim-lab-readiness.ps1
#>
param(
    [string]$ApiBase = "",
    [string]$Password = "",
    [string]$ProdApiBase = "https://backend-production-55c7.up.railway.app/api"
)

$ErrorActionPreference = "Stop"
$SimLabRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
. (Join-Path $SimLabRoot "scripts\_sim-lab-resolve.ps1")

$ApiBase = Resolve-SimLabApiBase -ApiBase $ApiBase
Test-ProdApiGuard -ApiBase $ApiBase
if (-not $Password) { $Password = $env:ADMIN_PASS }
if (-not $Password) { throw "Set ADMIN_PASS" }

$backendRoot = $ApiBase -replace '/api$', ''
$checks = @()

function Add-Check([string]$Name, [bool]$Pass, [string]$Detail) {
    $script:checks += [PSCustomObject]@{ name = $Name; pass = $Pass; detail = $Detail }
}

Write-Host "=== Sim-lab readiness ===" -ForegroundColor Cyan

try {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $h = Invoke-WebRequest -Uri "$backendRoot/health/" -UseBasicParsing -TimeoutSec 30
    Add-Check "health" ($h.StatusCode -eq 200) ("{0}ms" -f $sw.ElapsedMilliseconds)
} catch {
    Add-Check "health" $false $_.Exception.Message
}

$authBody = @{ username = "global_owner"; password = $Password } | ConvertTo-Json
try {
    $token = (Invoke-RestMethod -Uri "$ApiBase/auth/token/" -Method POST -ContentType "application/json" -Body $authBody -TimeoutSec 60).access
    $hdr = @{ Authorization = "Bearer $token" }
    Add-Check "auth" $true "OK"
} catch {
    Add-Check "auth" $false $_.Exception.Message
    $hdr = $null
}

if ($hdr) {
    try {
        $pf = Invoke-RestMethod -Uri "$ApiBase/activities/admin/scale-preflight/?target_users=300000&active_ratio=0.17&skip_activities=true" -Headers $hdr -TimeoutSec 120
        $maxR = [int]$pf.limits.MAX_CONCURRENT_RIDERS
        Add-Check "max_concurrent_riders" ($maxR -ge 50000) ("{0}" -f $maxR)
        Add-Check "preflight_api" $true ("athletes={0}" -f $pf.athletes_in_db)
    } catch {
        Add-Check "preflight_api" $false $_.Exception.Message
    }

    try {
        $ws = Invoke-RestMethod -Uri "$ApiBase/activities/admin/worker-status/" -Headers $hdr -TimeoutSec 60
        $routing = @($ws.workers | Where-Object {
                ($_.queues -match 'routing') -or ($_.name -match '^routing@')
            }).Count
        Add-Check "routing_workers" ($routing -ge 6) ("count={0} (want >=6 for 50k ramp)" -f $routing)
    } catch {
        Add-Check "routing_workers" $false $_.Exception.Message
    }
}

if ($env:PROD_ADMIN_PASS) {
    try {
        $prodAuth = @{ username = "global_owner"; password = $env:PROD_ADMIN_PASS } | ConvertTo-Json
        $prodToken = (Invoke-RestMethod -Uri "$ProdApiBase/auth/token/" -Method POST -ContentType "application/json" -Body $prodAuth -TimeoutSec 60).access
        $prodHdr = @{ Authorization = "Bearer $prodToken" }
        $st = Invoke-RestMethod -Uri "$ProdApiBase/activities/admin/sim-target/" -Headers $prodHdr -TimeoutSec 30
        Add-Check "prod_sim_proxy" ($st.mode -eq 'sim-lab-proxy') ("mode={0}" -f $st.mode)
    } catch {
        Add-Check "prod_sim_proxy" $false $_.Exception.Message
    }
} else {
    Add-Check "prod_sim_proxy" $true "skipped (set PROD_ADMIN_PASS to verify)"
}

$failed = @($checks | Where-Object { -not $_.pass })
foreach ($c in $checks) {
    $icon = if ($c.pass) { "OK" } else { "FAIL" }
    $color = if ($c.pass) { "Green" } else { "Red" }
    Write-Host ("  [{0}] {1} - {2}" -f $icon, $c.name, $c.detail) -ForegroundColor $color
}

Write-Host ""
Write-Host "Manual Railway checks:" -ForegroundColor Yellow
Write-Host "  TimescaleDB volume >= 30 GB"
Write-Host "  Redis RAM >= 4 GB"
Write-Host "  backend >= 8 GB RAM (sim-lab map reads at 50k; scale-sim-lab-backend.ps1)"
Write-Host "  celery-worker-routing >= 8 replicas x 2 GB (CELERY_WORKER_CONCURRENCY=4)"
Write-Host "  telemetry >= 4 GB RAM, UVICORN_WORKERS=4"
Write-Host "  brouter volume segments PL > 1 GB"
Write-Host "  TELEMETRY_SHARD_COUNT=4 + REDIS_TELEMETRY_SHARD_NODES (sync-sim-lab-telemetry-shards.ps1)"

if ($failed.Count -gt 0) {
    throw "Readiness FAIL: $($failed.Count) automated check(s)"
}
Write-Host "Readiness PASS (automated checks)" -ForegroundColor Green
