#Requires -Version 5.1
<#
.SYNOPSIS
  Switch marvelous-gratitude prod sim-heavy services between peak and off-peak profiles.

.DESCRIPTION
  Off-peak (default after sim-lab separation): scale down prod-only sim infra
  (routing, osrm, brouter-2) to save RAM. User-facing anti-cheat keeps primary brouter.

  Peak: restore routing/osrm/brouter-2 for emergency prod-local sim (prefer sim-lab proxy).

.PARAMETER Profile
  off-peak | peak

.EXAMPLE
  .\scripts\railway-set-prod-sim-capacity.ps1 -Profile off-peak
  .\scripts\railway-set-prod-sim-capacity.ps1 -Profile peak
  .\scripts\railway-set-prod-sim-capacity.ps1 -Profile off-peak -DryRun
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('off-peak', 'peak')]
    [string]$Profile,

    [string]$ProjectId = 'ce13089b-76f4-4114-a892-ad13e23c8761',
    [string]$EnvironmentId = 'f30e70a7-b4d2-42aa-8137-21faa091b969',
    [string]$Environment = 'production',
    [string]$WorkspaceId = '8aa1f35e-a716-4526-8209-5aadcaae2246',
    [string]$PrimaryRegion = 'europe-west4-drams3a',
    [string]$PinRegion = 'us-west2',
    [switch]$DryRun,
    [switch]$SkipVerify
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($env:RAILWAY_TOKEN) { Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue }
if (-not $env:RAILWAY_API_TOKEN) {
    $env:RAILWAY_API_TOKEN = [Environment]::GetEnvironmentVariable('RAILWAY_API_TOKEN', 'User')
}
if (-not $env:RAILWAY_API_TOKEN) {
    throw 'RAILWAY_API_TOKEN required (Windows User env).'
}
$env:CI = 'true'

$Profiles = @{
    'off-peak' = @{
        routingReplicas  = 0
        routingVCpu      = 1
        routingMemoryGB  = 1
        osrmReplicas     = 0
        brouter2Replicas = 0
        brouter2VCpu     = 0.5
        brouter2MemoryGB = 1
    }
    'peak' = @{
        routingReplicas  = 2
        routingVCpu      = 1
        routingMemoryGB  = 1
        osrmReplicas     = 1
        brouter2Replicas = 1
        brouter2VCpu     = 1
        brouter2MemoryGB = 2
    }
}

$Services = @{
    routing = @{
        Name = 'celery-worker-routing'
        Id   = '9b8fee23-e95c-41d2-a7e5-f9fae91e923c'
    }
    osrm = @{
        Name = 'osrm'
        Id   = '4d0355ff-03fd-4e3c-a88e-99cbe853876c'
    }
    brouter2 = @{
        Name = 'brouter-2'
        Id   = 'bf267f85-7943-4434-9210-78f4ee1b01ea'
    }
}

$cfg = $Profiles[$Profile]
$headers = @{
    Authorization = "Bearer $($env:RAILWAY_API_TOKEN)"
    'Content-Type'  = 'application/json'
}

function Invoke-RailwayQuiet {
    param([string[]]$RailwayArgs)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & railway @RailwayArgs 2>&1
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Invoke-RailwayGraphQL {
    param([string]$Query, [hashtable]$Variables)
    $body = @{ query = $Query; variables = $Variables } | ConvertTo-Json -Depth 8
    $resp = Invoke-RestMethod -Uri 'https://backboard.railway.com/graphql/v2' -Method Post -Headers $headers -Body $body -TimeoutSec 90
    if ($resp.errors) {
        throw ($resp.errors | ConvertTo-Json -Depth 5)
    }
    return $resp.data
}

function Set-ServiceReplicas {
    param(
        [string]$ServiceName,
        [int]$Replicas
    )
    Write-Host "  $ServiceName -> numReplicas=$Replicas ($PrimaryRegion)" -ForegroundColor Cyan
    if ($DryRun) { return }

    Invoke-RailwayQuiet @(
        'scale', '-s', $ServiceName, '-e', $Environment, '-p', $ProjectId,
        "${PrimaryRegion}=${Replicas}", "${PinRegion}=0"
    ) | Out-Null
    Start-Sleep -Seconds 2
}

function Set-ServiceLimits {
    param(
        [string]$ServiceId,
        [string]$Label,
        [double]$VCpu,
        [int]$MemoryGB
    )
    if ($MemoryGB -le 0) { return }
    Write-Host "  $Label -> limits ${MemoryGB}GB / ${VCpu} vCPU" -ForegroundColor Cyan
    if ($DryRun) { return }

    $mutation = @'
mutation serviceInstanceLimitsUpdate($input: ServiceInstanceLimitsUpdateInput!) {
  serviceInstanceLimitsUpdate(input: $input)
}
'@
    Invoke-RailwayGraphQL -Query $mutation -Variables @{
        input = @{
            serviceId     = $ServiceId
            environmentId = $EnvironmentId
            vCPUs         = $VCpu
            memoryGB      = $MemoryGB
        }
    } | Out-Null
}

Push-Location $PSScriptRoot\..
try {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    railway link -p $ProjectId -e $Environment -w $WorkspaceId --json 2>$null | Out-Null
    $ErrorActionPreference = $prev

    Write-Host "=== Prod sim capacity: $Profile ===" -ForegroundColor Green
    Write-Host "Project: marvelous-gratitude ($ProjectId)"
    if ($DryRun) { Write-Host 'DRY RUN — no Railway mutations' -ForegroundColor Yellow }

    Set-ServiceReplicas -ServiceName $Services.routing.Name -Replicas $cfg.routingReplicas
    if ($cfg.routingReplicas -gt 0) {
        Set-ServiceLimits -ServiceId $Services.routing.Id -Label $Services.routing.Name -VCpu $cfg.routingVCpu -MemoryGB $cfg.routingMemoryGB
    }

    Set-ServiceReplicas -ServiceName $Services.osrm.Name -Replicas $cfg.osrmReplicas

    Set-ServiceReplicas -ServiceName $Services.brouter2.Name -Replicas $cfg.brouter2Replicas
    if ($cfg.brouter2Replicas -gt 0) {
        Set-ServiceLimits -ServiceId $Services.brouter2.Id -Label $Services.brouter2.Name -VCpu $cfg.brouter2VCpu -MemoryGB $cfg.brouter2MemoryGB
    }

    Write-Host ''
    Write-Host 'Applied. Sim workloads should use sim-lab proxy (SIM_LAB_PROXY_ENABLED=1 on Backend).' -ForegroundColor Green
    Write-Host 'Peak sim / load tests: sync sim-lab profile, then run harness against SIM_LAB_API_BASE.'

    if (-not $SkipVerify) {
        Write-Host ''
        Write-Host '=== Post-apply service list ===' -ForegroundColor Cyan
        $ErrorActionPreference = 'Continue'
        railway service list 2>&1 | Select-String -Pattern 'celery-worker-routing|osrm|brouter-2|replicas'
        $ErrorActionPreference = $prev
    }
} finally {
    Pop-Location
}
