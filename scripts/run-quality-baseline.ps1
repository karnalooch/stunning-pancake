# Faza 0 — quality baseline for the entire SPORT monorepo.
# Usage: .\scripts\run-quality-baseline.ps1
# See docs/quality/README.md

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$failed = 0

function Step($name, $action) {
    Write-Host "`n=== $name ===" -ForegroundColor Cyan
    & $action
    if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
        Write-Host "FAIL: $name (exit $LASTEXITCODE)" -ForegroundColor Red
        $script:failed++
    } else {
        Write-Host "OK: $name" -ForegroundColor Green
    }
}

Step "backend: ruff check" { ruff check backend }
Step "backend: ruff format --check" { ruff format --check backend }
Step "telemetry: ruff check" { ruff check telemetry }
Step "telemetry: ruff format --check" { ruff format --check telemetry }
Step "scripts: ruff check (maintained)" {
    ruff check scripts --config pyproject.toml
}
Step "telemetry: pytest" { python -m pytest telemetry -q --tb=no }
Step "backend: pytest (light)" {
    Push-Location backend
    python run_pytest.py core/test_load_guard.py activities/test_live_map_read_policy.py activities/test_telemetry_shard.py -m simulator_light -q --tb=no
    Pop-Location
}
Step "docs: link check" { python scripts/check_docs_links.py }
Step "admin: eslint" {
    pnpm --filter admin lint
}
Step "admin: tsc" {
    pnpm --filter admin typecheck
}
Step "mobile: jest" {
    pnpm --filter mobile test -- --ci --passWithNoTests
}
Step "repo: tokens check" {
    if (Test-Path package.json) { pnpm tokens:check }
}

Write-Host "`n========================================" -ForegroundColor Cyan
if ($failed -eq 0) {
    Write-Host "Baseline: all steps passed." -ForegroundColor Green
    exit 0
}
Write-Host "Baseline: $failed step(s) failed. See docs/quality/BASELINE.md" -ForegroundColor Red
exit 1
