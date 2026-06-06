#Requires -Version 5.1
param(
    [string]$ServiceId = "e44e32d6-3d42-4813-8702-98933d15cfaa",
    [string]$EnvironmentId = "0e5ae720-dd4e-4d09-b6a1-ff4d70bb7b99",
    [double]$VCpu = 4,
    [int]$MemoryGB = 8
)

$ErrorActionPreference = "Stop"
if (-not $env:RAILWAY_API_TOKEN) { throw "Set RAILWAY_API_TOKEN" }

$headers = @{
    Authorization = "Bearer $($env:RAILWAY_API_TOKEN)"
    "Content-Type"  = "application/json"
}

$mutation = @"
mutation serviceInstanceLimitsUpdate(`$input: ServiceInstanceLimitsUpdateInput!) {
  serviceInstanceLimitsUpdate(input: `$input)
}
"@

$body = @{
    query     = $mutation
    variables = @{
        input = @{
            serviceId     = $ServiceId
            environmentId = $EnvironmentId
            vCPUs         = $VCpu
            memoryGB      = $MemoryGB
        }
    }
} | ConvertTo-Json -Depth 6

Write-Host "serviceInstanceLimitsUpdate: ${MemoryGB}GB / ${VCpu} vCPU ..."
$resp = Invoke-RestMethod -Uri "https://backboard.railway.com/graphql/v2" -Method Post -Headers $headers -Body $body -TimeoutSec 90
if ($resp.errors) {
    Write-Error ($resp.errors | ConvertTo-Json -Depth 5)
}
Write-Host "OK: $($resp.data.serviceInstanceLimitsUpdate)"
