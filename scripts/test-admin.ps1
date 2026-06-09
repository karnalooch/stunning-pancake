# Admin Vitest — zawsze z root monorepo (pnpm workspace).
# Usage: .\scripts\test-admin.ps1
#        .\scripts\test-admin.ps1 src/__tests__/liveMapPerformance.test.ts

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$pnpm = "pnpm"
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    $pnpm = "npx"
    $pnpmArgs = @("pnpm@9.15.0")
} else {
    $pnpmArgs = @()
}

Write-Host "=== pnpm install (root monorepo) ===" -ForegroundColor Cyan
& $pnpm @pnpmArgs install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$testArgs = @("--filter", "admin", "test:run")
if ($args.Count -gt 0) {
    $testArgs = @("--filter", "admin", "exec", "vitest", "run") + $args
}

Write-Host "=== vitest admin ===" -ForegroundColor Cyan
& $pnpm @pnpmArgs @testArgs
exit $LASTEXITCODE
