#Requires -Version 5.1
<#
.SYNOPSIS
  Scale Railway OSRM service replicas 0 or 1 (multi-region, no redeploy of app code).

.PARAMETER Replicas
  0 = stop OSRM container (save RAM); 1 = start.

.EXAMPLE
  .\scripts\railway-osrm-scale.ps1 -Replicas 1
  .\scripts\railway-osrm-scale.ps1 -Replicas 0
#>
param(
    [ValidateSet(0, 1)]
    [int]$Replicas = 1,
    [string]$ServiceName = 'osrm',
    [string]$Environment = 'production',
    [string]$Region = 'europe-west4-drams3a'
)

$ErrorActionPreference = 'Stop'
if (-not $env:RAILWAY_API_TOKEN) {
    Write-Error 'RAILWAY_API_TOKEN required (User env or Railway Variables).'
}

Write-Host "Scaling $ServiceName -> $Region=$Replicas (triggers Railway apply/redeploy)..."
railway service scale --service $ServiceName -e $Environment "${Region}=${Replicas}" 2>&1 | Out-Host
if ($Replicas -eq 1) {
    Write-Host 'OSRM cold start: graph load on volume may take several minutes. Use SCALE_SIM_ROUTING_BACKEND=auto until :5000 is healthy.'
}
