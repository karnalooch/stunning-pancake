#Requires -Version 5.1
<#
.SYNOPSIS
  Attach persistent volume to sim-lab TimescaleDB (requires custom Dockerfile image).

.EXAMPLE
  .\infrastructure\sim-lab\scripts\setup-sim-lab-timescaledb-image.ps1
  $env:RAILWAY_TOKEN = "<token>"
  .\infrastructure\sim-lab\scripts\setup-sim-lab-timescaledb-volume.ps1 -Attach -RedeployBackend
#>
param(
    [string]$ProjectId = "098b5266-2d8b-43f3-ba29-925aaa6b7b64",
    [string]$EnvironmentId = "0e5ae720-dd4e-4d09-b6a1-ff4d70bb7b99",
    [string]$Environment = "production",
    [string]$WorkspaceId = "8aa1f35e-a716-4526-8209-5aadcaae2246",
    [string]$DbService = "TimescaleDB",
    [string]$DbServiceId = "29863792-e89b-4467-aded-a3d52198ca7b",
    [string]$MountPath = "/var/lib/postgresql/data",
    [string]$VolumeNamePrefix = "timescaledb-volume",
    [string]$PreferredVolumeId = "2da85672-596c-4f2b-b6e6-9ba835f3234a",
    [switch]$CreateOnly,
    [switch]$Attach,
    [switch]$SkipRedeploy,
    [switch]$RedeployBackend
)

$ErrorActionPreference = "Stop"
$RailwayEap = "Continue"
$env:CI = "true"

if (-not $env:RAILWAY_TOKEN) {
    $env:RAILWAY_TOKEN = [Environment]::GetEnvironmentVariable("RAILWAY_TOKEN", "User")
}
if (-not $env:RAILWAY_TOKEN) { throw "Set RAILWAY_TOKEN" }
if ($env:RAILWAY_API_TOKEN) { Remove-Item Env:RAILWAY_API_TOKEN -ErrorAction SilentlyContinue }

function Convert-RailwayJsonText([string]$Raw) {
    $text = $Raw.Trim()
    if ($text.Length -ge 3 -and $text[0] -eq [char]0xFEFF) { $text = $text.Substring(1) }
    try { return ($text | ConvertFrom-Json) } catch {
        if ($text -match '(\{[\s\S]*\})') { return ($Matches[1] | ConvertFrom-Json) }
        if ($text -match '(\[[\s\S]*\])') { return ($Matches[1] | ConvertFrom-Json) }
        throw
    }
}

function Invoke-RailwayJson([string[]]$RailwayArgs) {
    $tmp = Join-Path $env:TEMP ("railway-vol-{0}.json" -f [guid]::NewGuid().ToString("n"))
    try {
        $prev = $ErrorActionPreference
        $ErrorActionPreference = $RailwayEap
        & railway @RailwayArgs 1> $tmp 2>$null
        $ErrorActionPreference = $prev
        if (-not (Test-Path $tmp)) { return $null }
        $raw = Get-Content -Path $tmp -Raw -Encoding UTF8
        if (-not $raw -or -not $raw.Trim()) { return $null }
        return (Convert-RailwayJsonText $raw)
    } finally {
        Remove-Item $tmp -ErrorAction SilentlyContinue
    }
}

function Invoke-RailwayQuiet([string[]]$RailwayArgs) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = $RailwayEap
    try { & railway @RailwayArgs 2>&1 | Out-Null } finally { $ErrorActionPreference = $prev }
}

Write-Host "=== Sim-lab TimescaleDB volume ===" -ForegroundColor Cyan
Invoke-RailwayQuiet @("link", "-p", $ProjectId, "-e", $Environment, "-w", $WorkspaceId, "--json")

$svcList = Invoke-RailwayJson @("service", "list", "--json")
if (-not $svcList) { throw "railway service list failed" }
$db = @($svcList | Where-Object { $_.name -eq $DbService } | Select-Object -First 1)
if (-not $db) { throw "Service not found: $DbService" }

$existing = @($db.volumes | Where-Object { $_.mountPath -eq $MountPath } | Select-Object -First 1)
$volumeId = $null
if ($existing) {
    Write-Host "Volume attached: $($existing.name) at $MountPath" -ForegroundColor Green
    $volumeId = $existing.name
} else {
    $volList = Invoke-RailwayJson @("volume", "list", "--json")
    $preferred = @($volList.volumes | Where-Object { $_.id -eq $PreferredVolumeId } | Select-Object -First 1)
    $orphan = if ($preferred) { $preferred } else {
        @($volList.volumes | Where-Object {
                $_.name -like "$VolumeNamePrefix*" -and -not $_.serviceName
            } | Select-Object -First 1)
    }
    if ($orphan) {
        Write-Host "Orphan volume: $($orphan.name) ($($orphan.id))"
        $volumeId = $orphan.id
    } else {
        Write-Host "Creating volume -> $MountPath"
        $added = Invoke-RailwayJson @("volume", "-s", $DbServiceId, "add", "-m", $MountPath, "--json")
        if (-not $added) { throw "railway volume add failed" }
        $volumeId = $added.id
        Write-Host ("  created: {0} ({1})" -f $added.name, $added.id) -ForegroundColor Green
    }
}

if ($CreateOnly -or -not $Attach) {
    Write-Host "Volume id: $volumeId | mount: $MountPath"
    Write-Host "Run setup-sim-lab-timescaledb-image.ps1 then -Attach -RedeployBackend"
    exit 0
}

$patch = @{
    services = @{
        $DbServiceId = @{
            volumeMounts = @{}
            deploy       = @{ startCommand = "/entrypoint-volume-fix.sh postgres" }
        }
    }
}
$patch.services[$DbServiceId].volumeMounts[$volumeId] = @{ mountPath = $MountPath }
$patchJson = $patch | ConvertTo-Json -Depth 6 -Compress
Write-Host "Attaching volume (no custom startCommand - image entrypoint handles lost+found)..."
$patchJson | railway environment edit --json 2>&1 | Out-Null

if (-not $SkipRedeploy) {
    Invoke-RailwayQuiet @("redeploy", "-s", $DbService, "-y")
    Start-Sleep -Seconds 60
    if ($RedeployBackend) {
        Invoke-RailwayQuiet @("redeploy", "-s", "backend", "-y")
        Start-Sleep -Seconds 45
    }
}

$svcList = Invoke-RailwayJson @("service", "list", "--json")
$db = @($svcList | Where-Object { $_.name -eq $DbService } | Select-Object -First 1)
Write-Host ("TimescaleDB: {0}" -f $db.status)
foreach ($v in $db.volumes) {
    Write-Host ("  {0} {1} {2}MB" -f $v.name, $v.mountPath, $v.sizeMb) -ForegroundColor Green
}
Write-Host "Done." -ForegroundColor Green
