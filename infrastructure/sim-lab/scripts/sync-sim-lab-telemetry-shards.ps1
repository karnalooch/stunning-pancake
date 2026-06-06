#Requires -Version 5.1
<#
.SYNOPSIS
  Set REDIS_TELEMETRY_SHARD_NODES (Phase 2a: logical DBs on one Redis) for sim-lab.

.EXAMPLE
  .\infrastructure\sim-lab\scripts\sync-sim-lab-telemetry-shards.ps1
#>
param(
    [string]$ProjectId = "098b5266-2d8b-43f3-ba29-925aaa6b7b64",
    [string]$Environment = "production",
    [int]$ShardCount = 4,
    [switch]$SkipDeploys
)

$ErrorActionPreference = "Stop"
$env:CI = "true"
if ($env:RAILWAY_TOKEN) { Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue }
if (-not $env:RAILWAY_API_TOKEN) { throw "Set RAILWAY_API_TOKEN" }

function Invoke-RailwayQuiet([string[]]$RailwayArgs) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { & railway @RailwayArgs 2>&1 | Out-Null } finally { $ErrorActionPreference = $prev }
}

function Get-RedisUrlFromRailway {
    $tmp = Join-Path $env:TEMP ("railway-redis-{0}.txt" -f [guid]::NewGuid().ToString("n"))
    try {
        Invoke-RailwayQuiet @("variable", "get", "REDIS_URL", "-s", "backend", "-e", $Environment, "--json")
        & railway variable get REDIS_URL -s backend -e $Environment 2>$null | Out-File -FilePath $tmp -Encoding utf8
        $raw = (Get-Content $tmp -Raw).Trim()
        if ($raw -match '^redis://') { return $raw }
        if ($raw -match 'redis://[^\s"]+') { return $Matches[0] }
        throw "Could not parse REDIS_URL from railway output"
    } finally {
        Remove-Item $tmp -ErrorAction SilentlyContinue
    }
}

$SimLabRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Push-Location (Join-Path $SimLabRoot "..\..")
try {
    Invoke-RailwayQuiet @("link", "-p", $ProjectId, "-e", $Environment, "-w", "8aa1f35e-a716-4526-8209-5aadcaae2246", "--json")

    $redisUrl = Get-RedisUrlFromRailway
    $uri = [Uri]$redisUrl
    $userInfo = $uri.UserInfo
    $hostPort = $uri.Host
    $scheme = $uri.Scheme

    $nodes = @()
    for ($i = 0; $i -lt $ShardCount; $i++) {
        if ($userInfo) {
            $nodes += "${scheme}://${userInfo}@${hostPort}/$i"
        } else {
            $nodes += "${scheme}://${hostPort}/$i"
        }
    }
    $nodesStr = $nodes -join ','
    $extra = @()
    if ($SkipDeploys) { $extra = @("--skip-deploys") }

    $services = @("backend", "celery-worker-simulation")
    Write-Host "=== Telemetry shards Phase 2a ===" -ForegroundColor Cyan
    Write-Host "REDIS_TELEMETRY_SHARD_NODES=$nodesStr"
    foreach ($svc in $services) {
        Invoke-RailwayQuiet @("variable", "set", "TELEMETRY_SHARD_COUNT=$ShardCount", "-s", $svc, "-e", $Environment) + $extra
        Invoke-RailwayQuiet @("variable", "set", "REDIS_TELEMETRY_SHARD_NODES=$nodesStr", "-s", $svc, "-e", $Environment) + $extra
        Invoke-RailwayQuiet @("variable", "set", "TELEMETRY_SHARD_READ_WORKERS=8", "-s", $svc, "-e", $Environment) + $extra
        Write-Host "  $svc : shards OK"
    }
    Write-Host "Done." -ForegroundColor Green
} finally {
    Pop-Location
}
