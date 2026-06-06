#Requires -Version 5.1
<#
.SYNOPSIS
  Run a performance test suite tier and emit a JSON report.

.EXAMPLE
  .\scripts\load\run-suite.ps1 -Suite smoke
  .\scripts\load\run-suite.ps1 -Suite baseline -Jwt $env:JWT
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("smoke", "baseline", "stress-50k")]
    [string]$Suite,

    [string]$IngestUrl = "http://localhost:8001/api/telemetry/ingest/batch",
    [string]$MapUrl = "http://localhost:8000/api/activities/telemetry/live/",
    [string]$Jwt = "",
    [string]$ReportsDir = "",
    [switch]$SkipPreflight
)

$ErrorActionPreference = "Stop"
$LoadRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $LoadRoot "..\..")
$SuitePath = Join-Path $LoadRoot "suites\$Suite.json"
if (-not $ReportsDir) {
    $ReportsDir = Join-Path $LoadRoot "reports"
}
New-Item -ItemType Directory -Force -Path $ReportsDir | Out-Null

$suiteDef = Get-Content -Path $SuitePath -Raw -Encoding UTF8 | ConvertFrom-Json
$tier = $suiteDef.tier
$startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

function Test-ServiceReachable([string]$Url) {
    try {
        $uri = [Uri]$Url
        $health = if ($uri.AbsolutePath -match "telemetry") {
            "$($uri.Scheme)://$($uri.Host):$($uri.Port)/api/telemetry/health"
        } else {
            "$($uri.Scheme)://$($uri.Host):$($uri.Port)/health/"
        }
        $resp = Invoke-WebRequest -Uri $health -UseBasicParsing -TimeoutSec 5
        return @{ pass = ($resp.StatusCode -eq 200); url = $health; status = $resp.StatusCode }
    } catch {
        return @{ pass = $false; url = $Url; error = $_.Exception.Message }
    }
}

$preflight = @{ pass = $true; checks = @() }
if ($suiteDef.preflight -and -not $SkipPreflight) {
    Write-Host "=== Preflight ==="
    $ingestCheck = Test-ServiceReachable $IngestUrl
    $preflight.checks += @{ name = "telemetry"; result = $ingestCheck }
    $preflight.pass = $preflight.pass -and $ingestCheck.pass
    $mapCheck = Test-ServiceReachable $MapUrl
    $preflight.checks += @{ name = "backend-map"; result = $mapCheck }
    $preflight.pass = $preflight.pass -and $mapCheck.pass
    if (-not $preflight.pass) {
        Write-Warning "Preflight failed - services unreachable. Emitting skipped report."
    }
}

$tools = @()
$metrics = @{}
$ingestScript = Join-Path $RepoRoot "scripts\load-test-telemetry-ingest.py"

foreach ($step in $suiteDef.steps) {
    $toolName = $step.tool
    $params = $step.params
    $optional = [bool]$step.optional
    $requires = @($step.requires_env)
    $missingEnv = @()
    foreach ($envName in $requires) {
        if ($envName -eq "JWT" -and -not $Jwt) { $missingEnv += $envName }
    }
    if ($missingEnv.Count -gt 0) {
        $tools += @{
            name      = $toolName
            skipped   = $true
            error     = "missing env: $($missingEnv -join ', ')"
            exit_code = 0
        }
        continue
    }

    if (-not $preflight.pass) {
        $tools += @{
            name      = $toolName
            skipped   = $true
            error     = "preflight failed"
            exit_code = 0
        }
        continue
    }

    $t0 = Get-Date
    $exitCode = 0
    $jsonOut = Join-Path $ReportsDir "$Suite-$toolName-$((Get-Date).ToString('yyyyMMdd-HHmmss')).json"

    switch ($toolName) {
        "python-ingest" {
            $pyArgs = @(
                $ingestScript,
                "--url", $IngestUrl,
                "--workers", $params.workers,
                "--duration", $params.duration,
                "--batch-size", $params.batch_size,
                "--target-rate", $params.target_rate,
                "--json-out", $jsonOut
            )
            if ($params.skip_map) { $pyArgs += "--skip-map" }
            if ($params.preflight) { $pyArgs += "--preflight" }
            if ($Jwt) { $pyArgs += @("--token", $Jwt) }
            & python @pyArgs
            $exitCode = $LASTEXITCODE
            if (Test-Path $jsonOut) {
                $partial = Get-Content $jsonOut -Raw -Encoding UTF8 | ConvertFrom-Json
                if ($partial.metrics.ingest) { $metrics.ingest = $partial.metrics.ingest }
                if ($partial.metrics.map) { $metrics.map = $partial.metrics.map }
            }
        }
        "python-map" {
            $pyArgs = @(
                $ingestScript,
                "--map-only",
                "--map-url", $MapUrl,
                "--map-workers", $params.map_workers,
                "--map-duration", $params.map_duration,
                "--json-out", $jsonOut
            )
            if ($Jwt) { $pyArgs += @("--token", $Jwt) }
            & python @pyArgs
            $exitCode = $LASTEXITCODE
            if (Test-Path $jsonOut) {
                $partial = Get-Content $jsonOut -Raw -Encoding UTF8 | ConvertFrom-Json
                if ($partial.metrics.map) { $metrics.map = $partial.metrics.map }
            }
        }
        "k6-ingest" {
            $k6Script = Join-Path $LoadRoot "k6\ingest-batch.js"
            $env:INGEST_URL = $IngestUrl
            $env:BATCH_SIZE = "$($params.batch_size)"
            $env:VUS = "$($params.vus)"
            $env:DURATION = "$($params.duration)"
            if ($params.ingest_pps_min) { $env:INGEST_PPS_MIN = "$($params.ingest_pps_min)" }
            $k6 = Get-Command k6 -ErrorAction SilentlyContinue
            if (-not $k6) {
                $tools += @{ name = $toolName; skipped = $true; error = "k6 not installed"; exit_code = 0 }
                continue
            }
            & k6 run $k6Script
            $exitCode = $LASTEXITCODE
        }
        "k6-map" {
            $k6Script = Join-Path $LoadRoot "k6\live-map.js"
            $env:MAP_URL = $MapUrl
            $env:JWT = $Jwt
            $env:VUS = "$($params.vus)"
            $env:DURATION = "$($params.duration)"
            $env:MAP_P95_MAX = "$($params.map_p95_max)"
            $k6 = Get-Command k6 -ErrorAction SilentlyContinue
            if (-not $k6) {
                $tools += @{ name = $toolName; skipped = $true; error = "k6 not installed"; exit_code = 0 }
                continue
            }
            & k6 run $k6Script
            $exitCode = $LASTEXITCODE
        }
        default {
            $tools += @{ name = $toolName; skipped = $true; error = "unknown tool"; exit_code = 1 }
            continue
        }
    }

    $durationS = ((Get-Date) - $t0).TotalSeconds
    $tools += @{
        name       = $toolName
        exit_code  = $exitCode
        duration_s = [math]::Round($durationS, 2)
        json_out   = $(if (Test-Path $jsonOut) { $jsonOut } else { $null })
    }
    if ($exitCode -ne 0 -and -not $optional) {
        Write-Warning "Step $toolName failed with exit $exitCode"
    }
}

$finishedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$reportOut = Join-Path $ReportsDir "$Suite-$($finishedAt.Replace(':',''))"
$finalize = Join-Path $LoadRoot "finalize_suite_report.py"

$toolsJson = (ConvertTo-Json $tools -Compress -Depth 8)
$metricsJson = (ConvertTo-Json $metrics -Compress -Depth 8)
$preflightJson = (ConvertTo-Json $preflight -Compress -Depth 8)

& python $finalize `
    --suite $Suite `
    --tier $tier `
    --started-at $startedAt `
    --finished-at $finishedAt `
    --ingest-url $IngestUrl `
    --map-url $MapUrl `
    --target $suiteDef.environment.target `
    --tools-json $toolsJson `
    --metrics-json $metricsJson `
    --preflight-json $preflightJson `
    --out "$reportOut.json"

if ($LASTEXITCODE -eq 2) { exit 2 }
