#Requires -Version 5.1
<#
.SYNOPSIS
  Railway production profile: 300k users in DB + up to 50k ACTIVE on live map.

.DESCRIPTION
  Sets SCALE_* / EVENT_* / SIM_* env on simulation, routing, backend, celery-worker.
  Requires: railway CLI logged in OR RAILWAY_API_TOKEN.

  Manual (Dashboard) if CLI cannot resize volumes:
    - TimescaleDB volume: 5 GB → 20 GB minimum (300k users ~10 GB)
    - Redis volume: 500 MB → 2 GB recommended (50k telemetry shards)

.EXAMPLE
  .\scripts\railway-sync-300k-50k.ps1
  .\scripts\railway-sync-300k-50k.ps1 -SkipDeploys
#>
param([switch]$SkipDeploys)

$ErrorActionPreference = 'Stop'
$ProjectName = 'marvelous-gratitude'
$Environment = 'production'

if ($env:RAILWAY_TOKEN) { Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue }

Push-Location $PSScriptRoot\..
$ProjectId = if ($env:RAILWAY_PROJECT_ID) { $env:RAILWAY_PROJECT_ID } else { 'ce13089b-76f4-4114-a892-ad13e23c8761' }
$statusOut = railway status 2>&1 | Out-String
if ($statusOut -notmatch [regex]::Escape($ProjectName)) {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    railway link -p $ProjectId -e $Environment --json 2>&1 | Out-Null
    $ErrorActionPreference = $prevEap
}

$extra = @()
if ($SkipDeploys) { $extra = @('--skip-deploys') }

function Set-Vars([string]$Service, [string[]]$Pairs) {
    foreach ($pair in $Pairs) {
        railway variable set $pair -s $Service -e $Environment @extra 2>&1 | Out-Null
        Write-Host "  $Service : $pair"
    }
}

Write-Host '=== Profile 300k users / 50k on map ===' -ForegroundColor Cyan

# Shared live-sim caps (50k concurrent)
$liveCaps = @(
    'SCALE_MAX_CONCURRENT_RIDERS=50000'
    'EVENT_MAX_CONCURRENT_RIDERS=50000'
    'SCALE_MAX_TELEMETRY_PUBLISH_PER_TICK=50000'
    'SCALE_SIM_MAX_PIPELINE_ABSOLUTE=55000'
    'SCALE_SIM_MAX_PIPELINE_MULTIPLIER=2.5'
    'SCALE_SIM_MAX_PIPELINE_HEADROOM=500'
    'SCALE_SIM_START_BUDGET_MODE=active_on_map'
    'SCALE_TELEMETRY_API_MAX_LIMIT=50000'
    'LIVE_MAP_FULL_SCALE=1'
)

# Routing throughput (50k ramp needs deep queue + high dispatch)
$routing = @(
    'SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH=500'
    'SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK=200'
    'SCALE_SIM_MAX_ROUTING_BACKLOG=2000'
    'SCALE_SIM_ASYNC_ROUTING=1'
    'SCALE_SIM_INSTANT_ACTIVE_ON_ROUTE=1'
    'SCALE_SIM_ROUTE_TEMPLATE_CACHE=1'
    'SCALE_SIM_ROUTING_BACKEND=auto'
    'SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP=0'
    'SIM_BP_MIN_DISPATCH_PER_TICK=40'
    'SIM_BP_DRAIN_DISPATCH_PER_TICK=80'
    'SIM_BP_QUEUE_HEADROOM=50'
    'BROUTER_RETRIES=3'
    'BROUTER_URLS=http://brouter.railway.internal:17777/brouter,http://brouter-2.railway.internal:17777/brouter'
    'OSRM_URL=http://osrm.railway.internal:5000'
    'OSRM_TIMEOUT=15'
    'OSRM_RETRIES=2'
)

# SLO: raise warming threshold so 50k target is not throttled at 280 warming
$slo = @(
    'SIM_SLO_AUTO_THROTTLE=1'
    'SIM_SLO_WARMING_ABOVE=8000'
    'SIM_SLO_AFTER_TICKS=12'
    'SIM_SLO_STARTS_CAP=120'
)

# Batch / disk (300k)
$batch = @(
    'SCALE_POSTGRES_DISK_BUDGET_GB=20'
    'SCALE_BATCH_MAX_PARALLEL_WORKERS=4'
    'SCALE_USER_BULK_PG_BATCH_SIZE=200'
    'SCALE_WIPE_USER_CHUNK_SIZE=500'
    'SCALE_WIPE_CHUNK_SIZE=1000'
    'SCALE_SKIP_GLOBAL_LIVE_POOL_ABOVE=50000'
    'SCALE_LIVE_POOL_MAX_REDIS=50000'
)

# Large pool: allow up to ~20% active_ratio (300k * 0.167 ≈ 50k on map)
$largePool = @(
    'SCALE_SIM_LARGE_POOL_MIN_USERS=5000'
    'SCALE_SIM_LARGE_POOL_MAX_ACTIVE_RATIO=0.20'
    'SCALE_SIM_LARGE_POOL_MIN_TICK_SECONDS=8'
)

Write-Host 'celery-worker-simulation...'
Set-Vars 'celery-worker-simulation' (
    $liveCaps + $routing + $slo + $batch + $largePool + @(
        'SCALE_MAX_STARTS_PER_LIVE_TICK=200'
        'SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK=100'
        'SCALE_SIM_BROUTER_ROUTE_ATTEMPTS=4'
        'SCALE_SIM_RAMP_START_DELAY_MAX=10'
        'SCALE_SIM_RAMP_TICKS=25'
        'CELERY_WORKER_CONCURRENCY=2'
        'RAILWAY_OSRM_READY_MAX_WAIT_S=90'
    )
)

Write-Host 'celery-worker-routing...'
Set-Vars 'celery-worker-routing' (
    $routing + $batch + @(
        'CELERY_WORKER_CONCURRENCY=3'
    )
)

Write-Host 'Backend...'
Set-Vars 'Backend' (
    $liveCaps + $routing + $slo + $batch + $largePool + @(
        'SCALE_TELEMETRY_LIVE_CACHE_TTL=3'
        'RAILWAY_OSRM_LIFECYCLE=0'
        'RAILWAY_OSRM_READY_MAX_WAIT_S=90'
    )
)

Write-Host 'celery-worker (wipe/batch)...'
Set-Vars 'celery-worker' @(
    'SCALE_POSTGRES_DISK_BUDGET_GB=20'
    'SCALE_WIPE_USER_CHUNK_SIZE=500'
    'SCALE_WIPE_CHUNK_SIZE=1000'
)

Write-Host 'brouter + brouter-2 (threads)...'
$brouter = @(
    'BROUTER_JAVA_XMX=3g'
    'BROUTER_JAVA_XMS=256m'
    'BROUTER_MAX_THREADS=16'
    'BROUTER_SEGMENT_PRESET=poland'
)
Set-Vars 'brouter' $brouter
Set-Vars 'brouter-2' $brouter

Write-Host ''
Write-Host 'Done. Services will redeploy unless -SkipDeploys.' -ForegroundColor Green
Write-Host ''
Write-Host 'MANUAL (Railway Dashboard) — volumes cannot be resized via this script:' -ForegroundColor Yellow
Write-Host '  1. TimescaleDB volume timescaledb-volume: 5 GB -> 20 GB (required for 300k)'
Write-Host '  2. Redis volume redis-volume: 500 MB -> 2048 MB (recommended for 50k telemetry)'
Write-Host '  3. celery-worker-routing: set replicas to 6 in Deploy settings (or redeploy from repo railway.json)'
Write-Host ''
Write-Host 'Simulator wizard (after batch 300k):' -ForegroundColor Cyan
Write-Host '  - Preset 300k (bez aktywnosci) -> Launch batch -> wait complete'
Write-Host '  - Live: active_ratio ~0.17 (50k/300k) OR intensity ~35 / load ~50'
Write-Host '  - Do NOT use Turbo load=100 until map has ramped (pipeline 55k cap)'
Write-Host ''
Write-Host 'Verify: .\scripts\railway-verify-production.ps1'
Pop-Location
