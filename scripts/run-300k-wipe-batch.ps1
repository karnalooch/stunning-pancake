#Requires -Version 5.1
param(
    [string]$ApiBase = "https://backend-production-55c7.up.railway.app/api",
    [string]$Username = "global_owner",
    [string]$Password = "",
    [int]$TargetUsers = 300000,
    [int]$PollSeconds = 15,
    [int]$WipeTimeoutMinutes = 180,
    [int]$BatchTimeoutMinutes = 240
)

$ErrorActionPreference = "Stop"
$logPath = Join-Path $PSScriptRoot ".run-300k-wipe-batch.log"

function Log([string]$msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Add-Content -Path $logPath -Value $line
    Write-Host $line
}

if (-not $Password) {
    $Password = $env:ADMIN_PASS
    if (-not $Password) { throw "Set ADMIN_PASS or -Password" }
}

function Get-AuthHeaders {
    $authBody = @{ username = $Username; password = $Password } | ConvertTo-Json
    $token = (Invoke-RestMethod -Uri "$ApiBase/auth/token/" -Method POST -ContentType "application/json" -Body $authBody).access
    return @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
}

function Invoke-Api([string]$Method, [string]$Uri, [string]$Body = $null) {
    $headers = Get-AuthHeaders
    $params = @{ Uri = $Uri; Method = $Method; Headers = $headers }
    if ($Body) { $params.Body = $Body; $params.ContentType = "application/json; charset=utf-8" }
    return Invoke-RestMethod @params
}

$headers = Get-AuthHeaders

Log "Stop live sim"
try {
    Invoke-RestMethod -Uri "$ApiBase/activities/admin/live-simulate/" -Method DELETE -Headers $headers | Out-Null
    Log "Live sim stop requested"
} catch {
    Log ("Live stop note: " + $_.Exception.Message)
}

Log "Start wipe"
$wipeBody = '{"confirm":true,"confirm_phrase":"DELETE ALL DATA \u2014 PRODUCTION \u2014 GLOBAL_OWNER","mfa_confirmed":true,"force":true}'
try {
    $w = Invoke-RestMethod -Uri "$ApiBase/activities/admin/wipe-data/" -Method DELETE -Headers $headers -Body $wipeBody -ContentType "application/json; charset=utf-8"
    Log ("Wipe started: " + $w.message)
} catch {
    $err = $_.ErrorDetails.Message
    if ($err -match "already running") {
        Log "Wipe already running, polling"
    } else {
        throw
    }
}

$wipeDeadline = (Get-Date).AddMinutes($WipeTimeoutMinutes)
$wipeDone = $false
$seenRunning = $false
$lastRows = -1
$stallPolls = 0
while ((Get-Date) -lt $wipeDeadline) {
    Start-Sleep -Seconds $PollSeconds
    $ws = Invoke-Api GET "$ApiBase/activities/admin/wipe-data/"
    if ($ws.running) { $seenRunning = $true }
    if ($ws.rows_deleted -eq $lastRows) { $stallPolls++ } else { $stallPolls = 0; $lastRows = $ws.rows_deleted }
    $wmsg = "Wipe running={0} phase={1} progress={2}% rows={3} stuck={4} error={5}" -f $ws.running, $ws.phase, $ws.progress_pct, $ws.rows_deleted, $ws.stuck, $ws.error
    Log $wmsg
    if ($ws.error) { throw "Wipe failed: $($ws.error)" }
    if ($ws.stuck -and $stallPolls -ge 4) {
        Log "Wipe stuck - force-restarting"
        $wipeBody = '{"confirm":true,"confirm_phrase":"DELETE ALL DATA \u2014 PRODUCTION \u2014 GLOBAL_OWNER","mfa_confirmed":true,"force":true}'
        Invoke-Api DELETE "$ApiBase/activities/admin/wipe-data/" $wipeBody | Out-Null
        $seenRunning = $false
        $stallPolls = 0
        continue
    }
    if ($seenRunning -and (-not $ws.running) -and ($ws.phase -eq "complete")) { $wipeDone = $true; break }
}
if (-not $wipeDone) { throw "Wipe timeout after $WipeTimeoutMinutes min" }
Log "Wipe done"

Log ("Batch " + $TargetUsers)
$batchBody = @{
    total_users     = $TargetUsers
    skip_activities = $true
    clear           = $true
    days            = 30
    scale           = 0.01
} | ConvertTo-Json
try {
    $b = Invoke-RestMethod -Uri "$ApiBase/activities/admin/simulate/" -Method POST -Headers $headers -Body $batchBody
    Log ("Batch: " + $b.message)
} catch {
    $err = $_.ErrorDetails.Message
    if ($err -match "already running") {
        Log "Batch already running"
    } else {
        throw
    }
}

$batchDeadline = (Get-Date).AddMinutes($BatchTimeoutMinutes)
$batchDone = $false
while ((Get-Date) -lt $batchDeadline) {
    Start-Sleep -Seconds $PollSeconds
    $bs = Invoke-Api GET "$ApiBase/activities/admin/simulate/"
    $bmsg = "Batch running={0} phase={1} progress={2}% users={3}/{4} error={5}" -f $bs.running, $bs.current_phase, $bs.progress_pct, $bs.users_created, $bs.total_users, $bs.error
    Log $bmsg
    if ($bs.error) { throw "Batch failed: $($bs.error)" }
    if ($bs.stuck) { throw "Batch stuck: $($bs.error)" }
    if ((-not $bs.running) -and ($bs.current_phase -in @("complete", "idle", ""))) { $batchDone = $true; break }
}
if (-not $batchDone) { throw "Batch timeout after $BatchTimeoutMinutes min" }

Log ("SUCCESS batch users=" + $bs.users_created)
