# Runs Maestro E2E flows for the mobile app.
# Prerequisites: dev/preview APK on emulator or device, Maestro CLI, adb.
param(
    [string]$Flow = "",
    [string]$MaestroBin = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileDir = Join-Path $repoRoot "mobile"
$flowsDir = Join-Path $mobileDir ".maestro\flows"

function Resolve-Maestro {
    param([string]$Override)
    if ($Override -and (Test-Path $Override)) { return $Override }
    $marker = Join-Path $env:USERPROFILE ".maestro\install-path.txt"
    if (Test-Path $marker) {
        $binDir = (Get-Content $marker -Raw).Trim()
        $local = Join-Path $binDir "maestro.bat"
        if (Test-Path $local) { return $local }
    }
    foreach ($candidate in @(
        (Join-Path $env:USERPROFILE ".maestro\bin\maestro.bat"),
        (Join-Path $env:USERPROFILE ".maestro\maestro\bin\maestro.bat")
    )) {
        if (Test-Path $candidate) { return $candidate }
    }
    $cmd = Get-Command maestro -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

$maestro = Resolve-Maestro -Override $MaestroBin
if (-not $maestro) {
    Write-Error @"
Maestro CLI not found. Install it first:
  pwsh -File scripts/install-maestro.ps1
Then restart the terminal or run with -MaestroBin `$env:USERPROFILE\.maestro\bin\maestro.bat
"@
}

function Resolve-Adb {
    $cmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        $env:ANDROID_HOME,
        $env:ANDROID_SDK_ROOT,
        (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
        (Join-Path $env:USERPROFILE "AppData\Local\Android\Sdk")
    ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
    foreach ($sdk in $candidates) {
        $adbExe = Join-Path $sdk "platform-tools\adb.exe"
        if (Test-Path $adbExe) { return $adbExe }
    }
    return $null
}

$adb = Resolve-Adb
if (-not $adb) {
    Write-Warning "adb not found. Install Android SDK platform-tools (Android Studio)."
} else {
    $env:ANDROID_HOME = Split-Path (Split-Path $adb -Parent) -Parent
    Write-Host "Using adb: $adb"
    Write-Host "Connected devices:"
    & $adb devices
    $online = (& $adb devices | Select-String "\tdevice$")
    if (-not $online) {
        Write-Warning "No online Android device/emulator. Start one from Android Studio (AVD Manager) or: emulator -avd <name>"
    }
}

Push-Location $mobileDir
try {
    if ($Flow) {
        $flowPath = Join-Path $flowsDir $Flow
        if (-not (Test-Path $flowPath)) {
            Write-Error "Flow not found: $flowPath"
        }
        Write-Host "Running Maestro flow: $Flow"
        & $maestro test $flowPath
    } else {
        Write-Host "Running all Maestro flows in $flowsDir"
        & $maestro test $flowsDir
    }
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}
