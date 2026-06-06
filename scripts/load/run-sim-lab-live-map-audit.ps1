#Requires -Version 5.1
<#
.SYNOPSIS
  Sim-lab Live Map audit: viewport-admin + stress-50k map tiers + optional WebGL.

.EXAMPLE
  $env:ADMIN_PASS = 'admin123'
  .\scripts\load\run-sim-lab-live-map-audit.ps1 -IncludeProdProxy

.EXAMPLE
  .\scripts\load\run-sim-lab-live-map-audit.ps1 -SkipWebGl -SkipStressBench
#>
param(
    [string]$ApiBase = "",
    [string]$ProdProxyApiBase = "",
    [string]$AdminUrl = "",
    [string]$Password = "",
    [ValidateSet("viewport-admin", "baseline", "stress-50k", "both")]
    [string]$Tier = "both",
    [int]$MapLimit = 800,
    [int]$MapZoom = 10,
    [int]$ViewportWorkers = 3,
    [int]$ViewportDuration = 20,
    [int]$StressWorkers = 15,
    [int]$StressDuration = 30,
    [switch]$SkipWebGl,
    [switch]$SkipMapBench,
    [switch]$SkipStressBench,
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

function Get-TierP95Max([string]$TierName) {
    return [int]$thresholds.tiers.$TierName.map_p95_ms_max
}

function Build-MapUrl([string]$Base, [int]$Zoom, [int]$Limit) {
    return "$Base/activities/telemetry/live/?zoom=$Zoom&limit=$Limit"
}

$backendRoot = $ApiBase -replace '/api$', ''
$probeUrl = Build-MapUrl $ApiBase $MapZoom $MapLimit
$stressUrl = Build-MapUrl $ApiBase 6 50000

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

function Run-MapBench(
    [string]$Label,
    [string]$Base,
    [string]$Jwt,
    [string]$JsonOut,
    [string]$TierName,
    [string]$MapUrl,
    [int]$Workers,
    [int]$Duration
) {
    $p95Max = Get-TierP95Max $TierName
    $ingestPy = Join-Path $RepoRoot "scripts\load-test-telemetry-ingest.py"
    $pyArgs = @(
        $ingestPy,
        "--map-url", $MapUrl,
        "--token", $Jwt,
        "--map-workers", "$Workers",
        "--map-duration", "$Duration",
        "--map-only",
        "--report-tier", $TierName,
        "--report-target", $Label,
        "--json-out", $JsonOut
    )
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & python @pyArgs 2>&1 | ForEach-Object { Write-Host $_ }
    $ErrorActionPreference = $prevEap
    if ($LASTEXITCODE -ne 0) {
        return @{
            label = $Label; tier = $TierName; pass = $false
            error = "python exit $LASTEXITCODE"; report = $JsonOut
        }
    }
    if (-not (Test-Path $JsonOut)) {
        return @{
            label = $Label; tier = $TierName; pass = $false
            error = "missing json output"; report = $JsonOut
        }
    }
    $bench = Get-Content $JsonOut -Raw | ConvertFrom-Json
    $p95 = [double]$bench.metrics.map.latency_ms.p95
    $p50 = [double]$bench.metrics.map.latency_ms.p50
    $errs = [int]$bench.metrics.map.errors
    $ok = [int]$bench.metrics.map.ok
    $total = $ok + $errs
    $errorRate = if ($total -gt 0) { $errs / $total } else { 1.0 }
    $pass = ($errs -eq 0) -and ($p95 -gt 0) -and ($p95 -le $p95Max)
    return @{
        label      = $Label
        tier       = $TierName
        pass       = $pass
        map_p95_ms = $p95
        map_p50_ms = $p50
        map_errors = $errs
        map_ok     = $ok
        error_rate = $errorRate
        p95_max    = $p95Max
        threshold  = $bench.threshold_evaluation
        report     = $JsonOut
        map_url    = $MapUrl
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

function Should-RunTier([string]$Name) {
    return ($Tier -eq "both") -or ($Tier -eq $Name)
}

Write-Host "=== Sim-lab Live Map audit ===" -ForegroundColor Cyan
Write-Host "  API:   $ApiBase"
Write-Host "  Admin: $AdminUrl"
Write-Host "  Tier:  $Tier (viewport zoom=$MapZoom limit=$MapLimit; stress limit=50000)"

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
    tier_mode  = $Tier
    health_ms  = $health.ms
    live_sim   = if ($liveSim) { @{ active = $liveSim.ride_active; target = $liveSim.target_on_map; running = $liveSim.running } } else { $null }
    layers     = @{}
}

if (-not $SkipMapBench) {
    Write-Host "`n--- Layer A0: map probe (viewport) ---" -ForegroundColor Cyan
    $probes = @()
    $probes += Invoke-MapProbe "sim-lab-direct" $probeUrl $token
    if ($IncludeProdProxy -or $ProdProxyApiBase) {
        if (-not $ProdProxyApiBase) { $ProdProxyApiBase = "https://backend-production-55c7.up.railway.app/api" }
        $prodAuth = Invoke-RestMethod -Uri "$ProdProxyApiBase/auth/token/" -Method POST -ContentType "application/json" -Body $authBody -TimeoutSec 120
        $prodProbeUrl = Build-MapUrl $ProdProxyApiBase $MapZoom $MapLimit
        $probes += Invoke-MapProbe "prod-proxy" $prodProbeUrl $prodAuth.access
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

if (-not $SkipMapBench -and (Should-RunTier "viewport-admin")) {
    Write-Host "`n--- Layer A-viewport: map p95 (viewport-admin) ---" -ForegroundColor Cyan
    $jsonOut = Join-Path $reportsDir "sim-lab-map-viewport-$ts.json"
    $direct = Run-MapBench "sim-lab-direct" $ApiBase $token $jsonOut "viewport-admin" $probeUrl $ViewportWorkers $ViewportDuration
    $report.layers.map_api_viewport = $direct
    $color = if ($direct.pass) { "Green" } else { "Red" }
    if ($direct.error) {
        Write-Host ("  viewport FAIL: {0}" -f $direct.error) -ForegroundColor Red
    } else {
        Write-Host ("  viewport p95={0}ms (max {1}) errors={2} -> {3}" -f $direct.map_p95_ms, $direct.p95_max, $direct.map_errors, $(if ($direct.pass) { "PASS" } else { "FAIL" })) -ForegroundColor $color
    }

    if ($IncludeProdProxy -or $ProdProxyApiBase) {
        if (-not $ProdProxyApiBase) { $ProdProxyApiBase = "https://backend-production-55c7.up.railway.app/api" }
        $prodToken = (Invoke-RestMethod -Uri "$ProdProxyApiBase/auth/token/" -Method POST -ContentType "application/json" -Body $authBody -TimeoutSec 120).access
        $prodProbeUrl = Build-MapUrl $ProdProxyApiBase $MapZoom $MapLimit
        $jsonOutProd = Join-Path $reportsDir "prod-proxy-map-viewport-$ts.json"
        $proxy = Run-MapBench "prod-proxy" $ProdProxyApiBase $prodToken $jsonOutProd "viewport-admin" $prodProbeUrl $ViewportWorkers $ViewportDuration
        $report.layers.map_api_viewport_prod_proxy = $proxy
        $color2 = if ($proxy.pass) { "Green" } else { "Red" }
        if ($proxy.error) {
            Write-Host ("  prod-proxy viewport FAIL: {0}" -f $proxy.error) -ForegroundColor Red
        } else {
            Write-Host ("  prod-proxy viewport p95={0}ms -> {1}" -f $proxy.map_p95_ms, $(if ($proxy.pass) { "PASS" } else { "FAIL" })) -ForegroundColor $color2
        }
    }
}

if (-not $SkipMapBench -and -not $SkipStressBench -and (Should-RunTier "stress-50k")) {
    Write-Host "`n--- Layer A-stress: map p95 (stress-50k) ---" -ForegroundColor Cyan
    $jsonOut = Join-Path $reportsDir "sim-lab-map-stress-$ts.json"
    $direct = Run-MapBench "sim-lab-direct" $ApiBase $token $jsonOut "stress-50k" $stressUrl $StressWorkers $StressDuration
    $report.layers.map_api_stress = $direct
    $color = if ($direct.pass) { "Green" } else { "Red" }
    if ($direct.error) {
        Write-Host ("  stress FAIL: {0}" -f $direct.error) -ForegroundColor Red
    } else {
        Write-Host ("  stress p95={0}ms (max {1}) errors={2} -> {3}" -f $direct.map_p95_ms, $direct.p95_max, $direct.map_errors, $(if ($direct.pass) { "PASS" } else { "FAIL" })) -ForegroundColor $color
    }

    if ($IncludeProdProxy -or $ProdProxyApiBase) {
        if (-not $ProdProxyApiBase) { $ProdProxyApiBase = "https://backend-production-55c7.up.railway.app/api" }
        $prodToken = (Invoke-RestMethod -Uri "$ProdProxyApiBase/auth/token/" -Method POST -ContentType "application/json" -Body $authBody -TimeoutSec 120).access
        $jsonOutProd = Join-Path $reportsDir "prod-proxy-map-stress-$ts.json"
        $proxy = Run-MapBench "prod-proxy" $ProdProxyApiBase $prodToken $jsonOutProd "stress-50k" (Build-MapUrl $ProdProxyApiBase 6 50000) $StressWorkers $StressDuration
        $report.layers.map_api_stress_prod_proxy = $proxy
        $color2 = if ($proxy.pass) { "Green" } else { "Red" }
        if ($proxy.error) {
            Write-Host ("  prod-proxy stress FAIL: {0}" -f $proxy.error) -ForegroundColor Red
        } else {
            Write-Host ("  prod-proxy stress p95={0}ms -> {1}" -f $proxy.map_p95_ms, $(if ($proxy.pass) { "PASS" } else { "FAIL" })) -ForegroundColor $color2
        }
    }
}

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
    $report.diagnosis += "Layer A0: telemetry/live returned 5xx - check backend OOM and SIM_LAB_PROXY_MAP_TIMEOUT on prod."
}

function Test-BenchLayer($layer) {
    if (-not $layer) { return $true }
    if ($layer.error) { return $false }
    if ($layer.pass -eq $false) { return $false }
    return $true
}

$viewportPass = $true
$stressPass = $true
if (-not (Test-BenchLayer $report.layers.map_api_viewport)) { $viewportPass = $false }
if (-not (Test-BenchLayer $report.layers.map_api_viewport_prod_proxy)) { $viewportPass = $false }
if (-not (Test-BenchLayer $report.layers.map_api_stress)) { $stressPass = $false }
if (-not (Test-BenchLayer $report.layers.map_api_stress_prod_proxy)) { $stressPass = $false }

$report.finished_at = (Get-Date).ToUniversalTime().ToString("o")
$report.pass_viewport = $viewportPass
$report.pass_stress = $stressPass
# Primary gate: viewport-admin (admin UX). Stress tier is informational at 50k.
$report.pass = $viewportPass

$report | ConvertTo-Json -Depth 12 | Set-Content -Path $reportPath -Encoding UTF8
Write-Host "`nReport: $reportPath" -ForegroundColor Cyan
Write-Host ("  viewport: {0}  stress: {1}  overall: {2}" -f $(if ($viewportPass) { "PASS" } else { "FAIL" }), $(if ($stressPass) { "PASS" } else { "FAIL" }), $(if ($report.pass) { "PASS" } else { "FAIL" }))
if (-not $report.pass) { exit 1 }
