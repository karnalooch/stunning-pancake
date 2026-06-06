#Requires -Version 5.1
<#
.SYNOPSIS
  Sim-lab backend: 8 GB RAM / 4 vCPU (50k map reads + UVICORN_WORKERS=4).

.EXAMPLE
  $env:RAILWAY_API_TOKEN = '...'
  .\infrastructure\sim-lab\scripts\scale-sim-lab-backend.ps1
#>
param(
    [string]$ProjectId = "098b5266-2d8b-43f3-ba29-925aaa6b7b64",
    [string]$Environment = "production",
    [string]$EnvironmentId = "0e5ae720-dd4e-4d09-b6a1-ff4d70bb7b99",
    [string]$ServiceName = "backend",
    [string]$ServiceId = "e44e32d6-3d42-4813-8702-98933d15cfaa",
    [switch]$SkipRedeploy
)

$ErrorActionPreference = "Stop"
if (-not $env:RAILWAY_API_TOKEN) { throw "Set RAILWAY_API_TOKEN" }
if ($env:RAILWAY_TOKEN) { Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue }
$env:CI = "true"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$ConfigPath = "/infrastructure/sim-lab/railway/backend.railway.json"
$RailwayEap = "Continue"

function Invoke-Railway([string[]]$RailwayArgs) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = $RailwayEap
    try {
        & railway @RailwayArgs 2>&1
        return $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prev
    }
}

Push-Location $RepoRoot
try {
    Write-Host "=== Sim-lab backend: 8 GB / 4 vCPU ===" -ForegroundColor Cyan
    & (Join-Path $RepoRoot "scripts\railway-configure-service-build.ps1") `
        -ServiceId $ServiceId `
        -ServiceName $ServiceName `
        -EnvironmentId $EnvironmentId `
        -RootDirectory "/backend" `
        -DockerfilePath "/backend/Dockerfile" `
        -ConfigFilePath $ConfigPath

    & (Join-Path $RepoRoot "scripts\railway-set-service-limits.ps1") `
        -ServiceId $ServiceId `
        -EnvironmentId $EnvironmentId `
        -MemoryGB 8 `
        -VCpu 4

    if (-not $SkipRedeploy) {
        Write-Host "=== Redeploy backend ===" -ForegroundColor Cyan
        Start-Sleep -Seconds 3
        Invoke-Railway @(
            "redeploy", "-s", $ServiceName,
            "-e", $Environment, "-p", $ProjectId, "-y"
        ) | Out-Host
    }

    Write-Host ""
    Write-Host "Dashboard Replica Limits: set ceiling to 4 vCPU / 8 GB (not 24/24)." -ForegroundColor Yellow
    Write-Host "Verify: GET .../activities/telemetry/live/?limit=5000 returns 200 after deploy." -ForegroundColor Green
} finally {
    Pop-Location
}
