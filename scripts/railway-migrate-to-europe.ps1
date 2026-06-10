#Requires -Version 5.1
<#
.SYNOPSIS
  Move all marvelous-gratitude + 4velo-sim-lab services to EU West (Amsterdam), US West = 0.

.DESCRIPTION
  Uses Railway GraphQL multiRegionConfig (no git redeploy required).
  Volumes on DB/OSRM/brouter migrate with the service (expect brief downtime on stateful services).

.EXAMPLE
  $env:RAILWAY_API_TOKEN = '...'
  .\scripts\railway-migrate-to-europe.ps1
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $env:RAILWAY_API_TOKEN) { throw 'RAILWAY_API_TOKEN required' }

$EuRegion = 'europe-west4-drams3a'
$UsRegion = 'us-west2'
$env:CI = 'true'

$projects = @(
    @{
        Name = 'marvelous-gratitude'
        ProjectId = 'ce13089b-76f4-4114-a892-ad13e23c8761'
        Environment = 'production'
        Services = @(
            @{ Name = 'Admin'; Id = 'e6d1866a-4a54-4c01-818b-21375acbafcc'; Replicas = 1 }
            @{ Name = 'Backend'; Id = 'ee60ca3f-5012-481c-acda-66246eb8e0fd'; Replicas = 1 }
            @{ Name = 'brouter'; Id = 'a243cb53-666f-4075-b7c7-c2b3276fd836'; Replicas = 1 }
            @{ Name = 'brouter-2'; Id = 'bf267f85-7943-4434-9210-78f4ee1b01ea'; Replicas = 1 }
            @{ Name = 'celery-beat'; Id = '1ef4a614-58b1-4e5b-9c0f-553eeb0d3a9a'; Replicas = 1 }
            @{ Name = 'celery-worker'; Id = '09b10d2c-b31a-4f07-bafd-527b06ca058e'; Replicas = 1 }
            @{ Name = 'celery-worker-routing'; Id = '9b8fee23-e95c-41d2-a7e5-f9fae91e923c'; Replicas = 1 }
            @{ Name = 'celery-worker-simulation'; Id = '0269afd4-1a6a-4da4-b23c-078b08fbb1f4'; Replicas = 1 }
            @{ Name = 'osrm'; Id = '4d0355ff-03fd-4e3c-a88e-99cbe853876c'; Replicas = 1 }
            @{ Name = 'Redis'; Id = '2121e888-665e-4771-aef1-bc4e8aead3fb'; Replicas = 1 }
            @{ Name = 'telemetry'; Id = '82bd9315-4a39-4158-a6e5-3e98ae2c5b0c'; Replicas = 1 }
            @{ Name = 'TimescaleDB'; Id = '43162aea-dbe0-4738-a429-1bdc5da93430'; Replicas = 1 }
        )
    }
    @{
        Name = '4velo-sim-lab'
        ProjectId = '098b5266-2d8b-43f3-ba29-925aaa6b7b64'
        Environment = 'production'
        Services = @(
            @{ Name = 'backend'; Id = 'e44e32d6-3d42-4813-8702-98933d15cfaa'; Replicas = 1 }
            @{ Name = 'brouter'; Id = '3207aa5c-b9c9-4428-883a-7400cdfc765f'; Replicas = 1 }
            @{ Name = 'brouter-2'; Id = 'e9f6d579-85c8-47ca-ab5a-bcb1529b546a'; Replicas = 1 }
            @{ Name = 'celery-worker'; Id = '53c9d653-53fe-4dc8-af89-fe4cb08de56f'; Replicas = 1 }
            @{ Name = 'celery-worker-routing'; Id = '730cd78b-7bdf-4a09-bb33-95f744ea6ce9'; Replicas = 8 }
            @{ Name = 'celery-worker-simulation'; Id = '42fed23c-2f6c-4833-b3af-d7e1a8e39cce'; Replicas = 1 }
            @{ Name = 'osrm'; Id = 'd458d2f7-b3f3-43a3-8c32-762aceb09c5f'; Replicas = 1 }
            @{ Name = 'Redis'; Id = '01fda3ab-decf-43bb-883d-ff7d3d21aa06'; Replicas = 1 }
            @{ Name = 'telemetry'; Id = 'e5f8c358-cc45-49d5-89e5-a9f84c748824'; Replicas = 1 }
            @{ Name = 'TimescaleDB'; Id = '29863792-e89b-4467-aded-a3d52198ca7b'; Replicas = 1 }
        )
    }
)

$failed = @()
foreach ($proj in $projects) {
    Write-Host "=== $($proj.Name) -> EU ($EuRegion) ===" -ForegroundColor Cyan
    foreach ($svc in $proj.Services) {
        try {
            $scaleOut = railway service scale `
                --service $svc.Name `
                -e $proj.Environment `
                -p $proj.ProjectId `
                "${EuRegion}=$($svc.Replicas)" `
                "${UsRegion}=0" 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  FAIL $($svc.Name): $scaleOut" -ForegroundColor Red
                $failed += "$($proj.Name)/$($svc.Name)"
            } else {
                Write-Host "  OK $($svc.Name) eu=$($svc.Replicas) us=0" -ForegroundColor Green
            }
        } catch {
            Write-Host "  ERR $($svc.Name): $($_.Exception.Message)" -ForegroundColor Red
            $failed += "$($proj.Name)/$($svc.Name)"
        }
        Start-Sleep -Seconds 2
    }
}

if ($failed.Count -gt 0) {
    Write-Host "`nIncomplete ($($failed.Count)): $($failed -join ', ')" -ForegroundColor Yellow
    exit 1
}
Write-Host "`nAll services pinned to EU West. US West replicas = 0." -ForegroundColor Green
