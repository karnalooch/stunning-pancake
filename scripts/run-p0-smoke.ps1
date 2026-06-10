# P0 role smoke — wrapper for Windows (operational gate criterion #3).
# Requires Playwright + admin credentials per role.
#
# Example:
#   $env:ADMIN_URL = "https://admin-production-083b.up.railway.app"
#   $env:ADMIN_USER_GLOBAL_OWNER = "global_owner"
#   $env:ADMIN_PASS_GLOBAL_OWNER = "..."
#   .\scripts\run-p0-smoke.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $root "admin")
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js is required."
    }
    node scripts/p0-role-smoke.mjs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "`nP0 smoke: PASS — record GO in docs/admin/P0_SMOKE_CHECKLIST.md" -ForegroundColor Green
} finally {
    Pop-Location
}
