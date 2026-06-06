#Requires -Version 5.1
<#
.SYNOPSIS
  Add brouter-2 service to sim-lab Railway project.

.EXAMPLE
  .\infrastructure\sim-lab\scripts\setup-sim-lab-brouter-2.ps1
#>
param(
    [string]$ProjectId = "098b5266-2d8b-43f3-ba29-925aaa6b7b64",
    [string]$Environment = "production",
    [string]$WorkspaceId = "8aa1f35e-a716-4526-8209-5aadcaae2246",
    [string]$Repo = "karnalooch/stunning-pancake",
    [switch]$SkipVolume
)

$ErrorActionPreference = "Stop"
$env:CI = "true"
if ($env:RAILWAY_TOKEN) { Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue }
if (-not $env:RAILWAY_API_TOKEN) { throw "Set RAILWAY_API_TOKEN" }

$ServiceName = "brouter-2"
$ConfigPath = "/infrastructure/brouter-2/railway.json"
$SimLabRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ConfigureScript = Join-Path (Join-Path $SimLabRoot "..\..") "scripts\railway-configure-service-build.ps1"

function Invoke-RailwayJson([string[]]$RailwayArgs) {
    $tmp = Join-Path $env:TEMP ("railway-{0}.json" -f [guid]::NewGuid().ToString("n"))
    try {
        $prev = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & railway @RailwayArgs 1> $tmp 2>$null
        $ErrorActionPreference = $prev
        if (-not (Test-Path $tmp)) { return $null }
        return Get-Content $tmp -Raw | ConvertFrom-Json
    } catch { return $null }
    finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
}

Push-Location (Join-Path $SimLabRoot "..\..")
try {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    railway link -p $ProjectId -e $Environment -w $WorkspaceId 2>&1 | Out-Null
    $ErrorActionPreference = $prev

    $list = Invoke-RailwayJson @("service", "list", "--json")
    $has = $false
    if ($list) {
        $items = if ($list -is [array]) { $list } else { @($list) }
        $has = @($items | Where-Object { $_.name -eq $ServiceName }).Count -gt 0
    }

    if (-not $has) {
        Write-Host "Creating $ServiceName..."
        railway add --service $ServiceName --repo $Repo --json 2>&1 | Out-Null
        if (Test-Path $ConfigureScript) {
            & $ConfigureScript -ServiceName $ServiceName -RootDirectory "/" -DockerfilePath "/infrastructure/brouter/Dockerfile" -ConfigFilePath $ConfigPath
        }
    } else {
        Write-Host "$ServiceName already exists."
    }

    railway service link $ServiceName 2>&1 | Out-Null
    if (-not $SkipVolume) {
        railway volume add -m /brouter/segments4 2>&1 | Out-Null
    }

    railway variable set BROUTER_JAVA_XMX=1536m -s $ServiceName -e $Environment 2>&1 | Out-Null
    railway variable set BROUTER_SEGMENT_PRESET=poland -s $ServiceName -e $Environment 2>&1 | Out-Null

    $brouterUrls = "http://brouter.railway.internal:17777/brouter,http://brouter-2.railway.internal:17777/brouter"
    foreach ($svc in @("celery-worker-simulation", "celery-worker-routing", "backend")) {
        railway variable set "BROUTER_URLS=$brouterUrls" -s $svc -e $Environment 2>&1 | Out-Null
        Write-Host "  $svc : BROUTER_URLS"
    }

    railway redeploy -s $ServiceName -y --detach 2>&1 | Out-Null
    Write-Host "brouter-2 setup done. First boot may download PL tiles 10-30 min." -ForegroundColor Green
} finally {
    Pop-Location
}
