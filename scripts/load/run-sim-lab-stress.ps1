#Requires -Version 5.1
<#
.SYNOPSIS
  Run stress-50k suite against sim-lab backend + telemetry.

.EXAMPLE
  $env:SIM_LAB_API_BASE = 'https://backend-production-80cf.up.railway.app/api'
  $env:ADMIN_PASS = 'admin123'
  .\scripts\load\run-sim-lab-stress.ps1
#>
param(
    [string]$ApiBase = "",
    [string]$Password = "",
    [ValidateSet("smoke", "baseline", "stress-50k")]
    [string]$Suite = "stress-50k"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "..\..\infrastructure\sim-lab\scripts\_sim-lab-resolve.ps1")
$ApiBase = Resolve-SimLabApiBase -ApiBase $ApiBase
Test-ProdApiGuard -ApiBase $ApiBase

if (-not $Password) { $Password = $env:ADMIN_PASS }
if (-not $Password) { throw "Set ADMIN_PASS" }

$root = $ApiBase -replace '/api$', ''
$telemetryRoot = if ($env:SIM_LAB_TELEMETRY_URL) { $env:SIM_LAB_TELEMETRY_URL.TrimEnd('/') } else { $root -replace 'backend-production-80cf', 'telemetry-production' }
if ($telemetryRoot -eq ($root -replace '/api$', '')) {
    $telemetryRoot = "https://telemetry-production.up.railway.app"
}

$authBody = @{ username = "global_owner"; password = $Password } | ConvertTo-Json
$token = (Invoke-RestMethod -Uri "$ApiBase/auth/token/" -Method POST -ContentType "application/json" -Body $authBody -TimeoutSec 120).access

$ingestUrl = "$telemetryRoot/api/telemetry/ingest/batch"
$mapUrl = "$ApiBase/activities/telemetry/live/"

Write-Host "Suite=$Suite ingest=$ingestUrl map=$mapUrl" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "run-suite.ps1") -Suite $Suite -IngestUrl $ingestUrl -MapUrl $mapUrl -Jwt $token
