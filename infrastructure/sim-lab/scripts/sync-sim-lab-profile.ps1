#Requires -Version 5.1
<#
.SYNOPSIS
  Apply sim-lab SCALE_* profile to Railway sim-lab project (NOT prod).

.PARAMETER Profile
  smoke | 300k-50k (files in railway/profiles/)

.EXAMPLE
  railway link -p <SIM_LAB_PROJECT_ID> -e production
  .\infrastructure\sim-lab\scripts\sync-sim-lab-profile.ps1 -Profile 300k-50k
#>
param(
    [ValidateSet("smoke", "300k-50k")]
    [string]$Profile = "300k-50k",
    [string]$ProjectId = "",
    [string]$Environment = "production",
    [switch]$SkipDeploys
)

$ErrorActionPreference = "Stop"
function Invoke-RailwayQuiet([string[]]$Args) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { & railway @Args 2>&1 | Out-Null } finally { $ErrorActionPreference = $prev }
}
$SimLabRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ProfilePath = Join-Path $SimLabRoot "railway\profiles\$Profile.env"
if (-not (Test-Path $ProfilePath)) { throw "Missing profile: $ProfilePath" }

if (-not $ProjectId) { $ProjectId = $env:SIM_LAB_PROJECT_ID }
if (-not $ProjectId) { throw "Set SIM_LAB_PROJECT_ID or -ProjectId" }

if ($env:RAILWAY_TOKEN) { Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue }

Push-Location (Join-Path $SimLabRoot "..\..")
try {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    Invoke-RailwayQuiet @("link", "-p", $ProjectId, "-e", $Environment, "-w", "8aa1f35e-a716-4526-8209-5aadcaae2246", "--json")
    $ErrorActionPreference = $prevEap

    $extra = @()
    if ($SkipDeploys) { $extra = @("--skip-deploys") }

    $services = @(
        "backend",
        "celery-worker-simulation",
        "celery-worker-routing",
        "celery-worker",
        "telemetry"
    )

    $lines = Get-Content $ProfilePath | Where-Object { $_ -and $_ -notmatch '^\s*#' }
    Write-Host "=== Sim-lab profile: $Profile ===" -ForegroundColor Cyan
    foreach ($svc in $services) {
        foreach ($line in $lines) {
            if ($line -notmatch '=') { continue }
            Invoke-RailwayQuiet @("variable", "set", $line, "-s", $svc, "-e", $Environment) + $extra
            Write-Host "  $svc : $line"
        }
    }
    Write-Host "Done. Redeploy simulation + routing workers if not using -SkipDeploys." -ForegroundColor Green
} finally {
    Pop-Location
}
