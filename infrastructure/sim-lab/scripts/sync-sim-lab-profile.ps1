#Requires -Version 5.1
<#
.SYNOPSIS
  Apply sim-lab SCALE_* profile to Railway sim-lab project (NOT prod).

.PARAMETER Profile
  smoke | 300k-50k (files in railway/profiles/)

.EXAMPLE
  railway link -p <SIM_LAB_PROJECT_ID> -e production
  .\infrastructure\sim-lab\scripts\sync-sim-lab-profile.ps1 -Profile 300k-50k
#>
param(
    [ValidateSet("smoke", "300k-50k")]
    [string]$Profile = "300k-50k",
    [string]$ProjectId = "",
    [string]$Environment = "production",
    [switch]$SkipDeploys,
    [switch]$Redeploy,
    [string[]]$RedeployServices = @()
)

$ErrorActionPreference = "Stop"
function Invoke-RailwayQuiet([string[]]$RailwayArgs) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { & railway @RailwayArgs 2>&1 | Out-Null } finally { $ErrorActionPreference = $prev }
}

function Set-RailwayVar([string]$Service, [string]$Line) {
    $railwayArgs = @("variable", "set", $Line, "-s", $Service, "-e", $Environment)
    if ($SkipDeploys) { $railwayArgs += "--skip-deploys" }
    Invoke-RailwayQuiet $railwayArgs
}
$SimLabRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ProfilePath = Join-Path $SimLabRoot "railway\profiles\$Profile.env"
if (-not (Test-Path $ProfilePath)) { throw "Missing profile: $ProfilePath" }

if (-not $ProjectId) { $ProjectId = $env:SIM_LAB_PROJECT_ID }
if (-not $ProjectId) { $ProjectId = "098b5266-2d8b-43f3-ba29-925aaa6b7b64" }

if ($env:RAILWAY_TOKEN) { Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue }
$env:CI = "true"

$routingOnly = @(
    'BROUTER_URLS=http://brouter.railway.internal:17777/brouter,http://brouter-2.railway.internal:17777/brouter'
    'OSRM_URL=http://osrm.railway.internal:5000'
    'SCALE_SIM_ASYNC_ROUTING=1'
    'SCALE_SIM_ROUTING_BACKEND=auto'
    'BROUTER_TIMEOUT=25'
    'OSRM_TIMEOUT=15'
)

$brouterOnly = @(
    'BROUTER_SEGMENT_PRESET=poland'
    'BROUTER_JAVA_XMX=1536m'
    'BROUTER_AUTO_DOWNLOAD_SEGMENTS=1'
)

$telemetryOnly = @(
    'UVICORN_WORKERS=4'
    'TELEMETRY_DB_POOL_MAX=30'
)

Push-Location (Join-Path $SimLabRoot "..\..")
try {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    Invoke-RailwayQuiet @("link", "-p", $ProjectId, "-e", $Environment, "-w", "8aa1f35e-a716-4526-8209-5aadcaae2246", "--json")
    $ErrorActionPreference = $prevEap

    $sharedServices = @(
        "backend",
        "celery-worker-simulation",
        "celery-worker-routing",
        "celery-worker",
        "telemetry"
    )

    $lines = Get-Content $ProfilePath | Where-Object { $_ -and $_ -notmatch '^\s*#' }
    Write-Host "=== Sim-lab profile: $Profile ===" -ForegroundColor Cyan
    foreach ($svc in $sharedServices) {
        foreach ($line in $lines) {
            if ($line -notmatch '=') { continue }
            Set-RailwayVar $svc $line
            Write-Host "  $svc : $line"
        }
    }

    foreach ($svc in @("brouter", "brouter-2")) {
        foreach ($line in $brouterOnly) {
            Set-RailwayVar $svc $line
            Write-Host "  $svc : $line"
        }
    }

    foreach ($line in $telemetryOnly) {
        Set-RailwayVar "telemetry" $line
        Write-Host "  telemetry : $line"
    }

    foreach ($svc in @("celery-worker-simulation", "celery-worker-routing", "backend")) {
        foreach ($line in $routingOnly) {
            Set-RailwayVar $svc $line
            Write-Host "  $svc : $line"
        }
    }

    foreach ($line in @("CELERY_WORKER_QUEUES=simulation", "CELERY_WORKER_HOSTNAME=simulation@%h")) {
        Set-RailwayVar "celery-worker-simulation" $line
        Write-Host "  celery-worker-simulation : $line"
    }
    foreach ($line in @(
        "CELERY_WORKER_QUEUES=routing"
        "CELERY_WORKER_HOSTNAME=routing@%h"
        "CELERY_WORKER_POOL=solo"
        "CELERY_WORKER_CONCURRENCY=4"
    )) {
        Set-RailwayVar "celery-worker-routing" $line
        Write-Host "  celery-worker-routing : $line"
    }

    if ($Redeploy -and -not $SkipDeploys) {
        $targets = if ($RedeployServices.Count -gt 0) {
            $RedeployServices
        } else {
            @("backend", "celery-worker-simulation", "celery-worker-routing", "telemetry")
        }
        foreach ($svc in $targets) {
            Write-Host "Redeploy $svc..."
            Invoke-RailwayQuiet @("redeploy", "-s", $svc, "-y")
        }
    }

    Write-Host "Done. Run sync-sim-lab-telemetry-shards.ps1 for REDIS_TELEMETRY_SHARD_NODES." -ForegroundColor Green
} finally {
    Pop-Location
}
