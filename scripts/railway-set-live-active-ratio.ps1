# Lower or inspect prod/staging live sim active_ratio via admin API.
# Requires global_owner credentials (default admin123 matches create_admin seed).
param(
    [string]$BackendUrl = "https://backend-production-55c7.up.railway.app/api",
    [string]$Username = "global_owner",
    [string]$Password = "admin123",
    [double]$ActiveRatio = 0.18,
    [switch]$ShowOnly,
    [switch]$Restart
)

$ErrorActionPreference = "Stop"

function Get-AdminJwt {
    param([string]$Url, [string]$User, [string]$Pass)
    $body = @{ username = $User; password = $Pass } | ConvertTo-Json
    $resp = Invoke-RestMethod -Uri "$Url/auth/token/" -Method POST -ContentType "application/json" -Body $body
    return $resp.access
}

$token = Get-AdminJwt -Url $BackendUrl -User $Username -Pass $Password
$headers = @{
    Authorization = "Bearer $token"
    "Content-Type"  = "application/json"
}

$st = Invoke-RestMethod -Uri "$BackendUrl/activities/admin/live-simulate/" -Headers $headers
Write-Host ("Current: running={0} active_ratio={1} ride_warming={2} routing_queue_depth={3}" -f `
    $st.running, $st.active_ratio, $st.ride_warming, $st.routing_queue_depth)

if ($ShowOnly) { return }

if ($st.running -and -not $Restart) {
    Write-Error @"
Sim is running. In-place active_ratio update requires Backend deploy with:
  python manage.py set_live_active_ratio $ActiveRatio
via 'railway ssh -s Backend' (or use -Restart to stop/restart via API).
"@
}

if ($st.running) {
    Invoke-RestMethod -Uri "$BackendUrl/activities/admin/live-simulate/" -Method DELETE -Headers $headers | Out-Null
    Write-Host "[*] Stopped live simulation."
    Start-Sleep -Seconds 2
}

$simBody = @{
    tick_seconds   = [Math]::Max(8, [int]$st.tick_seconds)
    active_ratio   = $ActiveRatio
    cheat_ratio    = [double]$st.cheat_ratio
    pool_pct       = 1.0
    scale_overrides = $st.scale_overrides
} | ConvertTo-Json -Depth 4

$start = Invoke-RestMethod -Uri "$BackendUrl/activities/admin/live-simulate/" -Method POST -Headers $headers -Body $simBody
Write-Host ("[+] Restarted: active_ratio={0} total_users={1}" -f $start.active_ratio, $start.total_users)
