#Requires -Version 5.1
<#
.SYNOPSIS
  Local S0 pre-flight: pytest, typecheck, seed smoke users, p0-role-smoke (starts dev servers).
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$env:SECRET_KEY = if ($env:SECRET_KEY) { $env:SECRET_KEY } else { 'local-s0-secret' }
$env:DEBUG = '1'
$defaultDb = 'sqlite:///' + (Join-Path $Root 'backend\s0_gate.sqlite3').Replace('\', '/')
$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { $defaultDb }
$env:REDIS_URL = if ($env:REDIS_URL) { $env:REDIS_URL } else { 'redis://127.0.0.1:6379/15' }
$smokePass = if ($env:SMOKE_PASSWORD) { $env:SMOKE_PASSWORD } else { 'SmokeTest123!' }

Write-Host '=== S0: simulator_light pytest ===' -ForegroundColor Cyan
Push-Location backend
python run_pytest.py -m simulator_light -q
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
python run_pytest.py activities/tests/test_moderation_scope.py rewards/tests/test_sponsor_scope.py -q
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
Pop-Location

Write-Host '=== S0: admin typecheck ===' -ForegroundColor Cyan
Push-Location admin
npm run typecheck
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
Pop-Location

Write-Host '=== S0: platform audit (quick) ===' -ForegroundColor Cyan
pnpm audit:platform:quick
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host '=== S0: migrate + seed smoke users ===' -ForegroundColor Cyan
Push-Location backend
python run_manage.py migrate --noinput
python run_manage.py seed_smoke_users
Pop-Location

$adminPort = if ($env:ADMIN_DEV_PORT) { $env:ADMIN_DEV_PORT } else { '5173' }
$apiPort = if ($env:API_DEV_PORT) { $env:API_DEV_PORT } else { '8000' }

Write-Host "=== S0: starting backend :$apiPort and admin :$adminPort ===" -ForegroundColor Cyan
$backendJob = Start-Job -ScriptBlock {
    param($root, $port, $dbUrl, $redisUrl)
    Set-Location "$root\backend"
    $env:SECRET_KEY = 'local-s0-secret'
    $env:DEBUG = '1'
    $env:DATABASE_URL = $dbUrl
    $env:REDIS_URL = $redisUrl
    python run_manage.py runserver "127.0.0.1:$port"
} -ArgumentList $Root, $apiPort, $env:DATABASE_URL, $env:REDIS_URL

$adminJob = Start-Job -ScriptBlock {
    param($root, $port)
    Set-Location "$root\admin"
    $env:VITE_API_URL = "http://127.0.0.1:8000"
    npm run dev -- --host 127.0.0.1 --port $port
} -ArgumentList $Root, $adminPort

function Wait-HttpOk {
    param([string]$Url, [int]$TimeoutSec = 120)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
        } catch { }
        Start-Sleep -Seconds 2
    }
    return $false
}

if (-not (Wait-HttpOk -Url "http://127.0.0.1:$apiPort/health/")) {
    Stop-Job $backendJob, $adminJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob, $adminJob -Force -ErrorAction SilentlyContinue
    Write-Error "Backend did not become ready on :$apiPort"
}
if (-not (Wait-HttpOk -Url "http://127.0.0.1:$adminPort")) {
    Stop-Job $backendJob, $adminJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob, $adminJob -Force -ErrorAction SilentlyContinue
    Write-Error "Admin dev server did not become ready on :$adminPort"
}

$env:ADMIN_URL = "http://127.0.0.1:$adminPort"
$env:ADMIN_USER_GLOBAL_OWNER = 'global_owner'
$env:ADMIN_PASS_GLOBAL_OWNER = $smokePass
$env:ADMIN_USER_TENANT_ADMIN = 'tenant_admin'
$env:ADMIN_PASS_TENANT_ADMIN = $smokePass
$env:ADMIN_USER_MODERATOR = 'tenant_moderator'
$env:ADMIN_PASS_MODERATOR = $smokePass
$env:ADMIN_USER_SPONSOR = 'sponsor_user'
$env:ADMIN_PASS_SPONSOR = $smokePass
$env:P0_SMOKE_REPORT = Join-Path $Root 'admin\audit-screenshots\p0-smoke-report.json'

Write-Host '=== S0: p0-role-smoke ===' -ForegroundColor Cyan
Push-Location admin
node scripts/p0-role-smoke.mjs
$smokeExit = $LASTEXITCODE
Pop-Location

Stop-Job $backendJob, $adminJob -ErrorAction SilentlyContinue
Remove-Job $backendJob, $adminJob -Force -ErrorAction SilentlyContinue

if ($smokeExit -ne 0) { exit $smokeExit }
Write-Host '=== S0 local gate: PASS ===' -ForegroundColor Green
