# P2 code closure — GPX forensics, RODO export, MFA (no prod credentials required).
#
# Example:
#   .\scripts\run-p2-closure.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$failures = @()

function Step($name, [scriptblock]$block) {
    Write-Host ""
    Write-Host "=== $name ===" -ForegroundColor Cyan
    try {
        & $block
        if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
            throw "exit $LASTEXITCODE"
        }
        Write-Host "[PASS] $name" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL] $name - $_" -ForegroundColor Red
        $script:failures += $name
    }
}

Step "Backend P2 pytest" {
    Push-Location (Join-Path $root "backend")
    try {
        python run_pytest.py `
            activities/test_gpx_export.py `
            activities/test_gpx_forensics.py `
            activities/test_gpx_storage.py `
            users/test_export.py `
            users/test_jwt_mfa.py `
            -q
    } finally {
        Pop-Location
    }
}

Write-Host ""
if ($failures.Count -eq 0) {
    Write-Host "P2 closure: ALL PASS" -ForegroundColor Green
    exit 0
}
Write-Host "P2 closure: FAILED — $($failures -join ', ')" -ForegroundColor Red
exit 1
