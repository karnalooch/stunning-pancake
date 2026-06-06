#Requires -Version 5.1
<#
.SYNOPSIS
  Live-resize TimescaleDB (20 GB) and Redis (2048 MB) volumes on Railway production.

.DESCRIPTION
  Tries GraphQL volumeInstanceUpdate; on failure opens Dashboard Live Resize URLs.
#>
param(
    [int]$PostgresGB = 20,
    [int]$RedisMB = 2048,
    [switch]$OpenOnly
)

$ErrorActionPreference = 'Stop'
$ProjectId = if ($env:RAILWAY_PROJECT_ID) { $env:RAILWAY_PROJECT_ID } else { 'ce13089b-76f4-4114-a892-ad13e23c8761' }
$EnvironmentId = 'f30e70a7-b4d2-42aa-8137-21faa091b969'

$Targets = @(
    @{
        Name      = 'timescaledb-volume'
        ServiceId = '43162aea-dbe0-4738-a429-1bdc5da93430'
        VolumeId  = '425b40b8-fee9-4c8c-ac72-ce1f918785bc'
        SizeMB    = $PostgresGB * 1024
    },
    @{
        Name      = 'redis-volume'
        ServiceId = '2121e888-665e-4771-aef1-bc4e8aead3fb'
        VolumeId  = '62de8183-f529-4d90-95aa-bb27f369a10e'
        SizeMB    = $RedisMB
    }
)

function Invoke-RailwayGql([string]$Query, [hashtable]$Variables) {
    if (-not $env:RAILWAY_API_TOKEN) {
        throw 'RAILWAY_API_TOKEN required for GraphQL resize attempt.'
    }
    $headers = @{
        Authorization  = "Bearer $($env:RAILWAY_API_TOKEN)"
        'Content-Type' = 'application/json'
    }
    $body = @{ query = $Query; variables = $Variables } | ConvertTo-Json -Depth 8 -Compress
    return Invoke-RestMethod -Uri 'https://backboard.railway.com/graphql/v2' -Method Post -Headers $headers -Body $body -TimeoutSec 120
}

function Try-ResizeVolume([hashtable]$Target) {
    $name = $Target.Name
    $vid = $Target.VolumeId
    $mb = $Target.SizeMB
    Write-Host "`n=== $name -> $mb MB ===" -ForegroundColor Cyan

    $mutations = @(
        @{
            Label = 'volumeInstanceUpdate'
            Query = @'
mutation($volumeId: String!, $environmentId: String!, $input: VolumeInstanceUpdateInput!) {
  volumeInstanceUpdate(volumeId: $volumeId, environmentId: $environmentId, input: $input)
}
'@
            Variables = @{
                volumeId      = $vid
                environmentId = $EnvironmentId
                input         = @{ sizeMB = $mb }
            }
        },
        @{
            Label = 'volumeUpdate'
            Query = @'
mutation($volumeId: String!, $input: VolumeUpdateInput!) {
  volumeUpdate(volumeId: $volumeId, input: $input) { id name sizeMB }
}
'@
            Variables = @{
                volumeId = $vid
                input    = @{ sizeMB = $mb }
            }
        }
    )

    foreach ($m in $mutations) {
        try {
            $resp = Invoke-RailwayGql -Query $m.Query -Variables $m.Variables
            if ($resp.errors) {
                Write-Host "  $($m.Label): $($resp.errors | ConvertTo-Json -Compress)" -ForegroundColor Yellow
                continue
            }
            Write-Host "  OK via $($m.Label)" -ForegroundColor Green
            return $true
        } catch {
            Write-Host "  $($m.Label): $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    return $false
}

Push-Location $PSScriptRoot\..
$list = railway volume list --json 2>&1 | ConvertFrom-Json
foreach ($t in $Targets) {
    $vol = $list.volumes | Where-Object { $_.name -eq $t.Name } | Select-Object -First 1
    if ($vol) {
        Write-Host ("Current {0}: {1} MB used / {2} MB cap" -f $t.Name, [math]::Round($vol.currentSizeMB, 1), $vol.sizeMB)
    }
}

if (-not $OpenOnly) {
    $ok = 0
    foreach ($t in $Targets) {
        if (Try-ResizeVolume $t) { $ok++ }
    }
    if ($ok -eq $Targets.Count) {
        Write-Host "`nAll volumes resized via API." -ForegroundColor Green
        Pop-Location
        exit 0
    }
    Write-Host "`nGraphQL resize failed ($ok/$($Targets.Count)). Open Dashboard for Live Resize." -ForegroundColor Yellow
}

foreach ($t in $Targets) {
    $url = "https://railway.com/project/$ProjectId/service/$($t.ServiceId)/volumes?environmentId=$EnvironmentId"
    $sizeLabel = if ($t.Name -eq 'timescaledb-volume') { "$PostgresGB GB" } else { "$RedisMB MB" }
    Write-Host @"

--- $($t.Name) -> $sizeLabel ---
1. Open: $url
2. Click volume -> **Live Resize** -> select $sizeLabel from dropdown
3. Confirm: type exactly  I want to resize the volume

"@
    Start-Process $url
}

Pop-Location
Write-Host 'After Live Resize in UI, verify: railway volume list --json' -ForegroundColor Cyan
