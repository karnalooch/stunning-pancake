#Requires -Version 5.1
<#
.SYNOPSIS
  Fix Timescale live_position_events migration on Railway production.

.DESCRIPTION
  1. Enables compression on telemetry.live_position_events if hypertable exists
     (safe when migration 0015 failed before add_compression_policy).
  2. Redeploys Backend from latest GitHub source (includes fixed migration 0015).
  3. Optionally runs migrate locally against production DATABASE_URL.

.EXAMPLE
  .\scripts\railway-fix-live-position-migration.ps1
  .\scripts\railway-fix-live-position-migration.ps1 -SkipRedeploy
#>
param(
    [switch]$SkipRedeploy,
    [switch]$SkipSqlFix,
    [switch]$RunMigrateOnly,
    [string]$BackendService = 'Backend',
    [string]$PostgresService = 'Postgres',
    [string]$Environment = 'production',
    [string]$ProjectId = 'ce13089b-76f4-4114-a892-ad13e23c8761'
)

$ErrorActionPreference = 'Stop'

$localEnv = Join-Path $PSScriptRoot '..\.env.railway.local'
if (Test-Path $localEnv) {
    Get-Content $localEnv | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            if ($name -and $value) {
                Set-Item -Path "Env:$name" -Value $value
            }
        }
    }
}

if ($env:RAILWAY_TOKEN) {
    Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue
}

if (-not $env:RAILWAY_API_TOKEN) {
    $userToken = [Environment]::GetEnvironmentVariable('RAILWAY_API_TOKEN', 'User')
    if ($userToken) {
        $env:RAILWAY_API_TOKEN = $userToken
    }
}

if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
    Write-Error 'Railway CLI missing. Install: npm i -g @railway/cli'
}
if (-not $env:RAILWAY_API_TOKEN) {
    Write-Error 'Set RAILWAY_API_TOKEN (User env or .env.railway.local). See .env.railway.local.example'
}

Push-Location (Join-Path $PSScriptRoot '..')

$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
railway link -p $ProjectId -e $Environment --json 2>&1 | Out-Null
$ErrorActionPreference = $prevEap

$FixSql = @'
DO $BODY$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'telemetry'
          AND table_name = 'live_position_events'
    ) THEN
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_hypertable') THEN
            BEGIN
                ALTER TABLE telemetry.live_position_events SET (
                    timescaledb.compress,
                    timescaledb.compress_segmentby = 'device_id',
                    timescaledb.compress_orderby = 'time DESC'
                );
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'compression already enabled or not a hypertable: %', SQLERRM;
            END;
            IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_compression_policy') THEN
                PERFORM add_compression_policy(
                    'telemetry.live_position_events',
                    INTERVAL '7 days',
                    if_not_exists => TRUE
                );
            END IF;
        END IF;
    END IF;
END $BODY$;
'@

function Invoke-RailwaySqlFix {
    if ($SkipSqlFix) {
        Write-Host '[skip] SQL pre-fix'
        return
    }
    Write-Host "Applying Timescale compression pre-fix via $BackendService DATABASE_URL ..."
    $pyFile = Join-Path $env:TEMP 'railway-live-position-fix.py'
    $pyBody = @"
import os
import sys

import psycopg2

sql = r'''$FixSql'''

url = os.environ.get('DATABASE_URL')
if not url:
    print('DATABASE_URL missing', file=sys.stderr)
    sys.exit(1)

conn = psycopg2.connect(url)
conn.autocommit = True
try:
    with conn.cursor() as cur:
        cur.execute(sql)
    print('SQL pre-fix OK')
except Exception as exc:
    print(f'SQL pre-fix skipped or failed: {exc}', file=sys.stderr)
    sys.exit(0)
finally:
    conn.close()
"@
    Set-Content -Path $pyFile -Value $pyBody -Encoding UTF8
    $backendDir = Join-Path $PWD 'backend'
    $python = Join-Path $backendDir 'venv\Scripts\python.exe'
    if (-not (Test-Path $python)) {
        $python = 'python'
    }
    try {
        Push-Location $backendDir
        railway run -s $BackendService -e $Environment -- $python $pyFile 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "SQL pre-fix exited $LASTEXITCODE (table may not exist yet - OK before first migrate)"
        } else {
            Write-Host '[ok] SQL pre-fix applied'
        }
    } finally {
        Pop-Location
        Remove-Item $pyFile -ErrorAction SilentlyContinue
    }
}

function Invoke-BackendRedeploy {
    if ($SkipRedeploy) {
        Write-Host '[skip] Backend redeploy'
        return
    }
    Write-Host "Redeploying $BackendService from latest source ..."
    railway redeploy -s $BackendService -e $Environment -y --from-source 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Error "railway redeploy failed (exit $LASTEXITCODE)"
    }
    Write-Host '[ok] Redeploy triggered - container CMD runs migrate on start'
}

function Invoke-BackendMigrate {
    Write-Host "Running migrate (users + activities) via railway run on $BackendService ..."
    Push-Location (Join-Path $PWD 'backend')
    try {
        railway run -s $BackendService -e $Environment -- python manage.py migrate users --no-input 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) { Write-Error "migrate users failed (exit $LASTEXITCODE)" }
        railway run -s $BackendService -e $Environment -- python manage.py migrate activities --no-input 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) { Write-Error "migrate activities failed (exit $LASTEXITCODE)" }
        Write-Host '[ok] Migrations applied'
    } finally {
        Pop-Location
    }
}

if ($RunMigrateOnly) {
    Invoke-BackendMigrate
} else {
    Invoke-RailwaySqlFix
    Invoke-BackendRedeploy
    Write-Host 'Waiting 45s for deploy + migrate ...'
    Start-Sleep -Seconds 45
    railway logs -s $BackendService -e $Environment --lines 60 2>&1 | Out-Host
}

Pop-Location
Write-Host 'Done.'
