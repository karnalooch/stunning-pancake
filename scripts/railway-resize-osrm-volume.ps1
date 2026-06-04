#Requires -Version 5.1
<#
.SYNOPSIS
  Live-resize osrm-volume in Railway UI, or recreate volume on Pro (50 GB default).

.DESCRIPTION
  Hobby: 5 GB default — resize to >= 15 GB. Pro: new volume via `railway volume add -m /data` is ~50 GB.
  After resize in UI, redeploy: railway redeploy -s osrm -y --from-source

.EXAMPLE
  .\scripts\railway-resize-osrm-volume.ps1
  .\scripts\railway-resize-osrm-volume.ps1 -OpenOnly
#>
param(
    [switch]$OpenOnly,
    [int]$TargetSizeGB = 15
)

$ErrorActionPreference = 'Stop'
$ProjectId = if ($env:RAILWAY_PROJECT_ID) { $env:RAILWAY_PROJECT_ID } else { 'ce13089b-76f4-4114-a892-ad13e23c8761' }
$ServiceId = '4d0355ff-03fd-4e3c-a88e-99cbe853876c'
$EnvironmentId = 'f30e70a7-b4d2-42aa-8137-21faa091b969'

Push-Location $PSScriptRoot\..
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
railway link -p $ProjectId -e production --json 2>&1 | Out-Null
railway service link osrm 2>&1 | Out-Null
$ErrorActionPreference = $prevEap

$list = railway volume list --json 2>&1 | ConvertFrom-Json
$osrmVol = $list.volumes | Where-Object { $_.name -eq 'osrm-volume' } | Select-Object -First 1
if ($osrmVol) {
    Write-Host "Current osrm-volume: sizeMB=$($osrmVol.sizeMB) usedMB=$([math]::Round($osrmVol.currentSizeMB,2))"
} else {
    Write-Warning 'osrm-volume not found — run .\scripts\railway-setup-osrm.ps1 first'
}

$url = "https://railway.com/project/$ProjectId/service/$ServiceId/volumes?environmentId=$EnvironmentId"
Write-Host @"

=== Resize osrm-volume to $TargetSizeGB GB (Railway UI) ===

1. Dashboard opens (or open manually):
   $url

2. Click **osrm-volume** (mount /data) -> **Live Resize** -> $TargetSizeGB GB -> Confirm

3. Redeploy OSRM:
   railway redeploy -s osrm -y --from-source

4. Logs should show download + osrm-extract (not 'volume needs >= 8 GiB'):
   railway logs -s osrm --lines 50

"@
Start-Process $url
Pop-Location

if (-not $OpenOnly) {
    Write-Host 'Waiting for resize in UI — press Enter after Live Resize completes, then redeploy...'
    Read-Host
    railway redeploy -s osrm -y --from-source 2>&1
}
