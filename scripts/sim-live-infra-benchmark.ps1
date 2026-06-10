#Requires -Version 5.1
<#
.SYNOPSIS
  Live sim infra benchmark — measures ramp to ACTIVE and proposes limits.

.DESCRIPTION
  Runs short batch + live ramp steps against sim-lab or prod (prod needs ALLOW_PROD_LOAD_TEST=1).
  Uses sim-capacity API for launch plan (tick, routing dispatch, starts/tick).

.EXAMPLE
  $env:ADMIN_PASS = 'your-global-owner-password'
  $env:SIM_LAB_API_BASE = 'https://backend-production-55c7.up.railway.app/api'
  $env:ALLOW_PROD_LOAD_TEST = '1'
  .\scripts\sim-live-infra-benchmark.ps1 -UserSteps 1000,5000,10000 -ActivePercentSteps 20,30,50
#>
param(
    [string]$ApiBase = "",
    [int[]]$UserSteps = @(1000, 5000, 10000),
    [int[]]$ActivePercentSteps = @(20, 30, 50),
    [int]$PollSeconds = 8,
    [int]$RampTimeoutMin = 12,
    [int]$BatchTimeoutMin = 45
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "..\infrastructure\sim-lab\scripts\_sim-lab-resolve.ps1")
$ApiBase = Resolve-SimLabApiBase -ApiBase $ApiBase -AllowProdFallback
Test-ProdApiGuard -ApiBase $ApiBase

$reportsDir = Join-Path $PSScriptRoot "load\reports"
New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$reportPath = Join-Path $reportsDir "sim-infra-benchmark-$ts.json"
$logPath = Join-Path $reportsDir "sim-infra-benchmark-$ts.log"

function Log([string]$msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $msg
    Add-Content -Path $logPath -Value $line
    Write-Host $line
}

function Get-AuthHeaders {
    $pass = $env:ADMIN_PASS
    if (-not $pass) { throw "Set ADMIN_PASS (GLOBAL_OWNER password)" }
    $body = @{ username = "global_owner"; password = $pass } | ConvertTo-Json
    $token = (Invoke-RestMethod -Uri "$ApiBase/auth/token/" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 60).access
    return @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
}

function Invoke-Api([string]$Method, [string]$Uri, [string]$Body = $null) {
    $headers = Get-AuthHeaders
    $params = @{ Uri = $Uri; Method = $Method; Headers = $headers; TimeoutSec = 120 }
    if ($Body) { $params.Body = $Body; $params.ContentType = "application/json; charset=utf-8" }
    return Invoke-RestMethod @params
}

function Stop-Live {
    try { Invoke-Api DELETE "$ApiBase/activities/admin/live-simulate/" | Out-Null } catch { }
}

function Wait-Batch([int]$Target) {
    $deadline = (Get-Date).AddMinutes($BatchTimeoutMin)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds $PollSeconds
        $bs = Invoke-Api GET "$ApiBase/activities/admin/simulate/"
        Log ("batch users={0}/{1} phase={2} pct={3}" -f $bs.users_created, $bs.total_users, $bs.current_phase, $bs.progress_pct)
        if ($bs.error) { return @{ ok = $false; error = $bs.error } }
        if ((-not $bs.running) -and ($bs.users_created -ge ($Target * 0.95))) { return @{ ok = $true; users = $bs.users_created } }
    }
    return @{ ok = $false; error = "batch_timeout" }
}

function Start-Batch([int]$Target) {
    Stop-Live
    $body = @{
        total_users     = $Target
        skip_activities = $true
        clear           = $true
        days            = 7
    } | ConvertTo-Json
    Invoke-Api POST "$ApiBase/activities/admin/simulate/" $body | Out-Null
}

function Measure-LiveRamp([int]$PoolUsers, [int]$ActivePercent) {
    Stop-Live
    Start-Sleep -Seconds 2
    $ratio = $ActivePercent / 100.0
    $capUri = "$ApiBase/activities/admin/sim-capacity/?target_users=$($PoolUsers)&active_ratio=$ratio&cheat_ratio=0.06"
    $cap = Invoke-Api GET $capUri
    $plan = $cap.live_launch_plan
    $body = @{
        pool_pct        = $plan.pool_pct
        active_ratio    = $plan.active_ratio
        cheat_ratio     = $plan.cheat_ratio
        tick_seconds    = $plan.tick_seconds
        scale_overrides = $plan.scale_overrides
    } | ConvertTo-Json -Depth 5
    try {
        Invoke-Api POST "$ApiBase/activities/admin/live-simulate/" $body | Out-Null
    } catch {
        return @{ ok = $false; error = $_.Exception.Message; plan = $plan; samples = @() }
    }

    $deadline = (Get-Date).AddMinutes($RampTimeoutMin)
    $samples = [System.Collections.Generic.List[object]]::new()
    $peakActive = 0
    $stallTicks = 0
    $startedAt = Get-Date

    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds $PollSeconds
        $ls = Invoke-Api GET "$ApiBase/activities/admin/live-simulate/?light=1"
        $active = [int]$ls.ride_active
        $peakActive = [math]::Max($peakActive, $active)
        if ($ls.tick_stale) { $stallTicks++ }
        $samples.Add([pscustomobject]@{
            elapsed_s = [int]((Get-Date) - $startedAt).TotalSeconds
            active    = $active
            warming   = [int]$ls.ride_warming
            routing   = [int]$ls.ride_routing
            queue     = [int]$ls.routing_queue_depth
            tick_stale = [bool]$ls.tick_stale
            target    = [int]$ls.target_on_map
        })
        Log ("ramp {0}% active={1}/{2} warm={3} stale={4} q={5}" -f $ActivePercent, $active, $ls.target_on_map, $ls.ride_warming, $ls.tick_stale, $ls.routing_queue_depth)
        $target = [int]$ls.target_on_map
        if ($target -gt 0 -and $active -ge ($target * 0.85)) {
            Stop-Live
            return @{
                ok = $true; peak = $peakActive; target = $target; plan = $plan
                ramp_seconds = [int]((Get-Date) - $startedAt).TotalSeconds
                stall_ticks = $stallTicks; samples = $samples
            }
        }
        if ($ls.error) {
            Stop-Live
            return @{ ok = $false; error = $ls.error; peak = $peakActive; plan = $plan; samples = $samples }
        }
    }
    Stop-Live
    return @{
        ok = $false; error = "ramp_timeout"; peak = $peakActive
        plan = $plan; ramp_seconds = [int]((Get-Date) - $startedAt).TotalSeconds
        stall_ticks = $stallTicks; samples = $samples
    }
}

function Recommend-Limits([array]$Results) {
    $rec = @{
        tick_seconds                      = 3
        max_starts_per_live_tick          = 300
        routing_dispatch_per_tick         = 200
        routing_queue_depth_cap           = 3000
        max_active_percent_10k            = 30
        notes                             = @()
    }
    $worstStall = ($Results | ForEach-Object { $_.stall_ticks } | Measure-Object -Maximum).Maximum
    $bestPeak = ($Results | Where-Object { $_.ok } | ForEach-Object { $_.peak } | Measure-Object -Maximum).Maximum
    if ($worstStall -ge 3) {
        $rec.tick_seconds = 4
        $rec.routing_dispatch_per_tick = 150
        $rec.notes += "Tick stale during ramp - prefer tick 4s until simulation worker scaled."
    }
    if ($bestPeak -lt 1000) {
        $rec.max_active_percent_10k = 20
        $rec.notes += "Peak ACTIVE below 1k - cap active % at 20% for 10k pool first."
    }
    if ($worstStall -eq 0 -and $bestPeak -ge 2000) {
        $rec.tick_seconds = 2
        $rec.routing_dispatch_per_tick = 400
        $rec.max_starts_per_live_tick = 400
        $rec.notes += "Stable ramp - can use aggressive tick 2s / dispatch 400."
    }
    return $rec
}

function Save-Report([hashtable]$Report) {
    $flat = @()
    foreach ($s in $Report.steps) {
        foreach ($r in $s.ramps) { $flat += $r }
    }
    $Report.recommended_limits = Recommend-Limits $flat
    $Report.finished_at = (Get-Date).ToString("o")
    $Report | ConvertTo-Json -Depth 14 | Set-Content -Path $reportPath -Encoding UTF8
}

$targetUsers = if ($UserSteps.Count -gt 0) { $UserSteps[0] } else { 1000 }
$infraUri = "$ApiBase/activities/admin/sim-capacity/?target_users=$targetUsers&active_ratio=0.5&cheat_ratio=0.06"
$infra = Invoke-Api GET $infraUri
$report = @{
    started_at     = (Get-Date).ToString("o")
    api            = $ApiBase
    infra_at_start = $infra.infra
    launch_plan    = $infra.live_launch_plan
    steps          = @()
}

Log "=== Sim live infra benchmark ==="
Log ("infra: tick={0}s starts={1} routing={2} target_on_map={3}" -f $infra.infra.tick_seconds, $infra.infra.max_starts_per_live_tick, $infra.infra.routing_dispatch_per_tick, $infra.live_launch_plan.target_on_map)

try {
    foreach ($users in $UserSteps) {
        Log "--- pool $users ---"
        Start-Batch $users
        $batch = Wait-Batch $users
        if (-not $batch.ok) {
            $report.steps += @{ users = $users; batch = $batch; ramps = @() }
            break
        }
        $step = @{ users = $users; batch = $batch; ramps = @() }
        $report.steps += $step
        foreach ($pct in $ActivePercentSteps) {
            $r = Measure-LiveRamp $batch.users $pct
            $step.ramps += @{
                active_percent = $pct
                ok             = $r.ok
                peak_active    = $r.peak
                target         = $r.target
                ramp_seconds   = $r.ramp_seconds
                stall_ticks    = $r.stall_ticks
                plan           = $r.plan
                error          = $r.error
                samples        = @($r.samples)
            }
            Save-Report $report
            if (-not $r.ok) { break }
            Start-Sleep -Seconds 5
        }
        Save-Report $report
    }
}
finally {
    Save-Report $report
    Log "Report: $reportPath"
    Write-Host "`nRecommended limits:" -ForegroundColor Cyan
    $report.recommended_limits | ConvertTo-Json | Write-Host
}
