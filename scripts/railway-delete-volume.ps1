#Requires -Version 5.1
param(
    [string]$VolumeId = "6e921cb4-d7eb-4f03-9add-244684892a58",
    [string]$EnvironmentId = "0e5ae720-dd4e-4d09-b6a1-ff4d70bb7b99"
)

$ErrorActionPreference = "Stop"
if (-not $env:RAILWAY_API_TOKEN) { throw "Set RAILWAY_API_TOKEN" }

$headers = @{
    Authorization = "Bearer $($env:RAILWAY_API_TOKEN)"
    "Content-Type"  = "application/json"
}

$mutations = @(
    @{
        name = "volumeDelete"
        query = "mutation(`$id: String!) { volumeDelete(id: `$id) }"
        variables = @{ id = $VolumeId }
    },
    @{
        name = "volumeInstanceDelete"
        query = "mutation(`$volumeId: String!, `$environmentId: String!) { volumeInstanceDelete(volumeId: `$volumeId, environmentId: `$environmentId) }"
        variables = @{ volumeId = $VolumeId; environmentId = $EnvironmentId }
    }
)

foreach ($m in $mutations) {
    Write-Host "Trying $($m.name) ..."
    $body = @{ query = $m.query; variables = $m.variables } | ConvertTo-Json -Depth 5
    try {
        $resp = Invoke-RestMethod -Uri "https://backboard.railway.com/graphql/v2" -Method Post -Headers $headers -Body $body -TimeoutSec 90
        if ($resp.errors) {
            Write-Host "  errors: $($resp.errors | ConvertTo-Json -Compress)"
        } else {
            Write-Host "  OK: $($resp.data | ConvertTo-Json -Compress)"
        }
    } catch {
        Write-Host "  fail: $($_.Exception.Message)"
    }
}
