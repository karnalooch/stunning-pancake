# Compare required env keys from railway-to-k8s.env.template with local .env (optional).
# Usage: .\scripts\ops\check-railway-k8s-env-parity.ps1 [-EnvFile .env]
param(
    [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$template = Join-Path $root "infrastructure\k8s\config\railway-to-k8s.env.template"

if (-not (Test-Path $template)) {
    Write-Error "Template not found: $template"
}

$keys = @()
Get-Content $template | ForEach-Object {
    $line = $_.Trim()
    if ($line -match '^\s*#' -or $line -eq '') { return }
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=') {
        $keys += $Matches[1]
    }
}
$keys = $keys | Sort-Object -Unique

Write-Host "Template defines $($keys.Count) env keys (Railway/K8s parity checklist)."
Write-Host ""

$envPath = Join-Path $root $EnvFile
if (-not (Test-Path $envPath)) {
    Write-Host "No $EnvFile at repo root — listing keys only (set on Railway Dashboard)."
    $keys | ForEach-Object { Write-Host "  $_" }
    exit 0
}

$present = @{}
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $present[$Matches[1]] = $true
    }
}

$missing = $keys | Where-Object { -not $present.ContainsKey($_) }
if ($missing.Count -eq 0) {
    Write-Host "All template keys present in $EnvFile."
    exit 0
}

Write-Host "Missing in $EnvFile (may still be set on Railway):"
$missing | ForEach-Object { Write-Host "  $_" }
exit 1
