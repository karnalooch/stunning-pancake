#Requires -Version 5.1
<#
.SYNOPSIS
  Verify Railway production Celery workers (no secrets printed).

.DESCRIPTION
  Checks marvelous-gratitude / production:
  - Auth via RAILWAY_API_TOKEN (User env on Windows; never RAILWAY_TOKEN)
  - celery-worker-routing: GitHub repo, Dockerfile path, logs contain Celery routing@
  - celery-worker-simulation: solo pool tuning vars from railway.json

.EXAMPLE
  .\scripts\railway-verify-production.ps1
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectName = 'marvelous-gratitude'
$Environment = 'production'
$RoutingService = 'celery-worker-routing'
$SimulationService = 'celery-worker-simulation'
$ExpectedRepo = 'karnalooch/stunning-pancake'
$ExpectedDockerfile = '/celery-worker-simulation/Dockerfile'
$ExpectedConfigFile = '/celery-worker-routing/railway.json'

$results = [System.Collections.Generic.List[object]]::new()

function Add-Result {
    param([string]$Check, [bool]$Pass, [string]$Detail)
    $results.Add([pscustomobject]@{ Check = $Check; Pass = $Pass; Detail = $Detail })
}

function Test-CommandExists([string]$Name) {
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-CommandExists 'railway')) {
    Add-Result 'railway CLI installed' $false 'Install: npm i -g @railway/cli'
    $results | Format-Table -AutoSize
    exit 1
}

if ($env:RAILWAY_TOKEN) {
    Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue
    Add-Result 'RAILWAY_TOKEN unset' $true 'Removed legacy token from session'
} else {
    Add-Result 'RAILWAY_TOKEN unset' $true 'Not set in session'
}

if (-not $env:RAILWAY_API_TOKEN) {
    Add-Result 'RAILWAY_API_TOKEN present' $false 'Set in Windows User env (see .env.railway.local.example)'
} else {
    Add-Result 'RAILWAY_API_TOKEN present' $true 'Length OK (value not printed)'
}

try {
    $whoami = railway whoami 2>&1 | Out-String
    Add-Result 'railway whoami' ($LASTEXITCODE -eq 0) ($whoami.Trim() -replace '\s+', ' ')
} catch {
    Add-Result 'railway whoami' $false $_.Exception.Message
}

Push-Location $PSScriptRoot\..
$statusOut = railway status 2>&1 | Out-String
if ($statusOut -match [regex]::Escape($ProjectName) -and $statusOut -match [regex]::Escape($Environment)) {
    Add-Result "project $ProjectName/$Environment" $true 'Already linked or status OK'
} else {
    railway link --project $ProjectName --environment $Environment 2>&1 | Out-Null
    Add-Result "project $ProjectName/$Environment" ($LASTEXITCODE -eq 0) 'railway link'
}

# --- Service list (repo) ---
$svcList = railway service list 2>&1 | Out-String
$routingBlock = ($svcList -split '(?=\r?\n\S)' | Where-Object { $_ -match $RoutingService } | Select-Object -First 1) -join ''
$simBlock = ($svcList -split '(?=\r?\n\S)' | Where-Object { $_ -match $SimulationService } | Select-Object -First 1) -join ''

if ($routingBlock -match "repo:\s+$ExpectedRepo") {
    Add-Result "$RoutingService GitHub repo" $true $ExpectedRepo
} else {
    Add-Result "$RoutingService GitHub repo" $false "Expected repo: $ExpectedRepo"
}

if ($simBlock -match "repo:\s+$ExpectedRepo") {
    Add-Result "$SimulationService GitHub repo" $true $ExpectedRepo
} else {
    Add-Result "$SimulationService GitHub repo" $false "Expected repo: $ExpectedRepo"
}

# --- Variables (simulation tuning) ---
$simVars = railway variable list -s $SimulationService 2>&1 | Out-String
$requiredSim = @{
    'CELERY_WORKER_QUEUES'                      = 'simulation'
    'CELERY_WORKER_POOL'                        = 'solo'
    'CELERY_WORKER_CONCURRENCY'                 = '2'
    'CELERY_WORKER_PREFETCH_MULTIPLIER'         = '1'
    'CELERY_MAX_TASKS_PER_CHILD'                = '50'
    'SCALE_SIM_ASYNC_ROUTING'                   = '1'
    'SCALE_MAX_STARTS_PER_LIVE_TICK'              = '400'
    'SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH'         = '3000'
    'SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK'   = '500'
    'SCALE_SIM_START_BUDGET_MODE'               = 'stable_active'
    'SCALE_SIM_OPTIMAL_TICK_SECONDS'            = '2'
    'SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP'         = '0'
    'SIM_BP_MIN_DISPATCH_PER_TICK'                = '120'
    'SIM_BP_DRAIN_DISPATCH_PER_TICK'              = '300'
    'SIM_BP_QUEUE_HEADROOM'                       = '150'
    'SCALE_SIM_RAMP_START_DELAY_MAX'              = '6'
    'SCALE_SIM_RAMP_TICKS'                        = '12'
    'SCALE_SIM_ROUTING_BACKEND'                   = 'auto'
    'OSRM_URL'                                    = 'http://osrm.railway.internal:5000'
}
function Test-RailwayVarLine {
    param([string]$Output, [string]$Key, [string]$Value)
    $pattern = [regex]::Escape($Key) + '.{1,80}' + [regex]::Escape($Value)
    foreach ($line in ($Output -split "`n")) {
        if ($line -match $pattern) { return $true }
    }
    return $false
}

function Test-OsrmReadyLogs {
    param([string]$Output)
    if ($Output -match 'Invalid RAILWAY_TOKEN|Unauthorized') { return $false }
    $ready = @(
        'Starting osrm-routed',
        'osrm-routed',
        'running and waiting for requests',
        'Listening on:',
        '200 /route/v1/car/',
        '200 /nearest/v1/car/'
    )
    foreach ($line in ($Output -split "`n")) {
        foreach ($needle in $ready) {
            if ($line -like "*$needle*") { return $true }
        }
    }
    return $false
}
foreach ($kv in $requiredSim.GetEnumerator()) {
    $ok = Test-RailwayVarLine -Output $simVars -Key $kv.Key -Value $kv.Value
    Add-Result "$SimulationService $($kv.Key)" $ok $(if ($ok) { $kv.Value } else { "expected $($kv.Value)" })
}

# --- Variables (routing queues) ---
$routeVars = railway variable list -s $RoutingService 2>&1 | Out-String
$requiredRoute = @{
    'CELERY_WORKER_QUEUES'              = 'routing'
    'CELERY_WORKER_POOL'                = 'solo'
    'CELERY_WORKER_CONCURRENCY'         = '6'
    'CELERY_WORKER_PREFETCH_MULTIPLIER' = '1'
    'CELERY_MAX_TASKS_PER_CHILD'        = '50'
    'SCALE_SIM_ASYNC_ROUTING'           = '1'
    'SCALE_SIM_ROUTING_BACKEND'         = 'auto'
    'OSRM_URL'                          = 'http://osrm.railway.internal:5000'
}
foreach ($kv in $requiredRoute.GetEnumerator()) {
    $ok = Test-RailwayVarLine -Output $routeVars -Key $kv.Key -Value $kv.Value
    Add-Result "$RoutingService $($kv.Key)" $ok $(if ($ok) { $kv.Value } else { "expected $($kv.Value)" })
}

if ($routeVars -match 'DATABASE_URL' -and $routeVars -match 'REDIS_URL') {
    Add-Result "$RoutingService DB/Redis" $true 'DATABASE_URL and REDIS_URL set'
} else {
    Add-Result "$RoutingService DB/Redis" $false 'Missing DATABASE_URL or REDIS_URL'
}

$backendService = 'Backend'
$backendVars = railway variable list -s $backendService 2>&1 | Out-String
$requiredBackend = @{
    'SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH'       = '3000'
    'SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK' = '500'
}
foreach ($kv in $requiredBackend.GetEnumerator()) {
    $ok = Test-RailwayVarLine -Output $backendVars -Key $kv.Key -Value $kv.Value
    Add-Result "$backendService $($kv.Key)" $ok $(if ($ok) { $kv.Value } else { "expected $($kv.Value)" })
}

# --- OSRM service ---
if ($svcList -match '\bosrm\b') {
    Add-Result 'osrm service exists' $true 'Listed in railway service list'
    $osrmLogs = railway logs -s osrm --lines 200 2>&1 | Out-String
    if (Test-OsrmReadyLogs -Output $osrmLogs) {
        Add-Result 'osrm logs (routed ready)' $true 'osrm-routed started'
    } elseif ($osrmLogs -match 'osrm-extract|osrm-customize|Downloading') {
        Add-Result 'osrm logs (routed ready)' $false 'Still building graph — wait and re-run verify'
    } else {
        Add-Result 'osrm logs (routed ready)' $false 'No osrm-routed in last 200 lines'
    }
} else {
    Add-Result 'osrm service exists' $false 'Run .\scripts\railway-setup-osrm.ps1'
}

# --- Logs: routing must be Celery, not Expo ---
$routeLogs = railway logs -s $RoutingService --lines 200 2>&1 | Out-String
if ($routeLogs -match 'expo start|Metro Bundler|Metro is running') {
    Add-Result "$RoutingService logs (no Expo)" $false 'Still shows Expo/Metro - wrong build'
} elseif ($routeLogs -match 'routing@|CELERY.*routing|Starting Celery.*routing|route_live_ride_task') {
    Add-Result "$RoutingService logs (Celery routing@)" $true 'Celery worker detected'
} else {
    Add-Result "$RoutingService logs (Celery routing@)" $false 'No routing@ / route_live_ride_task in last 200 lines'
}

# --- GraphQL build config (optional) ---
if ($env:RAILWAY_API_TOKEN) {
    $routingServiceId = '9b8fee23-e95c-41d2-a7e5-f9fae91e923c'
    $envId = 'f30e70a7-b4d2-42aa-8137-21faa091b969'
    $headers = @{
        Authorization = "Bearer $($env:RAILWAY_API_TOKEN)"
        'Content-Type'  = 'application/json'
    }
    $bodyJson = '{"query":"query { service(id: \"9b8fee23-e95c-41d2-a7e5-f9fae91e923c\") { serviceInstances { edges { node { source { repo } dockerfilePath railwayConfigFile rootDirectory } } } } }"}'
    try {
        $resp = Invoke-RestMethod -Uri 'https://backboard.railway.com/graphql/v2' -Method Post -Headers $headers -Body $bodyJson
        $node = $resp.data.service.serviceInstances.edges[0].node
        $dfOk = $node.dockerfilePath -eq $ExpectedDockerfile
        $cfgOk = $node.railwayConfigFile -eq $ExpectedConfigFile
        $repoOk = $node.source.repo -eq $ExpectedRepo
        Add-Result 'routing dockerfilePath (API)' $dfOk $node.dockerfilePath
        Add-Result 'routing railwayConfigFile (API)' $cfgOk $node.railwayConfigFile
        Add-Result 'routing source.repo (API)' $repoOk $node.source.repo
    } catch {
        Add-Result 'routing GraphQL config' $false $_.Exception.Message
    }
}

Pop-Location

Write-Host ''
Write-Host "=== Railway production verification ($ProjectName / $Environment) ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize

$failed = @($results | Where-Object { -not $_.Pass })
if ($failed.Count -gt 0) {
    Write-Host "FAIL: $($failed.Count) check(s)" -ForegroundColor Red
    exit 1
}
Write-Host 'PASS: all checks' -ForegroundColor Green
exit 0
