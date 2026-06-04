#Requires -Version 5.1
<#
.SYNOPSIS
  Configure Backend Railway variables for OSRM live-sim lifecycle (GraphQL scale 0↔1).

.PARAMETER ScaleOsrmDown
  After setting vars, set osrm numReplicas=0 (save RAM until next live sim).

.EXAMPLE
  .\scripts\railway-setup-osrm-lifecycle-env.ps1
  .\scripts\railway-setup-osrm-lifecycle-env.ps1 -ScaleOsrmDown
#>
param(
    [switch]$ScaleOsrmDown,
    [switch]$SkipBackendRedeploy,
    [string]$BackendService = 'Backend',
    [string]$Environment = 'production',
    [string]$OsrmServiceId = '4d0355ff-03fd-4e3c-a88e-99cbe853876c',
    [string]$ProjectId = 'ce13089b-76f4-4114-a892-ad13e23c8761',
    [string]$EnvironmentId = 'f30e70a7-b4d2-42aa-8137-21faa091b969',
    [string]$OsrmRegion = 'europe-west4-drams3a'
)

$ErrorActionPreference = 'Stop'
if ($env:RAILWAY_TOKEN) { Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue }
if (-not $env:RAILWAY_API_TOKEN) {
    Write-Error 'RAILWAY_API_TOKEN required (Windows User env).'
}

Push-Location $PSScriptRoot\..
$statusOut = railway status 2>&1 | Out-String
if ($statusOut -notmatch 'marvelous-gratitude') {
    railway link -p $ProjectId -e $Environment --json 2>&1 | Out-Null
}

function Set-Var([string]$Name, [string]$Value) {
    railway variable set "${Name}=${Value}" -s $BackendService -e $Environment 2>&1 | Out-Null
    Write-Host "  $BackendService : $Name=(set)"
}

Write-Host "Configuring OSRM lifecycle on $BackendService ..."
Set-Var 'RAILWAY_API_TOKEN' $env:RAILWAY_API_TOKEN
Set-Var 'RAILWAY_OSRM_LIFECYCLE' '0'
Set-Var 'RAILWAY_OSRM_SERVICE_ID' $OsrmServiceId
Set-Var 'RAILWAY_OSRM_SERVICE_NAME' 'osrm'
Set-Var 'RAILWAY_PROJECT_ID' $ProjectId
Set-Var 'RAILWAY_ENVIRONMENT_ID' $EnvironmentId
Set-Var 'RAILWAY_OSRM_REGION' $OsrmRegion
Set-Var 'SCALE_SIM_ROUTING_BACKEND' 'auto'

if (-not $SkipBackendRedeploy) {
    Write-Host "Redeploying $BackendService (pick up lifecycle code + vars)..."
    railway redeploy -s $BackendService -y 2>&1 | Out-Host
}

if ($ScaleOsrmDown) {
    Write-Host 'Scaling osrm -> numReplicas=0 ...'
    & "$PSScriptRoot\railway-osrm-scale.ps1" -Replicas 0
}

Write-Host 'Done. Live sim POST scales OSRM up; DELETE scales down.'
Pop-Location
