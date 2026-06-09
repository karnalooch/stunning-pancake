#Requires -Version 5.1
<#
.SYNOPSIS
  Create Railway sim-lab project (isolated Postgres/Redis + simulation stack).

.EXAMPLE
  .\infrastructure\sim-lab\scripts\create-sim-lab-railway.ps1
  .\infrastructure\sim-lab\scripts\create-sim-lab-railway.ps1 -SkipDeploys
#>
param(
    [string]$ProjectName = "4velo-sim-lab",
    [string]$Workspace = "8aa1f35e-a716-4526-8209-5aadcaae2246",
    [string]$Repo = "karnalooch/stunning-pancake",
    [string]$Environment = "production",
    [switch]$SkipDeploys,
    [switch]$ForceNewProject,
    [string]$DefaultProjectId = "098b5266-2d8b-43f3-ba29-925aaa6b7b64",
    [string]$DefaultEnvironmentId = "0e5ae720-dd4e-4d09-b6a1-ff4d70bb7b99"
)

$ErrorActionPreference = "Stop"
# Railway CLI writes progress to stderr; do not treat as terminating errors.
$RailwayEap = "Continue"
if ($env:RAILWAY_TOKEN) { Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue }
if (-not $env:RAILWAY_API_TOKEN) { throw "Set RAILWAY_API_TOKEN (User env)" }
$env:CI = "true"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$ConfigureScript = Join-Path $RepoRoot "scripts\railway-configure-service-build.ps1"
$SyncProfileScript = Join-Path $PSScriptRoot "sync-sim-lab-profile.ps1"

$ServiceDefs = @(
    @{ Name = "backend";                  Root = "/backend";                  Config = $null; Dockerfile = $null },
    @{ Name = "celery-worker-simulation"; Root = "/";                        Config = "/celery-worker-simulation/railway.json"; Dockerfile = "/celery-worker-simulation/Dockerfile" },
    @{ Name = "celery-worker-routing";    Root = "/";                        Config = "/celery-worker-routing/railway.json";    Dockerfile = "/celery-worker-simulation/Dockerfile" },
    @{ Name = "celery-worker";            Root = "/";                        Config = "/celery-worker/railway.json";            Dockerfile = "/celery-worker/Dockerfile" },
    @{ Name = "telemetry";                Root = "/telemetry";                Config = "/telemetry/railway.json";                Dockerfile = "Dockerfile" },
    @{ Name = "brouter";                  Root = "/";                        Config = "/infrastructure/brouter/railway.json"; Dockerfile = "/infrastructure/brouter/Dockerfile" },
    @{ Name = "osrm";                     Root = "/";                        Config = "/infrastructure/osrm/railway.json";      Dockerfile = "/infrastructure/osrm/Dockerfile" }
)

function Convert-RailwayJsonText([string]$Raw) {
    $text = $Raw.Trim()
    if ($text.Length -ge 3 -and $text[0] -eq [char]0xFEFF) { $text = $text.Substring(1) }
    try {
        return ($text | ConvertFrom-Json)
    } catch {
        if ($text -match '(\[[\s\S]*\])') {
            return ($Matches[1] | ConvertFrom-Json)
        }
        if ($text -match '(\{[\s\S]*\})') {
            return ($Matches[1] | ConvertFrom-Json)
        }
        throw
    }
}

function Invoke-RailwayJson([string[]]$RailwayArgs) {
    $tmp = Join-Path $env:TEMP ("railway-{0}.json" -f [guid]::NewGuid().ToString("n"))
    try {
        $prev = $ErrorActionPreference
        $ErrorActionPreference = $RailwayEap
        $argLine = ($RailwayArgs | ForEach-Object { if ($_ -match '\s') { "`"$_`"" } else { $_ } }) -join ' '
        $cmd = "railway $argLine 1> `"$tmp`" 2>`$null"
        Invoke-Expression $cmd
        $ErrorActionPreference = $prev
        if (-not (Test-Path $tmp)) { throw "railway produced no output: $($RailwayArgs -join ' ')" }
        $raw = Get-Content -Path $tmp -Raw -Encoding UTF8
        if (-not $raw -or -not $raw.Trim()) { throw "railway empty output: $($RailwayArgs -join ' ')" }
        return (Convert-RailwayJsonText $raw)
    } finally {
        Remove-Item $tmp -ErrorAction SilentlyContinue
    }
}

function Invoke-Railway([string[]]$RailwayArgs) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = $RailwayEap
    try {
        & railway @RailwayArgs 2>$null | Out-Null
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Get-ProjectByName([string]$Name) {
    if ($Name -eq $ProjectName -and $DefaultProjectId -and -not $ForceNewProject) {
        return [pscustomobject]@{
            id = $DefaultProjectId
            name = $Name
            environments = @{ edges = @(@{ node = @{ id = $DefaultEnvironmentId; name = $Environment } }) }
        }
    }
    $all = Invoke-RailwayJson @("list", "--json")
    if ($all -isnot [array]) { $all = @($all) }
    return @($all | Where-Object { $_.name -eq $Name } | Select-Object -First 1)[0]
}

function Ensure-Service([string]$Name) {
    $list = Invoke-RailwayJson @("service", "list", "--json")
    $existing = @($list | Where-Object { $_.name -eq $Name } | Select-Object -First 1)[0]
    if ($existing) {
        Write-Host "  service exists: $Name"
        return $existing.id
    }
    Write-Host "  creating service: $Name"
    Invoke-Railway @("add", "--service", $Name, "--repo", $Repo, "--json") | Out-Null
    Start-Sleep -Seconds 2
    $list = Invoke-RailwayJson @("service", "list", "--json")
    $svc = @($list | Where-Object { $_.name -eq $Name } | Select-Object -First 1)[0]
    if (-not $svc) { throw "Failed to create service $Name" }
    return $svc.id
}

function Ensure-TimescalePostgis {
    $list = Invoke-RailwayJson @("service", "list", "--json")
    $existing = $list | Where-Object { $_.name -in @("TimescaleDB", "Timescale", "Postgres") } | Select-Object -First 1
    if ($existing -and $existing.name -eq "TimescaleDB") {
        Write-Host "  database exists: TimescaleDB"
        return "TimescaleDB"
    }
    if ($existing -and $existing.name -eq "Postgres") {
        Write-Host "  WARNING: vanilla Postgres found (no PostGIS). Add TimescaleDB via dashboard or delete Postgres and re-run."
    }
    Write-Host "  adding TimescaleDB (PostGIS) image..."
    $tmp = Join-Path $env:TEMP ("railway-add-ts-{0}.json" -f [guid]::NewGuid().ToString("n"))
    $ErrorActionPreference = $RailwayEap
    railway add --image "ghcr.io/railwayapp-templates/timescale-postgis-ssl:pg16-ts2.13" --service TimescaleDB --json 1> $tmp 2>$null
    Start-Sleep -Seconds 5
    Write-Host "  set POSTGRES_* on TimescaleDB (required for template image)"
    foreach ($v in @("POSTGRES_USER=postgres", "POSTGRES_DB=railway", "PGDATA=/var/lib/postgresql/data/pgdata")) {
        Invoke-Railway @("variable", "set", $v, "-s", "TimescaleDB", "-e", $Environment, "--skip-deploys") | Out-Null
    }
    Invoke-Railway @("redeploy", "-s", "TimescaleDB", "-y") | Out-Null
    Start-Sleep -Seconds 20
    $volScript = Join-Path $PSScriptRoot "setup-sim-lab-timescaledb-volume.ps1"
    if ((Test-Path $volScript) -and ($env:RAILWAY_API_TOKEN -or $env:RAILWAY_TOKEN)) {
        Write-Host "  create TimescaleDB volume (attach via Dashboard - see sim-lab README)"
        & $volScript -CreateOnly 2>&1 | Out-Null
    }
    return "TimescaleDB"
}

function Ensure-Database([string]$Kind) {
    if ($Kind -eq "postgres") { return (Ensure-TimescalePostgis) }
    $list = Invoke-RailwayJson @("service", "list", "--json")
    $names = switch ($Kind) {
        "redis" { @("Redis", "redis") }
        default { @($Kind) }
    }
    $existing = $list | Where-Object { $_.name -in $names } | Select-Object -First 1
    if ($existing) {
        Write-Host "  database exists: $($existing.name)"
        return $existing.name
    }
    Write-Host "  adding database: $Kind"
    Invoke-Railway @("add", "--database", $Kind, "--json") | Out-Null
    Start-Sleep -Seconds 3
    $list = Invoke-RailwayJson @("service", "list", "--json")
    $db = $list | Where-Object { $_.name -in $names } | Select-Object -First 1
    if (-not $db) { $db = $list | Where-Object { $_.name -match $Kind } | Select-Object -First 1 }
    return $db.name
}

Push-Location $RepoRoot
try {
    Write-Host "=== Railway sim-lab: $ProjectName ===" -ForegroundColor Cyan

    $project = Get-ProjectByName $ProjectName
    if ($project -and -not $ForceNewProject) {
        Write-Host "Project already exists: $($project.id)"
        $ProjectId = $project.id
        $EnvironmentId = $project.environments.edges[0].node.id
    }
    else {
        if ($project -and $ForceNewProject) { throw "Project $ProjectName exists; remove -ForceNewProject or delete manually" }
        Write-Host "Creating project $ProjectName ..."
        $init = Invoke-RailwayJson @("init", "-n", $ProjectName, "-w", $Workspace, "--json")
        $ProjectId = $init.id
        if (-not $ProjectId) { throw "railway init did not return project id" }
        Write-Host "  project_id=$ProjectId"
    }

    $link = Invoke-RailwayJson @("link", "-p", $ProjectId, "-e", $Environment, "-w", $Workspace, "--json")
    if ($link.environmentId) { $EnvironmentId = $link.environmentId }
    if (-not $EnvironmentId) {
        $st = Invoke-RailwayJson @("status", "--json")
        $EnvironmentId = $st.environmentId
    }
    if (-not $EnvironmentId) { throw "Could not resolve environment id" }
    Write-Host "  linked env_id=$EnvironmentId"

    Ensure-Database "postgres" | Out-Null
    Ensure-Database "redis" | Out-Null

    $svcList = Invoke-RailwayJson @("service", "list", "--json")
    $pgName = ($svcList | Where-Object { $_.name -eq 'TimescaleDB' } | Select-Object -First 1).name
    if (-not $pgName) {
        $pgName = ($svcList | Where-Object { $_.name -match 'Postgres|PostgreSQL|Timescale' } | Select-Object -First 1).name
    }
    $redisName = ($svcList | Where-Object { $_.name -eq 'Redis' } | Select-Object -First 1).name
    if (-not $pgName) { $pgName = "TimescaleDB" }
    if (-not $redisName) { $redisName = "Redis" }

    $sharedVars = @(
        "DATABASE_URL=`${{$pgName.DATABASE_URL}}",
        "REDIS_URL=`${{$redisName.REDIS_URL}}",
        "CELERY_BROKER_URL=`${{$redisName.REDIS_URL}}",
        "CELERY_RESULT_BACKEND=`${{$redisName.REDIS_URL}}/1",
        "SENTRY_ENVIRONMENT=sim-lab",
        "BROUTER_URL=http://brouter.railway.internal:17777/brouter",
        "OSRM_URL=http://osrm.railway.internal:5000",
        "TELEMETRY_URL=http://telemetry.railway.internal:8001"
    )

    $skip = @()
    if ($SkipDeploys) { $skip = @("--skip-deploys") }

    foreach ($def in $ServiceDefs) {
        $sid = Ensure-Service $def.Name
        $cfgArgs = @{
            ServiceId      = $sid
            ServiceName    = $def.Name
            EnvironmentId  = $EnvironmentId
            RootDirectory  = $def.Root
        }
        if ($def.Dockerfile) { $cfgArgs.DockerfilePath = $def.Dockerfile }
        if ($def.Config) { $cfgArgs.ConfigFilePath = $def.Config }
        & $ConfigureScript @cfgArgs
        if ($def.Name -in @("backend", "celery-worker-simulation", "celery-worker-routing", "celery-worker", "telemetry")) {
            foreach ($v in $sharedVars) {
                $varArgs = @("variable", "set", $v, "-s", $def.Name, "-e", $Environment) + $skip
                Invoke-Railway $varArgs | Out-Null
            }
        }
    }

    $env:SIM_LAB_PROJECT_ID = $ProjectId
    & $SyncProfileScript -Profile "300k-50k" -ProjectId $ProjectId -Environment $Environment @(
        if ($SkipDeploys) { "-SkipDeploys" }
    )

    if (-not $SkipDeploys) {
        Write-Host "Triggering deploys (sim stack)..." -ForegroundColor Cyan
        foreach ($n in @("brouter", "osrm", "backend", "telemetry", "celery-worker", "celery-worker-routing", "celery-worker-simulation")) {
            Invoke-Railway @("redeploy", "-s", $n, "-y", "--from-source", "--json") | Out-Null
            Write-Host "  redeploy: $n"
        }
    }

    $backendUrl = $null
    try {
        Invoke-Railway @("service", "link", "backend") | Out-Null
        $dom = Invoke-RailwayJson @("domain", "--json")
        $hostUrl = $null
        if ($dom.domain) { $hostUrl = $dom.domain }
        elseif ($dom.domains -and $dom.domains.Count -gt 0) { $hostUrl = $dom.domains[0] }
        if ($hostUrl) {
            if ($hostUrl -notmatch '^https?://') { $hostUrl = "https://$hostUrl" }
            $backendUrl = "$($hostUrl.TrimEnd('/'))/api"
        }
    } catch { }

    $outPath = Join-Path $RepoRoot "infrastructure\sim-lab\railway\sim-lab.created.env"
    @"
# Generated $(Get-Date -Format o) - do not commit secrets
SIM_LAB_PROJECT_NAME=$ProjectName
SIM_LAB_PROJECT_ID=$ProjectId
SIM_LAB_ENVIRONMENT_ID=$EnvironmentId
SIM_LAB_ENVIRONMENT=$Environment
SIM_LAB_API_BASE=$backendUrl
"@ | Set-Content -Path $outPath -Encoding UTF8

    Write-Host ""
    Write-Host "=== Sim-lab project ready ===" -ForegroundColor Green
    Write-Host "  Project:  $ProjectName ($ProjectId)"
    Write-Host "  Env file: infrastructure/sim-lab/railway/sim-lab.created.env"
    Write-Host ""
    Write-Host "Next:"
    Write-Host "  1. Dashboard: attach brouter volume /brouter/segments4 (Poland tiles)"
    Write-Host "  2. Dashboard: Postgres volume >= 30 GB, Redis >= 2 GB for 300k profile"
    Write-Host "  3. railway domain -s backend  (if no public URL yet)"
    Write-Host "  4. `$env:SIM_LAB_API_BASE = 'https://<backend>/api'"
    Write-Host "  5. .\infrastructure\sim-lab\scripts\preflight-sim-lab.ps1"
} finally {
    Pop-Location
}
