#Requires -Version 5.1
<#
.SYNOPSIS
  Add Railway service brouter-2 (second BRouter instance + volume).

.DESCRIPTION
  Railway does not allow numReplicas>1 when a volume is mounted. Duplicate the
  brouter service with its own volume and point workers at BROUTER_URLS.

  Prerequisites: RAILWAY_API_TOKEN, repo karnalooch/stunning-pancake on main.

.EXAMPLE
  .\scripts\railway-setup-brouter-2.ps1
  .\scripts\railway-setup-brouter-2.ps1 -SkipVolume
#>
param([switch]$SkipVolume)

$ErrorActionPreference = 'Stop'
$ProjectName = 'marvelous-gratitude'
$Environment = 'production'
$ServiceName = 'brouter-2'
$Repo = 'karnalooch/stunning-pancake'
$ConfigPath = '/infrastructure/brouter-2/railway.json'

if ($env:RAILWAY_TOKEN) { Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue }
if (-not $env:RAILWAY_API_TOKEN) {
    Write-Error 'Set RAILWAY_API_TOKEN (see .env.railway.local.example)'
}

Push-Location $PSScriptRoot\..
railway link -w "karnalooch's Projects" -p $ProjectName -e $Environment 2>&1 | Out-Null

$existing = railway service list --json 2>&1 | ConvertFrom-Json
$has = @($existing | Where-Object { $_.name -eq $ServiceName }).Count -gt 0

if (-not $has) {
    Write-Host "Creating service $ServiceName from $Repo ..."
    railway add --service $ServiceName --repo $Repo --json 2>&1 | Out-Null
    Write-Host @"

Manual steps in Railway UI (one-time):
  1. Service $ServiceName -> Settings -> Config file path: $ConfigPath
  2. Root directory: / (repo root)
  3. Deploy from main

"@
} else {
    Write-Host "Service $ServiceName already exists."
}

if (-not $SkipVolume) {
    Write-Host 'Adding volume /brouter/segments4 (skip if already attached)...'
    railway service link $ServiceName 2>&1 | Out-Null
    railway volume add -m /brouter/segments4 --json 2>&1
}

Write-Host 'Setting brouter-2 container vars...'
railway variable set BROUTER_JAVA_XMX=3g -s $ServiceName -e $Environment 2>&1 | Out-Null
railway variable set BROUTER_JAVA_XMS=256m -s $ServiceName -e $Environment 2>&1 | Out-Null
railway variable set BROUTER_MAX_THREADS=12 -s $ServiceName -e $Environment 2>&1 | Out-Null
railway variable set BROUTER_SEGMENT_PRESET=poland -s $ServiceName -e $Environment 2>&1 | Out-Null

Write-Host 'Sync worker BROUTER_URLS + redeploy...'
& "$PSScriptRoot\railway-sync-sim-env.ps1" -SkipDeploys
railway redeploy -s $ServiceName -y --from-source --json 2>&1
railway redeploy -s celery-worker-routing -y --from-source --json 2>&1
railway redeploy -s celery-worker-simulation -y --from-source --json 2>&1

Write-Host @"

brouter-2 first boot may download Poland tiles 10-30 min. Watch:
  railway logs -s brouter-2 --lines 30

Then restart live sim (stop -> reset locks -> turbo map).

"@
Pop-Location
