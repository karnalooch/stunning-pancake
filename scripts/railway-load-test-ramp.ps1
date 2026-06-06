#Requires -Version 5.1
<#
.SYNOPSIS
  Sim-lab load test: batch seed + live sim ramp to find user/active limits.

.DESCRIPTION
  Default target: SIM_LAB_API_BASE (see infrastructure/sim-lab/).
  Prod requires ALLOW_PROD_LOAD_TEST=1.

.OUTPUTS
  scripts/.railway-load-test-report.json
#>
param(
    [string]$ApiBase = "",
    [string]$Username = "global_owner",
    [string]$Password = "",
    [int[]]$UserSteps = @(50000, 100000, 200000, 300000),
    [double[]]$ActiveRatioSteps = @(0.10, 0.15, 0.17, 0.20, 0.25, 0.30),
    [int]$PollSeconds = 12,
    [int]$RampStableTicks = 3,
    [int]$BatchTimeoutMin = 60,
    [int]$LiveStepTimeoutMin = 15,
    [int]$MaxStartsPerTick = 5000,
    [int]$TickSeconds = 4,
    [int]$BrouterMaxCallsPerTick = 5000
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "..\infrastructure\sim-lab\scripts\_sim-lab-resolve.ps1")
$ApiBase = Resolve-SimLabApiBase -ApiBase $ApiBase
Test-ProdApiGuard -ApiBase $ApiBase

$reportPath = Join-Path $PSScriptRoot ".railway-load-test-report.json"
$reportsDir = Join-Path $PSScriptRoot "load\reports"
New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archiveReportPath = Join-Path $reportsDir "railway-ramp-$timestamp.json"
$logPath = Join-Path $PSScriptRoot ".railway-load-test.log"
$healthSamples = [System.Collections.Generic.List[int]]::new()
$authFailures = 0

function Log([string]$msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Add-Content -Path $logPath -Value $line
    Write-Host $line
}

function Sample-Health {
    $root = $ApiBase -replace '/api$', ''
    try {
        $sw = [Diagnostics.Stopwatch]::StartNew()
        $r = Invoke-WebRequest -Uri "$root/health/" -UseBasicParsing -TimeoutSec 30
        if ($r.StatusCode -eq 200) { [void]$script:healthSamples.Add([int]$sw.ElapsedMilliseconds) }
    } catch { }
}

function Get-AuthHeaders {
    if (-not $Password) { $Password = $env:ADMIN_PASS }
    if (-not $Password) { throw "Set ADMIN_PASS" }
    $authBody = @{ username = $Username; password = $Password } | ConvertTo-Json
    for ($i = 0; $i -lt 5; $i++) {
        try {
            $token = (Invoke-RestMethod -Uri "$ApiBase/auth/token/" -Method POST -ContentType "application/json" -Body $authBody -TimeoutSec 60).access
            return @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
        } catch {
            $script:authFailures++
            if ($i -ge 4) { throw }
            Start-Sleep -Seconds ([math]::Min(30, 5 * ($i + 1)))
        }
    }
    throw "Auth failed after retries"
}

function Invoke-Api([string]$Method, [string]$Uri, [string]$Body = $null) {
    for ($i = 0; $i -lt 5; $i++) {
        try {
            $headers = Get-AuthHeaders
            $params = @{ Uri = $Uri; Method = $Method; Headers = $headers; TimeoutSec = 120 }
            if ($Body) { $params.Body = $Body; $params.ContentType = "application/json; charset=utf-8" }
            return Invoke-RestMethod @params
        } catch {
            if ($i -ge 4) { throw }
            Log ("API retry $($i + 1)/5 $Method $Uri : $($_.Exception.Message)")
            Start-Sleep -Seconds ([math]::Min(30, 5 * ($i + 1)))
        }
    }
    throw "API failed after retries"
}

function Stop-Live {
    try { Invoke-Api DELETE "$ApiBase/activities/admin/live-simulate/" | Out-Null } catch { }
}

function Wait-Batch([int]$Target, [int]$TimeoutMin) {
    $deadline = (Get-Date).AddMinutes($TimeoutMin)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds $PollSeconds
        $bs = Invoke-Api GET "$ApiBase/activities/admin/simulate/"
        Log ("batch target={0} phase={1} users={2}/{3} pct={4}% error={5}" -f $Target, $bs.current_phase, $bs.users_created, $bs.total_users, $bs.progress_pct, $bs.error)
        if ($bs.error) { return @{ ok = $false; error = $bs.error; users = $bs.users_created } }
        if ($bs.stuck) { return @{ ok = $false; error = "batch_stuck"; users = $bs.users_created } }
        if ((-not $bs.running) -and ($bs.users_created -ge ($Target * 0.98))) {
            return @{ ok = $true; users = $bs.users_created }
        }
        if ((-not $bs.running) -and ($bs.current_phase -in @("complete", "idle"))) {
            return @{ ok = $true; users = $bs.users_created }
        }
    }
    return @{ ok = $false; error = "batch_timeout"; users = 0 }
}

function Wait-WipeComplete([int]$TimeoutMin = 30) {
    $deadline = (Get-Date).AddMinutes($TimeoutMin)
    while ((Get-Date) -lt $deadline) {
        $ws = Invoke-Api GET "$ApiBase/activities/admin/wipe-data/"
        if ($ws.running) {
            Log ("wipe wait: phase=$($ws.phase) pct=$($ws.progress_pct)% rows=$($ws.rows_deleted)")
            Start-Sleep -Seconds 10
            continue
        }
        if ($ws.phase -eq "complete") { return $true }
        return $false
    }
    throw "Wipe wait timeout after $TimeoutMin min"
}

function Start-Batch([int]$Target, [int]$AthletesInDb) {
    Stop-Live
    # clear=true only on empty DB; growth 50k→100k→300k uses top-up (clear=false).
    $useClear = ($AthletesInDb -lt 1000)
    if (-not $useClear) {
        $ok = Wait-WipeComplete 5
        if (-not $ok) { Log "wipe idle - continuing with top-up batch" }
    }
    $body = @{
        total_users     = $Target
        skip_activities = $true
        clear           = $useClear
        days            = 30
        scale           = 0.01
    } | ConvertTo-Json
    Log ("batch request target=$Target clear=$useClear athletes=$AthletesInDb")
    for ($attempt = 0; $attempt -lt 8; $attempt++) {
        try {
            $r = Invoke-Api POST "$ApiBase/activities/admin/simulate/" $body
            Log ("batch start: " + $r.message)
            return
        } catch {
            $err = $_.ErrorDetails.Message
            if ($err -match "already running") {
                Log "batch already running"
                return
            }
            if ($err -match "WIPE_IN_PROGRESS") {
                Log "batch blocked by wipe - waiting..."
                Wait-WipeComplete 30 | Out-Null
                continue
            }
            throw
        }
    }
    throw "Batch start failed after wipe retries"
}

function Measure-LiveRamp([int]$PoolUsers, [double]$ActiveRatio, [int]$TimeoutMin) {
    Stop-Live
    Start-Sleep -Seconds 3
    $body = @{
        pool_pct        = 1.0
        active_ratio    = $ActiveRatio
        cheat_ratio     = 0.05
        tick_seconds    = $TickSeconds
        scale_overrides = @{
            max_starts_per_live_tick     = $MaxStartsPerTick
            brouter_max_calls_per_tick   = $BrouterMaxCallsPerTick
            brouter_route_attempts       = 4
        }
    } | ConvertTo-Json -Depth 4
    try {
        $start = Invoke-Api POST "$ApiBase/activities/admin/live-simulate/" $body
        Log ("live start ratio={0} msg={1}" -f $ActiveRatio, $start.message)
    } catch {
        return @{ ok = $false; error = $_.ErrorDetails.Message; active = 0; target = 0; stuck = $true }
    }

    $deadline = (Get-Date).AddMinutes($TimeoutMin)
    $stable = 0
    $lastActive = -1
    $peak = 0
    $samples = @()

    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds $PollSeconds
        Sample-Health
        $ls = Invoke-Api GET "$ApiBase/activities/admin/live-simulate/"
        $active = [int]$ls.ride_active
        $target = [int]$ls.target_on_map
        $peak = [math]::Max($peak, $active)
        $sample = @{
            t               = (Get-Date).ToString("o")
            active          = $active
            warming         = [int]$ls.ride_warming
            routing         = [int]$ls.ride_routing
            pipeline        = [int]$ls.active_rides
            target          = $target
            stuck           = [bool]$ls.stuck
            bp              = [bool]$ls.routing_backpressure_active
            queue           = [int]$ls.routing_queue_depth
            starts_tick     = [int]$ls.starts_budget_last_tick
            slo_throttle    = [bool]$ls.slo_throttle_engaged
            error           = $ls.error
        }
        $samples += $sample
        Log ("live ratio={0} active={1}/{2} warm={3} pipe={4} stuck={5} bp={6} q={7}" -f $ActiveRatio, $active, $target, $ls.ride_warming, $ls.active_rides, $ls.stuck, $ls.routing_backpressure_active, $ls.routing_queue_depth)

        if ($ls.error) {
            Stop-Live
            return @{ ok = $false; error = $ls.error; active = $active; target = $target; peak = $peak; samples = $samples }
        }
        if ($ls.stuck -and -not $ls.running) {
            Stop-Live
            return @{ ok = $false; error = "live_stuck"; active = $active; target = $target; peak = $peak; samples = $samples }
        }
        if ($active -eq $lastActive) { $stable++ } else { $stable = 0; $lastActive = $active }
        if ($target -gt 0 -and $active -ge ($target * 0.90)) {
            Stop-Live
            return @{ ok = $true; active = $active; target = $target; peak = $peak; samples = $samples }
        }
        if ($stable -ge $RampStableTicks -and $active -gt 0 -and $target -gt 0 -and $active -lt ($target * 0.05)) {
            Stop-Live
            return @{ ok = $true; active = $active; target = $target; peak = $peak; plateau = $true; samples = $samples }
        }
    }
    Stop-Live
    return @{ ok = $true; active = $lastActive; target = $target; peak = $peak; plateau = $true; samples = $samples }
}

$report = @{
    started_at = (Get-Date).ToString("o")
    api        = $ApiBase
    steps      = @()
    summary    = @{}
}

Log "=== Railway load test ramp ==="
Log ("fast ramp: tick={0}s starts={1}/tick brouter={2}/tick (prod-realistic BRouter)" -f $TickSeconds, $MaxStartsPerTick, $BrouterMaxCallsPerTick)
$pf = Invoke-Api GET "$ApiBase/activities/admin/scale-preflight/?target_users=300000&active_ratio=0.17&skip_activities=true"
$report.preflight = @{
    athletes_in_db           = $pf.athletes_in_db
    max_concurrent_riders    = $pf.limits.MAX_CONCURRENT_RIDERS
    max_live_pool            = $pf.limits.MAX_LIVE_POOL
    estimated_disk_gb_300k   = $pf.estimated_disk_gb
}

foreach ($userTarget in $UserSteps) {
    Log "--- USER STEP $userTarget ---"
    $pfStep = Invoke-Api GET "$ApiBase/activities/admin/scale-preflight/?target_users=$userTarget&active_ratio=0.17&skip_activities=true"
    $athletesNow = [int]$pfStep.athletes_in_db
    if ($athletesNow -ge ($userTarget * 0.98)) {
        Log "pool already has $athletesNow athletes (target $userTarget), skip batch"
        $batchResult = @{ ok = $true; users = $athletesNow; skipped = $true }
    } else {
        Start-Batch $userTarget $athletesNow
        $batchResult = Wait-Batch $userTarget $BatchTimeoutMin
        if ($batchResult.ok) {
            $pfAfter = Invoke-Api GET "$ApiBase/activities/admin/scale-preflight/?target_users=$userTarget&active_ratio=0.17&skip_activities=true"
            $batchResult.users = [int]$pfAfter.athletes_in_db
        }
    }

    $step = @{
        target_users  = $userTarget
        batch         = $batchResult
        live_ramps    = @()
    }

    if (-not $batchResult.ok) {
        Log "BATCH FAILED at $userTarget : $($batchResult.error)"
        $report.steps += $step
        $report.summary.max_users_batch = if ($report.steps.Count -gt 1) { $UserSteps[$report.steps.Count - 2] } else { 0 }
        break
    }

    $maxActiveRatio = 0
    $maxActiveRiders = 0
    foreach ($ratio in $ActiveRatioSteps) {
        $expected = [int]($batchResult.users * $ratio)
        if ($expected -gt $pf.limits.MAX_CONCURRENT_RIDERS) {
            Log "skip ratio $ratio (expected $expected > cap $($pf.limits.MAX_CONCURRENT_RIDERS))"
            continue
        }
        $ramp = Measure-LiveRamp $batchResult.users $ratio $LiveStepTimeoutMin
        $step.live_ramps += @{
            active_ratio   = $ratio
            expected       = $expected
            result         = $ramp
        }
        if ($ramp.peak -gt $maxActiveRiders) { $maxActiveRiders = $ramp.peak }
        if ($ramp.ok) { $maxActiveRatio = $ratio } else { break }
    }

    $step.max_active_riders = $maxActiveRiders
    $step.max_stable_ratio  = $maxActiveRatio
    $report.steps += $step
    $report.summary.max_users_batch     = $userTarget
    $report.summary.max_active_riders   = $maxActiveRiders
    $report.summary.max_stable_ratio    = $maxActiveRatio
}

$report.finished_at = (Get-Date).ToString("o")
if ($healthSamples.Count -gt 0) {
    $sorted = $healthSamples | Sort-Object
    $p95Idx = [math]::Min($sorted.Count - 1, [math]::Ceiling($sorted.Count * 0.95) - 1)
    $report.health = @{
        samples    = $healthSamples.Count
        p95_ms     = $sorted[$p95Idx]
        max_ms     = ($sorted | Measure-Object -Maximum).Maximum
        auth_failures = $authFailures
    }
}
$report.pass_criteria = @{
    target_active_riders = 50000
    health_p95_max_ms    = 5000
    reached_50k          = ($report.summary.max_active_riders -ge 50000)
}
$json = $report | ConvertTo-Json -Depth 10
Set-Content -Path $reportPath -Value $json -Encoding UTF8
Set-Content -Path $archiveReportPath -Value $json -Encoding UTF8
Log "Report: $reportPath"
Log "Archive: $archiveReportPath"
Log ("SUMMARY batch_max={0} live_active_peak={1} ratio_max={2}" -f $report.summary.max_users_batch, $report.summary.max_active_riders, $report.summary.max_stable_ratio)
