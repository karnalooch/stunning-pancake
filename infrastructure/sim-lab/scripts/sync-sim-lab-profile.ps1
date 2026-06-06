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
    [switch]$Redeploy
)

$ErrorActionPreference = "Stop"
function Invoke-RailwayQuiet([string[]]$Args) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { & railway @Args 2>&1 | Out-Null } finally { $ErrorActionPreference = $prev }
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

    $extra = @()
    if ($SkipDeploys) { $extra = @("--skip-deploys") }

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
            Invoke-RailwayQuiet @("variable", "set", $line, "-s", $svc, "-e", $Environment) + $extra
            Write-Host "  $svc : $line"
        }
    }

    foreach ($svc in @("brouter", "brouter-2")) {
        foreach ($line in $brouterOnly) {
            Invoke-RailwayQuiet @("variable", "set", $line, "-s", $svc, "-e", $Environment) + $extra
            Write-Host "  $svc : $line"
        }
    }

    foreach ($line in $telemetryOnly) {
        Invoke-RailwayQuiet @("variable", "set", $line, "-s", "telemetry", "-e", $Environment) + $extra
        Write-Host "  telemetry : $line"
    }

    foreach ($svc in @("celery-worker-simulation", "celery-worker-routing", "backend")) {
        foreach ($line in $routingOnly) {
            Invoke-RailwayQuiet @("variable", "set", $line, "-s", $svc, "-e", $Environment) + $extra
            Write-Host "  $svc : $line"
        }
    }

    if ($Redeploy -and -not $SkipDeploys) {
        foreach ($svc in @("backend", "celery-worker-simulation", "celery-worker-routing", "telemetry")) {
            Write-Host "Redeploy $svc..."
            Invoke-RailwayQuiet @("redeploy", "-s", $svc, "-y", "--detach")
        }
    }

    Write-Host "Done. Run sync-sim-lab-telemetry-shards.ps1 for REDIS_TELEMETRY_SHARD_NODES." -ForegroundColor Green
} finally {
    Pop-Location
}
