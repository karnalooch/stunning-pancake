#Requires -Version 5.1
<#
.SYNOPSIS
  Read-only audit: marvelous-gratitude prod vs 4velo-sim-lab capacity and proxy wiring.

.EXAMPLE
  .\scripts\railway-audit-prod-simlab.ps1
#>
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

$WorkspaceId = '8aa1f35e-a716-4526-8209-5aadcaae2246'

$Projects = @(
    @{
        Label = 'prod (marvelous-gratitude)'
        Id    = 'ce13089b-76f4-4114-a892-ad13e23c8761'
        Env   = 'production'
        Watch = @('celery-worker-routing', 'osrm', 'brouter-2', 'celery-worker-simulation', 'brouter', 'Backend')
    }
    @{
        Label = 'sim-lab (4velo-sim-lab)'
        Id    = '098b5266-2d8b-43f3-ba29-925aaa6b7b64'
        Env   = 'production'
        Watch = @('celery-worker-routing', 'osrm', 'brouter-2', 'celery-worker-simulation', 'backend')
    }
)

function Get-ServiceBlock {
    param([string]$ListText, [string]$ServiceName)
    $pattern = "(?ms)^\s*$([regex]::Escape($ServiceName))\s*\r?\n(.*?)(?=^\S|\z)"
    if ($ListText -match $pattern) {
        return ($Matches[0]).Trim()
    }
    return $null
}

Push-Location $PSScriptRoot\..
try {
    Write-Host '=== Railway prod / sim-lab audit ===' -ForegroundColor Cyan
    foreach ($proj in $Projects) {
        Write-Host ''
        Write-Host "--- $($proj.Label) ---" -ForegroundColor Yellow
        $prev = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            railway link -p $proj.Id -e $proj.Env -w $WorkspaceId --json 2>$null | Out-Null
            $list = railway service list 2>&1 | Out-String
        } finally {
            $ErrorActionPreference = $prev
        }
        foreach ($name in $proj.Watch) {
            $block = Get-ServiceBlock -ListText $list -ServiceName $name
            if (-not $block) {
                Write-Host "  $name : (not listed)"
                continue
            }
            $status = if ($block -match 'status:\s+(.+)') { $Matches[1].Trim() } else { '?' }
            $replicas = if ($block -match 'replicas:\s+(.+)') { $Matches[1].Trim() } else { '1/1 or n/a' }
            Write-Host "  $name : $status | replicas: $replicas"
        }
    }

    Write-Host ''
    Write-Host '--- prod Backend proxy vars ---' -ForegroundColor Yellow
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        railway link -p ce13089b-76f4-4114-a892-ad13e23c8761 -e production -w $WorkspaceId --json 2>$null | Out-Null
        $backendVars = railway variable list -s Backend -e production 2>&1 | Out-String
    } finally {
        $ErrorActionPreference = $prev
    }
    foreach ($key in @('SIM_LAB_PROXY_ENABLED', 'SIM_LAB_PROXY_BASE_URL', 'SIM_LAB_READ_FEDERATION_ENABLED', 'BROUTER_URL')) {
        if ($backendVars -match "$key") {
            Write-Host "  $key : set"
        } else {
            Write-Host "  $key : MISSING" -ForegroundColor Red
        }
    }

    Write-Host ''
    Write-Host 'Run: .\scripts\railway-set-prod-sim-capacity.ps1 -Profile off-peak' -ForegroundColor Green
    Write-Host 'Run: .\infrastructure\sim-lab\scripts\preflight-sim-lab-readiness.ps1' -ForegroundColor Green
} finally {
    Pop-Location
}
