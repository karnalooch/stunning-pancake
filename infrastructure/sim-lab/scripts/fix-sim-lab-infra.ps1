#Requires -Version 5.1
<#
.SYNOPSIS
  Sim-lab infra fixes: orphan volumes (e.g. timescaledb-volume — delete via Dashboard if CLI fails),
  brouter segment verify, ramp watch.

.EXAMPLE
  $env:ADMIN_PASS = 'admin123'
  .\infrastructure\sim-lab\scripts\fix-sim-lab-infra.ps1
  .\infrastructure\sim-lab\scripts\fix-sim-lab-infra.ps1 -SkipRampWatch
#>
param(
    [string]$ProjectId = "098b5266-2d8b-43f3-ba29-925aaa6b7b64",
    [string]$Environment = "production",
    [string]$WorkspaceId = "8aa1f35e-a716-4526-8209-5aadcaae2246",
    [int]$TargetActive = 50000,
    [switch]$SkipRampWatch,
    [switch]$RedeployBrouter
)

$ErrorActionPreference = "Stop"
$env:CI = "true"
if ($env:RAILWAY_TOKEN) { Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue }
if (-not $env:RAILWAY_API_TOKEN) { throw "Set RAILWAY_API_TOKEN" }

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
Push-Location $RepoRoot
try {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    railway link -p $ProjectId -e $Environment -w $WorkspaceId 2>&1 | Out-Null
    $ErrorActionPreference = $prev

    Write-Host "=== Orphan volumes ===" -ForegroundColor Cyan
    $volJson = railway volume list --json 2>&1 | Out-String
    $vols = $volJson | ConvertFrom-Json
    $orphans = @($vols.volumes | Where-Object { -not $_.serviceName })
    foreach ($o in $orphans) {
        Write-Host "  delete orphan: $($o.name) ($($o.id))"
        railway volume delete -v $o.id -y 2>&1 | Out-Host
    }
    if ($orphans.Count -eq 0) {
        Write-Host "  none" -ForegroundColor Green
    } else {
        $still = @((railway volume list --json 2>&1 | Out-String | ConvertFrom-Json).volumes | Where-Object { -not $_.serviceName })
        if ($still.Count -gt 0) {
            Write-Host "  CLI delete may require Dashboard: Project -> Volume -> Delete ($($still.name -join ', '))" -ForegroundColor Yellow
        }
    }

    if ($RedeployBrouter) {
        Write-Host "=== Redeploy brouter (segment persist check) ===" -ForegroundColor Cyan
        foreach ($s in @("brouter", "brouter-2")) {
            railway redeploy -s $s -e $Environment -p $ProjectId -y 2>&1 | Out-Host
        }
        Start-Sleep -Seconds 45
    }

    Write-Host "=== BRouter segment check (logs) ===" -ForegroundColor Cyan
    foreach ($s in @("brouter", "brouter-2")) {
        $log = railway logs -s $s -e $Environment -p $ProjectId --lines 40 2>&1 | Out-String
        $present = ([regex]::Matches($log, "segment present")).Count
        $downloads = ([regex]::Matches($log, "downloading")).Count
        $ok = ($present -ge 10)
        $color = if ($ok) { "Green" } else { "Yellow" }
        Write-Host ("  {0}: present={1} downloading={2}" -f $s, $present, $downloads) -ForegroundColor $color
        if (-not $ok -and -not $RedeployBrouter) {
            Write-Host "  -> re-run with -RedeployBrouter if tiles missing" -ForegroundColor Yellow
        }
    }

    if (-not $SkipRampWatch) {
        Write-Host "=== Ramp watch (no simulation redeploy) ===" -ForegroundColor Cyan
        & (Join-Path $PSScriptRoot "watch-sim-lab-ramp.ps1") -TargetActive $TargetActive -TimeoutMin 180
    }
} finally {
    Pop-Location
}
