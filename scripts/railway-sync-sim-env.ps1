#Requires -Version 5.1
<#
.SYNOPSIS
  Sync live-sim env vars on Railway production (fixes stale depth=80 / starts=30).

.EXAMPLE
  .\scripts\railway-sync-sim-env.ps1
  .\scripts\railway-sync-sim-env.ps1 -SkipDeploys
#>
param([switch]$SkipDeploys)

$ErrorActionPreference = 'Stop'
$ProjectName = 'marvelous-gratitude'
$Environment = 'production'

if ($env:RAILWAY_TOKEN) { Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue }
if (-not $env:RAILWAY_API_TOKEN) {
    Write-Error 'Set RAILWAY_API_TOKEN (see .env.railway.local.example)'
}

Push-Location $PSScriptRoot\..
railway link -w "karnalooch's Projects" -p $ProjectName -e $Environment 2>&1 | Out-Null

$extra = @()
if ($SkipDeploys) { $extra = @('--skip-deploys') }

function Set-Vars([string]$Service, [string[]]$Pairs) {
    foreach ($pair in $Pairs) {
        railway variable set $pair -s $Service -e $Environment @extra 2>&1 | Out-Null
        Write-Host "  $Service : $pair"
    }
}

Write-Host 'Syncing simulation...'
Set-Vars 'celery-worker-simulation' @(
    'SCALE_MAX_STARTS_PER_LIVE_TICK=150',
    'SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH=200',
    'SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK=150',
    'SCALE_SIM_MAX_ROUTING_BACKLOG=500',
    'SCALE_SIM_INSTANT_ACTIVE_ON_ROUTE=1',
    'SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP=0',
    'SIM_BP_MIN_DISPATCH_PER_TICK=25',
    'SIM_BP_DRAIN_DISPATCH_PER_TICK=50',
    'SIM_BP_QUEUE_HEADROOM=25',
    'SCALE_SIM_START_BUDGET_MODE=active_on_map',
    'SCALE_SIM_RAMP_START_DELAY_MAX=8',
    'SCALE_SIM_RAMP_TICKS=15',
    'BROUTER_RETRIES=3',
    'BROUTER_URLS=http://brouter.railway.internal:17777/brouter,http://brouter-2.railway.internal:17777/brouter'
)

Write-Host 'Syncing routing...'
Set-Vars 'celery-worker-routing' @(
    'SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH=200',
    'SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK=150',
    'SCALE_SIM_INSTANT_ACTIVE_ON_ROUTE=1',
    'SIM_BP_MIN_DISPATCH_PER_TICK=25',
    'SIM_BP_DRAIN_DISPATCH_PER_TICK=50',
    'SIM_BP_QUEUE_HEADROOM=25',
    'BROUTER_RETRIES=3',
    'BROUTER_URLS=http://brouter.railway.internal:17777/brouter,http://brouter-2.railway.internal:17777/brouter'
)

Write-Host 'Syncing backend...'
Set-Vars 'Backend' @(
    'BROUTER_URLS=http://brouter.railway.internal:17777/brouter,http://brouter-2.railway.internal:17777/brouter',
    'SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH=200',
    'SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK=150',
    'SCALE_SIM_MAX_ROUTING_BACKLOG=500',
    'SCALE_SIM_INSTANT_ACTIVE_ON_ROUTE=1',
    'SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP=0'
)

Write-Host 'Syncing brouter (threads + heap — deploy brouter service after this)...'
Set-Vars 'brouter' @(
    'BROUTER_JAVA_XMX=3g',
    'BROUTER_JAVA_XMS=256m',
    'BROUTER_MAX_THREADS=12',
    'BROUTER_SEGMENT_PRESET=poland'
)

Write-Host 'Syncing brouter-2 (if service exists)...'
Set-Vars 'brouter-2' @(
    'BROUTER_JAVA_XMX=3g',
    'BROUTER_JAVA_XMS=256m',
    'BROUTER_MAX_THREADS=12',
    'BROUTER_SEGMENT_PRESET=poland'
)

Write-Host 'Done. Redeploy: brouter, brouter-2, celery-worker-routing, celery-worker-simulation.'
Write-Host 'Verify: .\scripts\railway-verify-production.ps1'
Pop-Location
