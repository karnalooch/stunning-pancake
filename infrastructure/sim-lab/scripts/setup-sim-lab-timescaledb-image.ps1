#Requires -Version 5.1
<#
.SYNOPSIS
  Point sim-lab TimescaleDB at custom Dockerfile (root entrypoint for Railway volumes).

.EXAMPLE
  $env:RAILWAY_TOKEN = "<4velo-sim-lab project token>"
  .\infrastructure\sim-lab\scripts\setup-sim-lab-timescaledb-image.ps1
#>
param(
    [string]$ProjectId = "098b5266-2d8b-43f3-ba29-925aaa6b7b64",
    [string]$EnvironmentId = "0e5ae720-dd4e-4d09-b6a1-ff4d70bb7b99",
    [string]$Environment = "production",
    [string]$WorkspaceId = "8aa1f35e-a716-4526-8209-5aadcaae2246",
    [string]$DbService = "TimescaleDB",
    [string]$DbServiceId = "29863792-e89b-4467-aded-a3d52198ca7b",
    [string]$Repo = "karnalooch/stunning-pancake",
    [string]$Branch = "main",
    [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
$RailwayEap = "Continue"
$env:CI = "true"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")

if (-not $env:RAILWAY_TOKEN) {
    $env:RAILWAY_TOKEN = [Environment]::GetEnvironmentVariable("RAILWAY_TOKEN", "User")
}
if (-not $env:RAILWAY_TOKEN) { throw "Set RAILWAY_TOKEN" }
if ($env:RAILWAY_API_TOKEN) { Remove-Item Env:RAILWAY_API_TOKEN -ErrorAction SilentlyContinue }

$patch = @{
    services = @{
        $DbServiceId = @{
            source = @{
                repo           = $Repo
                branch         = $Branch
                rootDirectory  = "/infrastructure/sim-lab/timescaledb"
            }
            build = @{
                builder           = "DOCKERFILE"
                dockerfilePath    = "Dockerfile"
                railwayConfigFile = "railway.json"
            }
            deploy = @{
                startCommand = $null
            }
        }
    }
} | ConvertTo-Json -Depth 8 -Compress

Write-Host "=== TimescaleDB -> custom Dockerfile (root volume entrypoint) ===" -ForegroundColor Cyan
$prev = $ErrorActionPreference
$ErrorActionPreference = $RailwayEap
railway link -p $ProjectId -e $Environment -w $WorkspaceId --json 2>&1 | Out-Null
$ErrorActionPreference = $prev

Write-Host "Patching environment config..."
$patchFile = Join-Path $env:TEMP ("railway-ts-patch-{0}.json" -f [guid]::NewGuid().ToString("n"))
Set-Content -Path $patchFile -Value $patch -NoNewline -Encoding UTF8
try {
    Get-Content -Path $patchFile -Raw | railway environment edit --json 2>&1 | Out-Host
} finally {
    Remove-Item $patchFile -ErrorAction SilentlyContinue
}

if ($SkipDeploy) {
    Write-Host "SkipDeploy: run railway up from repo root when ready." -ForegroundColor Yellow
    exit 0
}

Push-Location $RepoRoot
try {
    Write-Host "Upload + deploy TimescaleDB (path-as-root, small context)..."
    $tsDir = Join-Path $RepoRoot "infrastructure\sim-lab\timescaledb"
    $prev = $ErrorActionPreference
    $ErrorActionPreference = $RailwayEap
    railway up $tsDir --path-as-root -s $DbService -p $ProjectId -e $Environment -d -m "sim-lab timescaledb root entrypoint for volume" 2>&1 | Out-Host
    $ErrorActionPreference = $prev
} finally {
    Pop-Location
}

Write-Host "Done. Attach volume: setup-sim-lab-timescaledb-volume.ps1 -Attach -RedeployBackend" -ForegroundColor Green
