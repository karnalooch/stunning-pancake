#Requires -Version 5.1
<#
.SYNOPSIS
  Configure prod backend → sim-lab proxy variables on Railway.

.EXAMPLE
  .\infrastructure\sim-lab\scripts\setup-sim-lab-proxy.ps1
  .\infrastructure\sim-lab\scripts\setup-sim-lab-proxy.ps1 -Redeploy
#>
param(
    [string]$ProdProjectId = "ce13089b-76f4-4114-a892-ad13e23c8761",
    [string]$SimLabProjectId = "098b5266-2d8b-43f3-ba29-925aaa6b7b64",
    [string]$SimLabBackendUrl = "https://backend-production-80cf.up.railway.app",
    [string]$ProdBackendService = "Backend",
    [string]$SimLabBackendService = "backend",
    [string]$Environment = "production",
    [string]$WorkspaceId = "8aa1f35e-a716-4526-8209-5aadcaae2246",
    [string]$SecretFile = "",
    [switch]$Redeploy
)

$ErrorActionPreference = "Stop"
$env:CI = "true"
if ($env:RAILWAY_TOKEN) { Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue }
if (-not $env:RAILWAY_API_TOKEN) { throw "Set RAILWAY_API_TOKEN" }

$SimLabRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $SecretFile) {
    $SecretFile = Join-Path $SimLabRoot "railway\proxy.secret"
}

function New-ProxySecret {
    $bytes = New-Object byte[] 48
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Invoke-RailwayQuiet([string[]]$RailwayArgs) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { & railway @RailwayArgs 2>&1 | Out-Null } finally { $ErrorActionPreference = $prev }
}

function Set-BackendVars([string]$ProjectId, [string[]]$Pairs, [string]$Label, [string]$ServiceName) {
    Write-Host "=== $Label (project $ProjectId, service $ServiceName) ===" -ForegroundColor Cyan
    Invoke-RailwayQuiet @("link", "-p", $ProjectId, "-e", $Environment, "-w", $WorkspaceId, "--json")
    foreach ($pair in $Pairs) {
        Invoke-RailwayQuiet @("variable", "set", $pair, "-s", $ServiceName, "-e", $Environment)
        Write-Host "  $ServiceName : $pair"
    }
    if ($Redeploy) {
        Write-Host "  redeploy $ServiceName..."
        Invoke-RailwayQuiet @("redeploy", "-s", $ServiceName, "-y")
    }
}

$secret = $null
if (Test-Path $SecretFile) {
    $secret = (Get-Content $SecretFile -Raw).Trim()
    Write-Host "Using existing secret from $SecretFile"
}
if (-not $secret) {
    $secret = New-ProxySecret
    $dir = Split-Path $SecretFile -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Set-Content -Path $SecretFile -Value $secret -NoNewline -Encoding UTF8
    Write-Host "Generated new proxy secret -> $SecretFile (gitignored)"
}

$base = $SimLabBackendUrl.TrimEnd('/')
$prodVars = @(
    "SIM_LAB_PROXY_ENABLED=1"
    "SIM_LAB_PROXY_BASE_URL=$base"
    "SIM_LAB_PROXY_SECRET=$secret"
    "SIM_LAB_PROXY_PUBLIC_LABEL=4velo-sim-lab"
    "SIM_LAB_PROXY_MAP_TIMEOUT=180"
    "SIM_LAB_PROXY_HEALTH_TIMEOUT=8"
    "SIM_LAB_READ_FEDERATION_ENABLED=1"
    "SIM_LAB_PROXY_STATS_TIMEOUT=15"
    "SIM_LAB_PROXY_STATS_CACHE_TTL=30"
)
$simVars = @(
    "SIM_LAB_ACCEPT_PROXY=1"
    "SIM_LAB_PROXY_SECRET=$secret"
)

Set-BackendVars $ProdProjectId $prodVars "Prod marvelous backend" $ProdBackendService
Set-BackendVars $SimLabProjectId $simVars "Sim-lab backend" $SimLabBackendService

Write-Host "Proxy configured. Verify: GET prod /api/activities/admin/sim-target/ -> mode=sim-lab-proxy" -ForegroundColor Green
