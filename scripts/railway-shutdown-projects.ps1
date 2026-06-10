#Requires -Version 5.1
<#
.SYNOPSIS
  Stop all services in marvelous-gratitude + 4velo-sim-lab (0 replicas, no delete).

.DESCRIPTION
  Uses GraphQL multiRegionConfig (no redeploy) — same pattern as backend/activities/railway_osrm_lifecycle.py.
  Requires RAILWAY_API_TOKEN. Volumes, env vars, and service definitions are preserved.

.EXAMPLE
  .\scripts\railway-shutdown-projects.ps1
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $env:RAILWAY_API_TOKEN) { throw 'RAILWAY_API_TOKEN required' }

$headers = @{
    Authorization = "Bearer $($env:RAILWAY_API_TOKEN)"
    'Content-Type'  = 'application/json'
}
$mutation = 'mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) { serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input) }'
$zeroCfg = @{
    'europe-west4-drams3a' = @{ numReplicas = 0 }
    'us-west2'             = @{ numReplicas = 0 }
}

$projects = @(
    @{
        Name = 'marvelous-gratitude'
        EnvironmentId = 'f30e70a7-b4d2-42aa-8137-21faa091b969'
        Services = @(
            @{ Name = 'Admin'; Id = 'e6d1866a-4a54-4c01-818b-21375acbafcc' }
            @{ Name = 'Backend'; Id = 'ee60ca3f-5012-481c-acda-66246eb8e0fd' }
            @{ Name = 'brouter'; Id = 'a243cb53-666f-4075-b7c7-c2b3276fd836' }
            @{ Name = 'brouter-2'; Id = 'bf267f85-7943-4434-9210-78f4ee1b01ea' }
            @{ Name = 'celery-beat'; Id = '1ef4a614-58b1-4e5b-9c0f-553eeb0d3a9a' }
            @{ Name = 'celery-worker'; Id = '09b10d2c-b31a-4f07-bafd-527b06ca058e' }
            @{ Name = 'celery-worker-routing'; Id = '9b8fee23-e95c-41d2-a7e5-f9fae91e923c' }
            @{ Name = 'celery-worker-simulation'; Id = '0269afd4-1a6a-4da4-b23c-078b08fbb1f4' }
            @{ Name = 'osrm'; Id = '4d0355ff-03fd-4e3c-a88e-99cbe853876c' }
            @{ Name = 'Redis'; Id = '2121e888-665e-4771-aef1-bc4e8aead3fb' }
            @{ Name = 'telemetry'; Id = '82bd9315-4a39-4158-a6e5-3e98ae2c5b0c' }
            @{ Name = 'TimescaleDB'; Id = '43162aea-dbe0-4738-a429-1bdc5da93430' }
        )
    }
    @{
        Name = '4velo-sim-lab'
        EnvironmentId = '0e5ae720-dd4e-4d09-b6a1-ff4d70bb7b99'
        Services = @(
            @{ Name = 'backend'; Id = 'e44e32d6-3d42-4813-8702-98933d15cfaa' }
            @{ Name = 'brouter'; Id = '3207aa5c-b9c9-4428-883a-7400cdfc765f' }
            @{ Name = 'brouter-2'; Id = 'e9f6d579-85c8-47ca-ab5a-bcb1529b546a' }
            @{ Name = 'celery-worker'; Id = '53c9d653-53fe-4dc8-af89-fe4cb08de56f' }
            @{ Name = 'celery-worker-routing'; Id = '730cd78b-7bdf-4a09-bb33-95f744ea6ce9' }
            @{ Name = 'celery-worker-simulation'; Id = '42fed23c-2f6c-4833-b3af-d7e1a8e39cce' }
            @{ Name = 'osrm'; Id = 'd458d2f7-b3f3-43a3-8c32-762aceb09c5f' }
            @{ Name = 'Redis'; Id = '01fda3ab-decf-43bb-883d-ff7d3d21aa06' }
            @{ Name = 'telemetry'; Id = 'e5f8c358-cc45-49d5-89e5-a9f84c748824' }
            @{ Name = 'TimescaleDB'; Id = '29863792-e89b-4467-aded-a3d52198ca7b' }
        )
    }
)

$failed = @()
foreach ($proj in $projects) {
    Write-Host "=== $($proj.Name) ===" -ForegroundColor Cyan
    foreach ($svc in $proj.Services) {
        $body = @{
            query     = $mutation
            variables = @{
                serviceId     = $svc.Id
                environmentId = $proj.EnvironmentId
                input         = @{ multiRegionConfig = $zeroCfg }
            }
        } | ConvertTo-Json -Depth 6
        try {
            $resp = Invoke-RestMethod -Uri 'https://backboard.railway.com/graphql/v2' -Method Post -Headers $headers -Body $body -TimeoutSec 90
            if ($resp.errors) {
                Write-Host "  FAIL $($svc.Name): $($resp.errors[0].message)" -ForegroundColor Red
                $failed += "$($proj.Name)/$($svc.Name)"
            } elseif ($resp.data.serviceInstanceUpdate) {
                Write-Host "  OK $($svc.Name)" -ForegroundColor Green
            } else {
                Write-Host "  ? $($svc.Name)" -ForegroundColor Yellow
                $failed += "$($proj.Name)/$($svc.Name)"
            }
        } catch {
            Write-Host "  ERR $($svc.Name): $($_.Exception.Message)" -ForegroundColor Red
            $failed += "$($proj.Name)/$($svc.Name)"
        }
        Start-Sleep -Seconds 3
    }
}

if ($failed.Count -gt 0) {
    Write-Host "`nIncomplete ($($failed.Count)). Retry after rate limit clears." -ForegroundColor Yellow
    exit 1
}
Write-Host "`nShutdown complete (0 replicas, services preserved)." -ForegroundColor Green
