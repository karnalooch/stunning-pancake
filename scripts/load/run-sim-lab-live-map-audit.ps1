#Requires -Version 5.1
<#
.SYNOPSIS
  Sim-lab Live Map audit: API map p95 (stress-50k tier) + optional WebGL admin audit.

.DESCRIPTION
  Layer A: python load-test-telemetry-ingest.py --map-only (p95 vs thresholds.json stress-50k)
  Layer B: admin/scripts/audit-webgl-live-map.mjs (--prod against admin URL)

.EXAMPLE
  $env:ADMIN_PASS = 'admin123'
  .\scripts\load\run-sim-lab-live-map-audit.ps1

.EXAMPLE
  .\scripts\load\run-sim-lab-live-map-audit.ps1 -SkipWebGl -MapWorkers 20 -MapDuration 45
#>
param(
    [string]$ApiBase = "",
    [string]$ProdProxyApiBase = "",
    [string]$AdminUrl = "",
    [string]$Password = "",
    [int]$MapWorkers = 15,
    [int]$MapDuration = 30,
    [switch]$SkipWebGl,
    [switch]$SkipMapBench,
    [switch]$IncludeProdProxy,
    [int]$HealthWaitSec = 180
)

$ErrorActionPreference = "Stop"
$LoadRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $LoadRoot "..\..")
. (Join-Path $RepoRoot "infrastructure\sim-lab\scripts\_sim-lab-resolve.ps1")

$ApiBase = Resolve-SimLabApiBase -ApiBase $ApiBase
Test-ProdApiGuard -ApiBase $ApiBase
if (-not $Password) { $Password = $env:ADMIN_PASS }
if (-not $Password) { throw "Set ADMIN_PASS" }

if (-not $AdminUrl) {
    $AdminUrl = $env:SIM_LAB_ADMIN_URL
    if (-not $AdminUrl) { $AdminUrl = $env:ADMIN_URL }
    if (-not $AdminUrl) { $AdminUrl = "https://admin-production-083b.up.railway.app" }
}
$AdminUrl = $AdminUrl.TrimEnd('/')

$reportsDir = Join-Path $LoadRoot "reports"
New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$reportPath = Join-Path $reportsDir "sim-lab-live-map-audit-$ts.json"

$thresholds = Get-Content (Join-Path $LoadRoot "thresholds.json") -Raw | ConvertFrom-Json
$mapP95Max = [int]$thresholds.tiers.'stress-50k'.map_p95_ms_max

$backendRoot = $ApiBase -replace '/api$', ''
$mapUrl = "$ApiBase/activities/telemetry/live/?zoom=6&limit=50000"

function Invoke-MapProbe([string]$Label, [string]$Url, [string]$Jwt) {
    try {
        $sw = [Diagnostics.Stopwatch]::StartNew()
        $r = Invoke-WebRequest -Uri $Url -Headers @{ Authorization = "Bearer $Jwt" } -UseBasicParsing -TimeoutSec 180
        $sw.Stop()
        $bytes = [int]$r.RawContentLength
        if ($bytes -le 0) { $bytes = [Text.Encoding]::UTF8.GetByteCount($r.Content) }
        $meta = $null
        try {
            $parsed = $r.Content | ConvertFrom-Json
            $meta = @{
                returned       = @($parsed.positions).Count
                total_estimate = $parsed.meta.total_estimate
                ingest_engaged = $parsed.meta.ingest_engaged
            }
        } catch { }
        return @{
            label   = $Label
            url     = $Url
            ok      = $true
            ttfb_ms = [int]$sw.ElapsedMilliseconds
            bytes   = $bytes
            status  = [int]$r.StatusCode
            meta    = $meta
        }
    } catch {
        $status = $null
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        return @{
            label   = $Label
            url     = $Url
            ok      = $false
            status  = $status
            error   = $_.Exception.Message
        }
    }
}

function Run-MapBench([string]$Label, [string]$Base, [string]$Jwt, [string]$JsonOut) {
    $url = "$Base/activities/telemetry/live/?zoom=6&limit=50000"
    $ingestPy = Join-Path $RepoRoot "scripts\load-test-telemetry-ingest.py"
    $pyArgs = @(
        $ingestPy,
        "--map-url", $url,
        "--token", $Jwt,
        "--map-workers", "$MapWorkers",
        "--map-duration", "$MapDuration",
        "--map-only",
        "--report-tier", "stress-50k",
        "--report-target", $Label,
        "--json-out", $JsonOut
    )
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & python @pyArgs 2>&1 | ForEach-Object { Write-Host $_ }
    $ErrorActionPreference = $prevEap
    if ($LASTEXITCODE -ne 0) {
        return @{ label = $Label; pass = $false; error = "python exit $LASTEXITCODE"; report = $JsonOut }
    }
    if (-not (Test-Path $JsonOut)) {
        return @{ label = $Label; pass = $false; error = "missing json output"; report = $JsonOut }
    }
    $bench = Get-Content $JsonOut -Raw | ConvertFrom-Json
    $p95 = [double]$bench.metrics.map.latency_ms.p95
    $p50 = [double]$bench.metrics.map.latency_ms.p50
    $errs = [int]$bench.metrics.map.errors
    $pass = ($p95 -gt 0) -and ($p95 -le $mapP95Max) -and ($errs -eq 0)
    return @{
        label      = $Label
        pass       = $pass
        map_p95_ms = $p95
        map_p50_ms = $p50
        map_errors = $bench.metrics.map.errors
        map_ok     = $bench.metrics.map.ok
        threshold  = $bench.threshold_evaluation
        report     = $JsonOut
    }
}

function Wait-BackendHealth {
    $deadline = (Get-Date).AddSeconds($HealthWaitSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $sw = [Diagnostics.Stopwatch]::StartNew()
            $r = Invoke-WebRequest -Uri "$backendRoot/health/" -UseBasicParsing -TimeoutSec 20
            if ($r.StatusCode -eq 200) {
                return @{ ok = $true; ms = [int]$sw.ElapsedMilliseconds }
            }
        } catch {
            Write-Host ("  health wait: {0}" -f $_.Exception.Message)
        }
        Start-Sleep -Seconds 8
    }
    throw "Backend not healthy after ${HealthWaitSec}s ($backendRoot/health/)"
}

Write-Host "=== Sim-lab Live Map audit ===" -ForegroundColor Cyan
Write-Host "  API:   $ApiBase"
Write-Host "  Admin: $AdminUrl"
Write-Host "  SLO:   map p95 <= ${mapP95Max}ms (stress-50k)"

$health = Wait-BackendHealth
Write-Host ("  health OK ({0}ms)" -f $health.ms) -ForegroundColor Green

$authBody = @{ username = "global_owner"; password = $Password } | ConvertTo-Json
$token = (Invoke-RestMethod -Uri "$ApiBase/auth/token/" -Method POST -ContentType "application/json" -Body $authBody -TimeoutSec 120).access

$liveSim = $null
try {
    $hdr = @{ Authorization = "Bearer $token" }
    $liveSim = Invoke-RestMethod -Uri "$ApiBase/activities/admin/live-simulate/" -Headers $hdr -TimeoutSec 60
    Write-Host ("  live sim: active={0}/{1}" -f $liveSim.ride_active, $liveSim.target_on_map) -ForegroundColor DarkGray
} catch {
    Write-Host "  live sim status: unavailable" -ForegroundColor DarkYellow
}

$report = @{
    started_at = (Get-Date).ToUniversalTime().ToString("o")
    api_base   = $ApiBase
    admin_url  = $AdminUrl
    slo        = @{ tier = "stress-50k"; map_p95_ms_max = $mapP95Max }
    health_ms  = $health.ms
    live_sim   = if ($liveSim) { @{ active = $liveSim.ride_active; target = $liveSim.target_on_map; running = $liveSim.running } } else { $null }
    layers     = @{}
}

# --- Layer A0: single-request probe (payload / TTFB) ---
if (-not $SkipMapBench) {
    Write-Host "`n--- Layer A0: map probe (payload / TTFB) ---" -ForegroundColor Cyan
    $probes = @()
    $probes += Invoke-MapProbe "sim-lab-direct" $mapUrl $token
    if ($IncludeProdProxy -or $ProdProxyApiBase) {
        if (-not $ProdProxyApiBase) { $ProdProxyApiBase = "https://backend-production-55c7.up.railway.app/api" }
        $prodAuth = Invoke-RestMethod -Uri "$ProdProxyApiBase/auth/token/" -Method POST -ContentType "application/json" -Body $authBody -TimeoutSec 120
        $prodUrl = "$ProdProxyApiBase/activities/telemetry/live/?zoom=6&limit=50000"
        $probes += Invoke-MapProbe "prod-proxy" $prodUrl $prodAuth.access
    }
    $report.layers.map_probe = $probes
    foreach ($p in $probes) {
        if (-not $p.ok) {
            Write-Host ("  {0}: FAIL status={1} {2}" -f $p.label, $p.status, $p.error) -ForegroundColor Red
            continue
        }
        $kb = [math]::Round($p.bytes / 1KB, 1)
        $ret = if ($p.meta.returned) { $p.meta.returned } else { "?" }
        Write-Host ("  {0}: {1}ms {2}KB returned={3}" -f $p.label, $p.ttfb_ms, $kb, $ret)
    }
}

# --- Layer A: map API p95 ---
if (-not $SkipMapBench) {
    Write-Host "`n--- Layer A: map API p95 (sim-lab direct) ---" -ForegroundColor Cyan
    $jsonOut = Join-Path $reportsDir "sim-lab-map-only-$ts.json"
    $direct = Run-MapBench "sim-lab-direct" $ApiBase $token $jsonOut
    $report.layers.map_api = $direct
    if ($direct.error) {
        Write-Host ("  sim-lab map bench FAIL: {0}" -f $direct.error) -ForegroundColor Red
    } else {
        $color = if ($direct.pass) { "Green" } else { "Red" }
        Write-Host ("  sim-lab map p95={0}ms (target <={1}ms) -> {2}" -f $direct.map_p95_ms, $mapP95Max, $(if ($direct.pass) { "PASS" } else { "FAIL" })) -ForegroundColor $color
    }

    if ($IncludeProdProxy -or $ProdProxyApiBase) {
        Write-Host "`n--- Layer A': map API p95 (prod proxy) ---" -ForegroundColor Cyan
        if (-not $ProdProxyApiBase) { $ProdProxyApiBase = "https://backend-production-55c7.up.railway.app/api" }
        $prodToken = (Invoke-RestMethod -Uri "$ProdProxyApiBase/auth/token/" -Method POST -ContentType "application/json" -Body $authBody -TimeoutSec 120).access
        $jsonOutProd = Join-Path $reportsDir "prod-proxy-map-only-$ts.json"
        $proxy = Run-MapBench "prod-proxy" $ProdProxyApiBase $prodToken $jsonOutProd
        $report.layers.map_api_prod_proxy = $proxy
        if ($proxy.error) {
            Write-Host ("  prod-proxy map bench FAIL: {0}" -f $proxy.error) -ForegroundColor Red
        } else {
            $color2 = if ($proxy.pass) { "Green" } else { "Red" }
            Write-Host ("  prod-proxy map p95={0}ms -> {1}" -f $proxy.map_p95_ms, $(if ($proxy.pass) { "PASS" } else { "FAIL" })) -ForegroundColor $color2
        }
    }
}

# --- Layer B: WebGL admin audit ---
if (-not $SkipWebGl) {
    Write-Host "`n--- Layer B: WebGL admin audit ---" -ForegroundColor Cyan
    $adminDir = Join-Path $RepoRoot "admin"
    $auditScript = Join-Path $adminDir "scripts\audit-webgl-live-map.mjs"
    if (-not (Test-Path $auditScript)) { throw "Missing $auditScript" }
    Push-Location $adminDir
    try {
        $env:ADMIN_PASS = $Password
        $env:ADMIN_URL = $AdminUrl
        & node $auditScript --prod
        $webglReport = Join-Path $adminDir "audit-screenshots\webgl-audit-report.json"
        if (Test-Path $webglReport) {
            $report.layers.webgl = Get-Content $webglReport -Raw | ConvertFrom-Json
        } else {
            $report.layers.webgl = @{ note = "webgl-audit-report.json not found" }
        }
    } finally {
        Pop-Location
    }
}

$report.diagnosis = @()
if ($report.layers.map_probe | Where-Object { -not $_.ok }) {
    $report.diagnosis += "Layer A0: telemetry/live returned 5xx - check backend OOM (uvicorn worker SIGKILL) and RAM sizing."
}
if ($report.layers.map_api.error) {
    $report.diagnosis += "Layer A: map bench failed - backend may be unstable under 50k limit; try lower limit or scale backend RAM."
}

$mapPass = $true
if ($report.layers.map_api) {
    if ($report.layers.map_api.error) { $mapPass = $false }
    elseif ($report.layers.map_api.pass -eq $false) { $mapPass = $false }
}
if ($report.layers.map_api_prod_proxy) {
    if ($report.layers.map_api_prod_proxy.error) { $mapPass = $false }
    elseif ($report.layers.map_api_prod_proxy.pass -eq $false) { $mapPass = $false }
}
$report.finished_at = (Get-Date).ToUniversalTime().ToString("o")
$report.pass = $mapPass

$report | ConvertTo-Json -Depth 12 | Set-Content -Path $reportPath -Encoding UTF8
Write-Host "`nReport: $reportPath" -ForegroundColor Cyan
if (-not $mapPass) { exit 1 }
