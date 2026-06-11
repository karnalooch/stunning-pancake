#Requires -Version 5.1
<#
.SYNOPSIS
  Sim-lab celery-worker-routing: 8 replicas, 2 vCPU / 2 GB per replica (SSOT: celery-worker-routing/railway.json).

.EXAMPLE
  $env:RAILWAY_API_TOKEN = '...'
  .\infrastructure\sim-lab\scripts\scale-sim-lab-routing.ps1
#>
param(
    [string]$ProjectId = "098b5266-2d8b-43f3-ba29-925aaa6b7b64",
    [string]$Environment = "production",
    [string]$EnvironmentId = "0e5ae720-dd4e-4d09-b6a1-ff4d70bb7b99",
    [string]$ServiceName = "celery-worker-routing",
    [int]$Replicas = 8,
    [string]$Region = "eu-west",
    [switch]$SkipConfigure,
    [switch]$SkipRedeploy
)

$ErrorActionPreference = "Stop"
if (-not $env:RAILWAY_API_TOKEN) {
    $env:RAILWAY_API_TOKEN = [Environment]::GetEnvironmentVariable('RAILWAY_API_TOKEN', 'User')
}
if (-not $env:RAILWAY_API_TOKEN) { throw "Set RAILWAY_API_TOKEN" }
if ($env:RAILWAY_TOKEN) { Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue }
$env:CI = "true"
$WorkspaceId = "8aa1f35e-a716-4526-8209-5aadcaae2246"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
Push-Location $RepoRoot
try {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    railway link -p $ProjectId -e $Environment -w $WorkspaceId --json 2>$null | Out-Null
    $ErrorActionPreference = $prev

    Write-Host "=== Scale $ServiceName -> ${Replicas}x ($Region) ===" -ForegroundColor Cyan
    railway scale -s $ServiceName -e $Environment -p $ProjectId "${Region}=${Replicas}" 2>&1 | Out-Host

    if (-not $SkipConfigure) {
        Write-Host "=== Apply railway.json build config (limitOverride 2 vCPU / 2 GB) ===" -ForegroundColor Cyan
        & (Join-Path $RepoRoot "scripts\railway-configure-service-build.ps1") `
            -ServiceName $ServiceName `
            -EnvironmentId $EnvironmentId `
            -RootDirectory "/" `
            -DockerfilePath "/celery-worker-simulation/Dockerfile" `
            -ConfigFilePath "/celery-worker-routing/railway.json"
    }

    if (-not $SkipRedeploy) {
        Write-Host "=== Redeploy $ServiceName (from railway.json limits) ===" -ForegroundColor Cyan
        Start-Sleep -Seconds 5
        railway redeploy -s $ServiceName -e $Environment -p $ProjectId -y 2>&1
    }

    Write-Host ""
    Write-Host "Dashboard: Replica Limits should show 2 vCPU / 2 GB (not 24/24)." -ForegroundColor Yellow
    Write-Host "If still maxed, set manually then Save - limitOverride applies on git deploy." -ForegroundColor Yellow
    Write-Host "Verify: worker-status shows at least 6 routing workers after deploy." -ForegroundColor Green
} finally {
    Pop-Location
}
