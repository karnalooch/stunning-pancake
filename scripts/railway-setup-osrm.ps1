#Requires -Version 5.1
<#
.SYNOPSIS
  Add/configure Railway service osrm + sync sim workers to OSRM routing.

.DESCRIPTION
  - Creates service "osrm" from GitHub repo (if missing)
  - Volume /data (8GB recommended in UI if CLI size limited)
  - Sets container env + worker SCALE_SIM_ROUTING_BACKEND=osrm
  - Redeploys osrm, celery-worker-simulation, celery-worker-routing

  Prerequisites: RAILWAY_API_TOKEN (User env), project marvelous-gratitude / production.

.EXAMPLE
  .\scripts\railway-setup-osrm.ps1
  .\scripts\railway-setup-osrm.ps1 -SkipVolume -SkipDeploys
#>
param(
    [switch]$SkipVolume,
    [switch]$SkipDeploys
)

$ErrorActionPreference = 'Stop'
$ProjectName = 'marvelous-gratitude'
$Environment = 'production'
$ServiceName = 'osrm'
$Repo = 'karnalooch/stunning-pancake'
$ConfigPath = '/infrastructure/osrm/railway.json'
$OsrmInternalUrl = 'http://osrm.railway.internal:5000'

if ($env:RAILWAY_TOKEN) { Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue }
if (-not $env:RAILWAY_API_TOKEN) {
    Write-Error 'Set RAILWAY_API_TOKEN (see .env.railway.local.example)'
}

$deployExtra = @()
if ($SkipDeploys) { $deployExtra = @('--skip-deploys') }

Push-Location $PSScriptRoot\..

$ProjectId = if ($env:RAILWAY_PROJECT_ID) { $env:RAILWAY_PROJECT_ID } else { 'ce13089b-76f4-4114-a892-ad13e23c8761' }
$statusOut = railway status 2>&1 | Out-String
if ($statusOut -notmatch [regex]::Escape($ProjectName)) {
    Write-Host "Linking $ProjectName ($ProjectId) / $Environment ..."
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    railway link -p $ProjectId -e $Environment --json 2>&1 | Out-Null
    $ErrorActionPreference = $prevEap
} else {
    Write-Host "Already linked to $ProjectName / $Environment"
}

$existing = railway service list --json 2>&1 | ConvertFrom-Json
$has = @($existing | Where-Object { $_.name -eq $ServiceName }).Count -gt 0

if (-not $has) {
    Write-Host "Creating service $ServiceName from $Repo ..."
    railway add --service $ServiceName --repo $Repo --json 2>&1 | Out-Null
    Write-Host @"

One-time in Railway UI (if deploy fails without config):
  Service $ServiceName -> Settings
    Config file path: $ConfigPath
    Root directory: /
  Resources: 8 GB RAM, 4 vCPU (match railway.json)
  Volume: /data — **resize to >= 10 GB** in UI (CLI often creates ~5 GB; Poland needs ~10 GB)

"@
} else {
    Write-Host "Service $ServiceName already exists."
}

railway service link $ServiceName 2>&1 | Out-Null

if (-not $SkipVolume) {
    Write-Host 'Attaching volume /data (service must be linked; ignore error if exists)...'
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    railway volume add -m /data --json 2>&1
    $ErrorActionPreference = $prevEap
}

Write-Host 'Setting osrm container vars...'
railway variable set OSRM_PORT=5000 -s $ServiceName -e $Environment @deployExtra 2>&1 | Out-Null
railway variable set OSRM_BUILD_PROFILE=/opt/car.lua -s $ServiceName -e $Environment @deployExtra 2>&1 | Out-Null
railway variable set OSRM_PBF_URL=https://download.geofabrik.de/europe/poland-latest.osm.pbf -s $ServiceName -e $Environment @deployExtra 2>&1 | Out-Null

function Set-WorkerOsrm([string]$Worker) {
    railway variable set "OSRM_URL=$OsrmInternalUrl" -s $Worker -e $Environment @deployExtra 2>&1 | Out-Null
    railway variable set SCALE_SIM_ROUTING_BACKEND=osrm -s $Worker -e $Environment @deployExtra 2>&1 | Out-Null
    railway variable set OSRM_TIMEOUT=15 -s $Worker -e $Environment @deployExtra 2>&1 | Out-Null
    railway variable set OSRM_RETRIES=2 -s $Worker -e $Environment @deployExtra 2>&1 | Out-Null
    railway variable set SCALE_SIM_ROUTE_TEMPLATE_CACHE=1 -s $Worker -e $Environment @deployExtra 2>&1 | Out-Null
    railway variable set SIM_SLO_AUTO_THROTTLE=1 -s $Worker -e $Environment @deployExtra 2>&1 | Out-Null
    Write-Host "  $Worker : OSRM + SLO + route template"
}

Set-WorkerOsrm 'celery-worker-simulation'
Set-WorkerOsrm 'celery-worker-routing'

Write-Host 'Backend: keep BROUTER for anti-cheat; optional OSRM_URL for health/docs only'
railway variable set "OSRM_URL=$OsrmInternalUrl" -s Backend -e $Environment @deployExtra 2>&1 | Out-Null

Write-Host 'Syncing remaining sim env (starts, BP, BROUTER_URLS)...'
& "$PSScriptRoot\railway-sync-sim-env.ps1" -SkipDeploys

Write-Host 'Configuring Dockerfile + railway.json (GraphQL)...'
& "$PSScriptRoot\railway-configure-service-build.ps1" -ServiceName $ServiceName

if (-not $SkipDeploys) {
    Write-Host 'Redeploying osrm + workers (requires infrastructure/osrm on GitHub main)...'
    railway redeploy -s $ServiceName -y --from-source --json 2>&1
    railway redeploy -s celery-worker-simulation -y --from-source --json 2>&1
    railway redeploy -s celery-worker-routing -y --from-source --json 2>&1
}

Write-Host @"

Next:
  railway logs -s osrm --lines 50    # wait for "Starting osrm-routed"
  .\scripts\railway-verify-production.ps1

Live sim: Stop -> Start (profile 50/50 first). Status should show sim_routing_backend=osrm.

"@
Pop-Location
