#Requires -Version 5.1
<#
.SYNOPSIS
  Set Railway service build config (dockerfile + railway.json) via GraphQL.

.PARAMETER ServiceId
  Railway service UUID (from `railway service list --json`).

.EXAMPLE
  .\scripts\railway-configure-service-build.ps1 -ServiceName osrm -DockerfilePath /infrastructure/osrm/Dockerfile -ConfigFilePath /infrastructure/osrm/railway.json
#>
param(
    [string]$ServiceId,
    [string]$ServiceName = 'osrm',
    [string]$EnvironmentId = 'f30e70a7-b4d2-42aa-8137-21faa091b969',
    [string]$RootDirectory = '/',
    [string]$DockerfilePath = $null,
    [string]$ConfigFilePath = $null
)

$ErrorActionPreference = 'Stop'
if (-not $env:RAILWAY_API_TOKEN) {
    Write-Error 'RAILWAY_API_TOKEN required for GraphQL (User env).'
}

if (-not $ServiceId) {
    Push-Location $PSScriptRoot\..
    $list = railway service list --json 2>&1 | ConvertFrom-Json
    Pop-Location
    $svc = $list | Where-Object { $_.name -eq $ServiceName } | Select-Object -First 1
    if (-not $svc) { Write-Error "Service not found: $ServiceName" }
    $ServiceId = $svc.id
}

$headers = @{
    Authorization = "Bearer $($env:RAILWAY_API_TOKEN)"
    'Content-Type'  = 'application/json'
}

$mutation = @"
mutation serviceInstanceUpdate(`$serviceId: String!, `$environmentId: String!, `$input: ServiceInstanceUpdateInput!) {
  serviceInstanceUpdate(serviceId: `$serviceId, environmentId: `$environmentId, input: `$input)
}
"@

$body = @{
    query     = $mutation
    variables = @{
        serviceId     = $ServiceId
        environmentId = $EnvironmentId
        input         = ( @{
            rootDirectory = $RootDirectory
        } + $(if ($DockerfilePath) { @{ dockerfilePath = $DockerfilePath } } else { @{} }) + $(if ($ConfigFilePath) { @{ railwayConfigFile = $ConfigFilePath } } else { @{} }) )
    }
} | ConvertTo-Json -Depth 6

Write-Host "Updating $ServiceName ($ServiceId) build config..."
$resp = Invoke-RestMethod -Uri 'https://backboard.railway.com/graphql/v2' -Method Post -Headers $headers -Body $body -TimeoutSec 90
if ($resp.errors) {
    Write-Error ($resp.errors | ConvertTo-Json -Depth 5)
}
Write-Host "OK: serviceInstanceUpdate -> $($resp.data.serviceInstanceUpdate)"
Write-Host "Redeploy: railway redeploy -s $ServiceName -y --from-source"
