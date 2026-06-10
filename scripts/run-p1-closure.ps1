# P1 code closure - runs everything automatable without prod credentials.
# Prod gates (optional): -P0Smoke -SimulatorGate -RailwayVerify
#
# Example (local code only):
#   .\scripts\run-p1-closure.ps1
#
# Full prod sign-off (requires env vars):
#   $env:ADMIN_URL = "https://admin-production-083b.up.railway.app"
#   $env:ADMIN_PASS_GLOBAL_OWNER = "..."
#   .\scripts\run-p1-closure.ps1 -P0Smoke -SimulatorGate -RailwayVerify

param(
    [switch]$P0Smoke,
    [switch]$SimulatorGate,
    [switch]$RailwayVerify,
    [switch]$SyncSimEnvFirst
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$failures = @()

function Step($name, [scriptblock]$block) {
    Write-Host ""
    Write-Host "=== $name ===" -ForegroundColor Cyan
    try {
        & $block
        if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
            throw "exit $LASTEXITCODE"
        }
        Write-Host "[PASS] $name" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL] $name - $_" -ForegroundColor Red
        $script:failures += $name
    }
}

Step "Admin unit tests (P1)" {
    Push-Location (Join-Path $root "admin")
    try {
        npx vitest run src/__tests__/goHealth.test.ts src/__tests__/tenantDrillDown.test.ts `
            src/__tests__/moderationQueue.test.ts src/__tests__/anomalySeverity.test.ts `
            src/__tests__/DataSourceBanner.test.ts src/__tests__/useTenantScope.test.ts
    } finally {
        Pop-Location
    }
}

Step "Backend P1 pytest" {
    Push-Location (Join-Path $root "backend")
    try {
        python run_pytest.py activities/test_anomaly_queue.py rewards/test_pools.py -q
    } finally {
        Pop-Location
    }
}

Step "Simulator gate smoke (once)" {
    if (-not $env:API_BASE) {
        Write-Host "[SKIP] API_BASE not set - set API_BASE + ADMIN_USER/PASS for live poll" -ForegroundColor Yellow
        return
    }
    python (Join-Path $root "scripts\simulator_operational_gate.py") --once
}

if ($RailwayVerify) {
    Step "Railway production verify" {
        & (Join-Path $root "scripts\railway-verify-production.ps1")
    }
}

if ($P0Smoke) {
    Step "P0 role smoke (Playwright)" {
        & (Join-Path $root "scripts\run-p0-smoke.ps1")
    }
}

if ($SimulatorGate) {
    Step "Simulator operational gate 17min" {
        $gateArgs = @()
        if ($SyncSimEnvFirst) { $gateArgs += "-SyncSimEnvFirst" }
        & (Join-Path $root "scripts\run-simulator-operational-gate.ps1") @gateArgs
    }
}

Write-Host ""
Write-Host "--- P1 closure summary ---" -ForegroundColor Cyan
if ($failures.Count -eq 0) {
    Write-Host "All automated checks PASS." -ForegroundColor Green
    Write-Host "Prod sign-off (if not run): -P0Smoke -SimulatorGate -RailwayVerify" -ForegroundColor Yellow
    Write-Host "Record GO in docs/admin/P0_SMOKE_CHECKLIST.md when prod gates pass." -ForegroundColor Yellow
    exit 0
}

Write-Host ("Failed: " + ($failures -join ", ")) -ForegroundColor Red
exit 1
