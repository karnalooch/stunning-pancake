#Requires -Version 5.1
<#
.SYNOPSIS
  Handoff / load-test prep: preflight, optional batch seed, live sim warm-up.

.DESCRIPTION
  1. GET scale-preflight (target_users, active_ratio, skip_activities)
  2. GET live-simulate status (batch_blocks_live, wipe guard via wipe-data)
  3. If needs_batch_first: POST simulate (skip_activities) and poll until idle
  4. POST live-simulate (or print curl when -DryRun)
  5. Poll until currently_riding >= threshold

.PARAMETER ApiBase
  Django API root, e.g. https://backend-production-55c7.up.railway.app/api

.PARAMETER Token
  Admin JWT. Falls back to $env:SPORT_ADMIN_TOKEN, else username/password token fetch.

.PARAMETER Intensity
  Aktywnosc puli 0-100 (default 50). Prefer POST intensity+load; fallback maps locally (sim_profile.py).

.PARAMETER Load
  Obciazenie systemu 0-100 (default 50).

.EXAMPLE
  .\scripts\sim-handoff-prep.ps1 -ApiBase "https://backend-production-55c7.up.railway.app/api" -TargetUsers 10000

.EXAMPLE
  $env:SPORT_ADMIN_TOKEN = "<jwt>"
  .\scripts\sim-handoff-prep.ps1 -DryRun
#>
param(
    [string]$ApiBase = "https://backend-production-55c7.up.railway.app/api",
    [string]$Token = "",
    [string]$Username = "global_owner",
    [string]$Password = "admin123",
    [int]$TargetUsers = 10000,
    [int]$Intensity = 50,
    [int]$Load = 50,
    [double]$ActiveRatio = -1,
    [int]$RidingThreshold = 0,
    [int]$TickSeconds = -1,
    [double]$PoolPct = 1.0,
    [int]$PollSeconds = 10,
    [int]$BatchTimeoutMinutes = 120,
    [int]$LiveTimeoutMinutes = 25,
    [switch]$SkipBatch,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-AdminJwt {
    param([string]$Url, [string]$User, [string]$Pass)
    $body = @{ username = $User; password = $Pass } | ConvertTo-Json
    $resp = Invoke-RestMethod -Uri "$Url/auth/token/" -Method POST -ContentType "application/json" -Body $body
    return $resp.access
}

function Assert-NotBlocked {
    param($LiveStatus, [string]$Phase)
    if ($LiveStatus.batch_blocks_live) {
        throw "FAIL [$Phase]: batch_blocks_live=true - $($LiveStatus.batch_block_reason). Wait for batch to finish."
    }
}

function Get-WipeRunning {
    param([hashtable]$Headers, [string]$Base)
    try {
        $w = Invoke-RestMethod -Uri "$Base/activities/admin/wipe-data/" -Headers $Headers
        return [bool]$w.running
    } catch {
        return $false
    }
}

function Wait-BatchComplete {
    param(
        [hashtable]$Headers,
        [string]$Base,
        [datetime]$Deadline
    )
    do {
        Start-Sleep -Seconds $PollSeconds
        $b = Invoke-RestMethod -Uri "$Base/activities/admin/simulate/" -Headers $Headers
        $phase = if ($b.current_phase) { $b.current_phase } else { "?" }
        Write-Host ("    batch running={0} phase={1} progress={2}% users={3}/{4}" -f `
            $b.running, $phase, $b.progress_pct, $b.users_created, $b.total_users)
        if (-not $b.running -and $phase -in @("idle", "complete", "")) { return $b }
        if ($b.error) { throw "FAIL [batch]: $($b.error)" }
        if ($b.stuck) { throw "FAIL [batch]: stuck lock or error state (stuck=true)." }
    } while ((Get-Date) -lt $Deadline)
    throw "FAIL [batch]: timed out after $BatchTimeoutMinutes minutes."
}

function Get-PiecewiseLerp {
    param([int]$X, [object[]]$Points)
    $x = [Math]::Max(0, [Math]::Min(100, $X))
    if ($x -le $Points[0][0]) { return [double]$Points[0][1] }
    for ($i = 0; $i -lt $Points.Count - 1; $i++) {
        $x0 = $Points[$i][0]; $y0 = [double]$Points[$i][1]
        $x1 = $Points[$i + 1][0]; $y1 = [double]$Points[$i + 1][1]
        if ($x -le $x1) {
            if ($x1 -eq $x0) { return $y1 }
            $t = ($x - $x0) / ($x1 - $x0)
            return $y0 + $t * ($y1 - $y0)
        }
    }
    return [double]$Points[-1][1]
}

function Resolve-SimProfile {
    param([int]$I, [int]$L)
    $i = [Math]::Max(0, [Math]::Min(100, $I))
    $l = [Math]::Max(0, [Math]::Min(100, $L))
    $active = [Math]::Max(0.08, [Math]::Min(0.50, 0.08 + 0.42 * ($i / 100.0)))
    $cheat = [Math]::Max(0.0, [Math]::Min(0.25, 0.12 * ($i / 100.0)))
    $starts = [int][Math]::Round((Get-PiecewiseLerp -X $l -Points @(@(0, 25), @(50, 50), @(75, 100), @(100, 150))))
    $brouter = [int][Math]::Round($starts * 0.83)
    $attempts = if ($l -lt 75) { 4 } else { 5 }
    $tick = [int][Math]::Round((Get-PiecewiseLerp -X $l -Points @(@(0, 12), @(50, 8), @(100, 6))))
    return @{
        intensity = $i
        load = $l
        active_ratio = $active
        cheat_ratio = $cheat
        tick_seconds = $tick
        scale_overrides = @{
            max_starts_per_live_tick = $starts
            brouter_max_calls_per_tick = $brouter
            brouter_route_attempts = $attempts
        }
    }
}

function Format-LiveCurl {
    param([string]$Base, [hashtable]$Body)
    $json = ($Body | ConvertTo-Json -Compress -Depth 5)
    return "curl -sS -X POST `"$Base/activities/admin/live-simulate/`" -H `"Authorization: Bearer `$TOKEN`" -H `"Content-Type: application/json`" -d '$json'"
}

function New-LiveSimBody {
    param(
        [hashtable]$Profile,
        [double]$Pool,
        [switch]$UseProfileApi
    )
    if ($UseProfileApi) {
        return @{
            pool_pct = $Pool
            intensity = $Profile.intensity
            load = $Profile.load
        }
    }
    return @{
        pool_pct = $Pool
        active_ratio = $Profile.active_ratio
        cheat_ratio = $Profile.cheat_ratio
        tick_seconds = $Profile.tick_seconds
        scale_overrides = $Profile.scale_overrides
    }
}

$ApiBase = $ApiBase.TrimEnd("/")
$profile = Resolve-SimProfile -I $Intensity -L $Load
if ($ActiveRatio -ge 0) { $profile.active_ratio = $ActiveRatio }
if ($TickSeconds -ge 0) { $profile.tick_seconds = $TickSeconds }
$ActiveRatio = $profile.active_ratio
$TickSeconds = $profile.tick_seconds
$useProfileApi = $true

if ($DryRun -and -not $Token -and -not $env:SPORT_ADMIN_TOKEN) {
    Write-Host "=== Sim handoff prep (DryRun, no API) ===" -ForegroundColor Cyan
    Write-Host "ApiBase=$ApiBase TargetUsers=$TargetUsers Intensity=$Intensity Load=$Load active_ratio=$ActiveRatio"
    Write-Host "  - GET scale-preflight/?target_users=$TargetUsers&active_ratio=$ActiveRatio&skip_activities=true"
    if (-not $SkipBatch) {
        Write-Host "  - POST simulate/  { total_users: $TargetUsers, skip_activities: true }  (if needs_batch_first)"
    }
    Write-Host "  - POST live-simulate:"
    $dryBody = New-LiveSimBody -Profile $profile -Pool $PoolPct -UseProfileApi:$useProfileApi
    Write-Host ("    {0}" -f (Format-LiveCurl -Base $ApiBase -Body $dryBody))
    Write-Host "Next: docs/operations/TELEMETRY_LOAD_TEST.md"
    exit 0
}

if (-not $Token) { $Token = $env:SPORT_ADMIN_TOKEN }
if (-not $Token) {
    Write-Host "[*] No -Token / SPORT_ADMIN_TOKEN - fetching JWT via auth/token..."
    $Token = Get-AdminJwt -Url $ApiBase -User $Username -Pass $Password
}

$headers = @{
    Authorization = "Bearer $Token"
    "Content-Type" = "application/json"
}

if ($RidingThreshold -le 0) {
    $RidingThreshold = [Math]::Max(500, [int]($TargetUsers * $ActiveRatio * 0.25))
}

Write-Host "=== Sim handoff prep ===" -ForegroundColor Cyan
Write-Host "ApiBase=$ApiBase TargetUsers=$TargetUsers Intensity=$Intensity Load=$Load active_ratio=$ActiveRatio RidingThreshold=$RidingThreshold"

if (Get-WipeRunning -Headers $headers -Base $ApiBase) {
    throw "FAIL: wipe in progress. Poll GET /activities/admin/wipe-data/ until complete."
}

$preflightUri = "$ApiBase/activities/admin/scale-preflight/?target_users=$TargetUsers&active_ratio=$ActiveRatio&skip_activities=true"
Write-Host "[*] GET scale-preflight..."
$pf = Invoke-RestMethod -Uri $preflightUri -Headers $headers
Write-Host ("    athletes_in_db={0} needs_batch_first={1} live_pool_mode={2} est_batch={3}" -f `
    $pf.athletes_in_db, $pf.needs_batch_first, $pf.live_pool_mode, $pf.estimated_batch_label)
if ($pf.risks -and $pf.risks.Count -gt 0) {
    foreach ($r in $pf.risks) {
        Write-Host ("    risk [{0}] {1}" -f $r.severity, $r.title) -ForegroundColor Yellow
    }
}

Write-Host "[*] GET live-simulate (status)..."
$live = Invoke-RestMethod -Uri "$ApiBase/activities/admin/live-simulate/" -Headers $headers
Write-Host ("    running={0} batch_blocks_live={1} currently_riding={2} ride_active={3}" -f `
    $live.running, $live.batch_blocks_live, $live.currently_riding, $live.ride_active)

if ($DryRun) {
    Write-Host ""
    Write-Host "[DryRun] Planned steps:" -ForegroundColor Yellow
    if ($pf.needs_batch_first -and -not $SkipBatch) {
        Write-Host "  - POST $ApiBase/activities/admin/simulate/  body: { total_users: $TargetUsers, skip_activities: true }"
        Write-Host "  - Poll GET simulate/ until running=false, phase=complete|idle"
    } elseif ($SkipBatch) {
        Write-Host "  - Skip batch (-SkipBatch)"
    } else {
        Write-Host "  - Skip batch (pool already >= target)"
    }
    Write-Host "  - POST live-simulate (if not running):"
    $dryBody = New-LiveSimBody -Profile $profile -Pool $PoolPct -UseProfileApi:$useProfileApi
    Write-Host ("    {0}" -f (Format-LiveCurl -Base $ApiBase -Body $dryBody))
    Write-Host "  - Poll until currently_riding >= $RidingThreshold"
    Write-Host ""
    Write-Host "Next: docs/operations/TELEMETRY_LOAD_TEST.md + scripts/load-test-telemetry-ingest.py"
    exit 0
}

$runBatch = $pf.needs_batch_first -and -not $SkipBatch
if ($runBatch) {
    Assert-NotBlocked -LiveStatus $live -Phase "pre-batch"
    $batchGet = Invoke-RestMethod -Uri "$ApiBase/activities/admin/simulate/" -Headers $headers
    if (-not $batchGet.running) {
        Write-Host "[*] POST batch simulate (skip_activities, total_users=$TargetUsers)..."
        $batchBody = @{
            total_users      = $TargetUsers
            skip_activities  = $true
            clear            = $false
            days             = 30
            scale            = 0.01
        } | ConvertTo-Json
        try {
            $started = Invoke-RestMethod -Uri "$ApiBase/activities/admin/simulate/" -Method POST -Headers $headers -Body $batchBody
            Write-Host ("[+] {0}" -f $started.message)
        } catch {
            $err = $_.ErrorDetails.Message
            if ($err -match "WIPE_IN_PROGRESS") { throw "FAIL [batch]: wipe in progress." }
            if ($err -match "already running") {
                Write-Host "[*] Batch already running - polling..."
            } else {
                throw
            }
        }
    } else {
        Write-Host "[*] Batch already running - polling..."
    }
    $batchDeadline = (Get-Date).AddMinutes($BatchTimeoutMinutes)
    $null = Wait-BatchComplete -Headers $headers -Base $ApiBase -Deadline $batchDeadline
    Write-Host "[+] Batch complete."
} elseif ($SkipBatch -and $pf.needs_batch_first) {
    Write-Host "[!] -SkipBatch: athletes below target ($($pf.athletes_in_db) < $TargetUsers)." -ForegroundColor Yellow
}

$live = Invoke-RestMethod -Uri "$ApiBase/activities/admin/live-simulate/" -Headers $headers
Assert-NotBlocked -LiveStatus $live -Phase "pre-live"

if (-not $live.running) {
    Write-Host "[*] POST live-simulate (intensity=$Intensity load=$Load active_ratio=$ActiveRatio)..."
    $simBody = New-LiveSimBody -Profile $profile -Pool $PoolPct -UseProfileApi:$useProfileApi
    $simJson = $simBody | ConvertTo-Json -Compress -Depth 5
    try {
        $start = Invoke-RestMethod -Uri "$ApiBase/activities/admin/live-simulate/" -Method POST -Headers $headers -Body $simJson
        Write-Host ("[+] total_users={0} active_ratio={1}" -f $start.total_users, $start.active_ratio)
    } catch {
        $msg = $_.Exception.Message
        if ($_.ErrorDetails.Message) { $msg = $_.ErrorDetails.Message }
        if ($msg -match "intensity and load") {
            Write-Host "[!] API bez intensity/load — fallback na jawne pola" -ForegroundColor Yellow
            $useProfileApi = $false
            $simBody = New-LiveSimBody -Profile $profile -Pool $PoolPct -UseProfileApi:$false
            $simJson = $simBody | ConvertTo-Json -Compress -Depth 5
            $start = Invoke-RestMethod -Uri "$ApiBase/activities/admin/live-simulate/" -Method POST -Headers $headers -Body $simJson
            Write-Host ("[+] total_users={0} active_ratio={1}" -f $start.total_users, $start.active_ratio)
        } else {
            Write-Host "FAIL [live POST]: $msg" -ForegroundColor Red
            Write-Host "Manual:"
            Write-Host (Format-LiveCurl -Base $ApiBase -Body (New-LiveSimBody -Profile $profile -Pool $PoolPct -UseProfileApi:$false))
            throw
        }
    }
} else {
    Write-Host "[*] Live simulation already running."
}

$liveDeadline = (Get-Date).AddMinutes($LiveTimeoutMinutes)
do {
    Start-Sleep -Seconds $PollSeconds
    $live = Invoke-RestMethod -Uri "$ApiBase/activities/admin/live-simulate/" -Headers $headers
    Assert-NotBlocked -LiveStatus $live -Phase "live-poll"
    Write-Host ("    currently_riding={0} ride_active={1} ride_warming={2} routing_queue_depth={3} backpressure={4}" -f `
        $live.currently_riding, $live.ride_active, $live.ride_warming, `
        $live.routing_queue_depth, $live.routing_backpressure_active)
    if ($live.currently_riding -ge $RidingThreshold) { break }
} while ((Get-Date) -lt $liveDeadline)

if ($live.currently_riding -lt $RidingThreshold) {
    throw "FAIL [live]: timed out - currently_riding=$($live.currently_riding) < $RidingThreshold"
}

Write-Host ""
Write-Host "[+] Handoff sim warm complete." -ForegroundColor Green
Write-Host "    currently_riding=$($live.currently_riding) ride_active=$($live.ride_active)"
Write-Host ""
Write-Host "Next steps (load test):" -ForegroundColor Cyan
Write-Host "  1. docs/operations/TELEMETRY_LOAD_TEST.md"
Write-Host "  2. python scripts/load-test-telemetry-ingest.py --preflight --token `"<JWT>`" ..."
Write-Host "  3. Tune: active_ratio, SCALE_MAX_STARTS_PER_LIVE_TICK, routing backpressure (HANDOFF_AUTOMATION.md)"
Write-Host ""
Write-Host "JWT (map / ingest): $Token"
