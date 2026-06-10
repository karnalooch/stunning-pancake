# P1 operational gate — criteria 4 & 6 (routing queue + backpressure).
# Prerequisite: live sim running OR use --Once for snapshot-only smoke.
#
# Example (17 min observation, prod):
#   $env:API_BASE = "https://docker-backend-production-123c.up.railway.app/api"
#   $env:ADMIN_USER = "global_owner"
#   $env:ADMIN_PASS = "..."
#   .\scripts\run-simulator-operational-gate.ps1
#
# Quick smoke (single poll):
#   .\scripts\run-simulator-operational-gate.ps1 -Once

param(
    [int]$Minutes = 17,
    [int]$IntervalSeconds = 60,
    [switch]$Once,
    [switch]$SyncSimEnvFirst
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if ($SyncSimEnvFirst) {
    Write-Host "Syncing Railway sim env (cap 200, drain tuning)..." -ForegroundColor Cyan
    & (Join-Path $root "scripts\railway-sync-sim-env.ps1")
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$pyArgs = @(
    (Join-Path $root "scripts\simulator_operational_gate.py"),
    "--minutes", $Minutes,
    "--interval", $IntervalSeconds
)
if ($Once) { $pyArgs += "--once" }

python @pyArgs
$code = $LASTEXITCODE

if ($code -eq 0) {
    Write-Host "`nOperational gate: GO/WARN — record in docs/admin/P1_ROADMAP.md §1b" -ForegroundColor Green
} else {
    Write-Host "`nOperational gate: NO-GO — check report, run railway-sync-sim-env.ps1, retry" -ForegroundColor Red
}
exit $code
