# Warm Redis live index via admin live-simulator for map load tests.
# Requires: podman compose stack (backend :8000, celery_worker_simulation).
# Local override uses grid routes (no celery-worker-routing) — see docker-compose.override.yml.
param(
    [string]$BackendUrl = "http://localhost:8000/api",
    [string]$Username = "global_owner",
    [string]$Password = "admin123",
    [double]$ActiveRatio = 0.17,
    [double]$PoolPct = 1.0,
    [int]$TickSeconds = 4,
    [int]$MinRideActive = 500,
    [int]$PollSeconds = 8,
    [int]$TimeoutMinutes = 10,
    [switch]$StopExisting
)

$ErrorActionPreference = "Stop"

function Get-AdminJwt {
    param([string]$Url, [string]$User, [string]$Pass)
    $body = @{ username = $User; password = $Pass } | ConvertTo-Json
    $resp = Invoke-RestMethod -Uri "$Url/auth/token/" -Method POST -ContentType "application/json" -Body $body
    return $resp.access
}

function Ensure-AdminUser {
    Write-Host "[*] Ensuring admin user exists (create_admin in backend container)..."
    podman compose exec -T backend python manage.py create_admin 2>&1 | Out-Null
    podman compose exec -T backend python manage.py shell -c @"
from django.contrib.auth import get_user_model
u = get_user_model().objects.filter(username='$Username').first()
if u:
    u.set_password('$Password')
    u.save()
    print('password synced')
"@ 2>&1 | Out-Null
}

Write-Host "=== Warm simulator for map test ==="
Ensure-AdminUser

$token = Get-AdminJwt -Url $BackendUrl -User $Username -Pass $Password
$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

if ($StopExisting) {
    try {
        Invoke-RestMethod -Uri "$BackendUrl/activities/admin/live-simulate/" -Method DELETE -Headers $headers | Out-Null
        Write-Host "[*] Stopped existing live simulation."
    } catch {
        Write-Host "[*] No running simulation to stop."
    }
}

$simBody = @{
    tick_seconds   = $TickSeconds
    active_ratio   = $ActiveRatio
    cheat_ratio    = 0.0
    pool_pct       = $PoolPct
} | ConvertTo-Json

Write-Host "[*] Bootstrapping athlete pool if needed..."
podman compose exec -T backend python manage.py shell -c "from activities.admin_views import _bootstrap_live_athletes; print(_bootstrap_live_athletes(min_users=6000))" 2>&1

Write-Host "[*] Starting live simulation (active_ratio=$ActiveRatio, pool_pct=$PoolPct)..."
$start = Invoke-RestMethod -Uri "$BackendUrl/activities/admin/live-simulate/" -Method POST -Headers $headers -Body $simBody
Write-Host "[+] total_users=$($start.total_users)"

$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
do {
    Start-Sleep -Seconds $PollSeconds
    $st = Invoke-RestMethod -Uri "$BackendUrl/activities/admin/live-simulate/" -Headers $headers
    Write-Host ("    ride_active={0} ride_warming={1} currently_riding={2} elapsed={3}s" -f `
        $st.ride_active, $st.ride_warming, $st.currently_riding, $st.elapsed_seconds)
    if ($st.ride_active -ge $MinRideActive) { break }
} while ((Get-Date) -lt $deadline)

if ($st.ride_active -lt $MinRideActive) {
    Write-Error "Timed out: ride_active=$($st.ride_active) < $MinRideActive"
}

$probe = Invoke-RestMethod -Uri "$BackendUrl/activities/telemetry/live/?zoom=6&limit=800&detail=summary" -Headers $headers
Write-Host "[+] Warm complete: ride_active=$($st.ride_active) redis_active=$($probe.meta.redis_active)"
Write-Host "[+] JWT (pass to load script): $token"
$token
