#Requires -Version 5.1
<#
.SYNOPSIS
  4VELO local visual verification harness.

.DESCRIPTION
  Fail-closed pipeline for local Android visual verification:
    1. Resolve Android SDK/JDK without machine-specific paths.
    2. Select exactly one authorized device (or require -DeviceId).
    3. Build a fresh local pilot-style APK, unless -SkipBuild is supplied.
    4. Install that exact APK.
    5. Run emulator-ui-audit.py against the selected device.
    6. Run the directional vision parity report.

  The EAS cloud mode intentionally does NOT capture screenshots after a cloud
  build because the artifact is not installed by this script. This prevents
  accidental screenshots from a stale APK.

.PARAMETER DeviceId
  Optional adb serial. If omitted, exactly one authorized device must exist.

.PARAMETER SkipBuild
  Do not rebuild/reinstall. Intended only when artifact provenance is already
  recorded separately.

.PARAMETER SkipCapture
  Skip device screenshots and only run the parity report on existing captures.

.PARAMETER BuildMode
  local = clean Expo prebuild + Gradle release APK.
  eas   = EAS cloud preview build only; no stale-device capture is allowed.

.PARAMETER Threshold
  Directional SSIM threshold. Human checklist remains authoritative.
#>

param(
  [string]$DeviceId = "",
  [switch]$SkipBuild,
  [switch]$SkipCapture,
  [ValidateSet("local", "eas")]
  [string]$BuildMode = "local",
  [float]$Threshold = 0.6
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileDir = Join-Path $repoRoot "mobile"
$dateTag = Get-Date -Format "yyyy-MM-dd"
$outputDir = Join-Path $repoRoot "docs\design\screenshots\$dateTag-parity-progress"
$captureDir = Join-Path $repoRoot "docs\design\screenshots\$dateTag-emulator-audit"
$visionDir = Join-Path $repoRoot "docs\design\screenshots\2026-06-14-emulator-audit\vision"
$apkPath = Join-Path $mobileDir "android\app\build\outputs\apk\release\app-release.apk"

function Write-Step { param([string]$Text) Write-Host "`n=== $Text ===" -ForegroundColor Cyan }
function Write-OK { param([string]$Text) Write-Host "  OK   $Text" -ForegroundColor Green }
function Write-WARN { param([string]$Text) Write-Host "  WARN $Text" -ForegroundColor Yellow }

function Invoke-Cmd {
  param(
    [Parameter(Mandatory=$true)][string]$Exe,
    [string[]]$Args = @(),
    [string]$WorkDir = $repoRoot
  )
  Write-Host "  + $Exe $($Args -join ' ')" -ForegroundColor DarkGray
  Push-Location $WorkDir
  try {
    & $Exe @Args
    if ($LASTEXITCODE -ne 0) {
      throw "Exit code $LASTEXITCODE: $Exe $($Args -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function Resolve-Device {
  param([string]$Requested)

  $rows = @(& $adbPath devices | Select-Object -Skip 1 | Where-Object { $_ -match "\S" })
  $online = @()
  foreach ($row in $rows) {
    if ($row -match "^(\S+)\s+device(?:\s|$)") {
      $online += $Matches[1]
    }
  }

  if ($Requested) {
    if ($online -notcontains $Requested) {
      throw "Requested adb device '$Requested' is not online. Online devices: $($online -join ', ')"
    }
    return $Requested
  }

  if ($online.Count -eq 0) {
    throw "No authorized Android device/emulator is online."
  }
  if ($online.Count -gt 1) {
    throw "Multiple Android devices are online ($($online -join ', ')). Re-run with -DeviceId <serial>."
  }
  return $online[0]
}

Write-Step "0. Resolve host Android environment"
$androidEnv = Join-Path $PSScriptRoot "android-env.ps1"
if (-not (Test-Path $androidEnv -PathType Leaf)) {
  throw "Missing environment resolver: $androidEnv"
}
. $androidEnv

$sdkRoot = $env:ANDROID_SDK_ROOT
if (-not $sdkRoot) { throw "ANDROID_SDK_ROOT was not resolved." }
$adbPath = Join-Path $sdkRoot "platform-tools\adb.exe"
if (-not (Test-Path $adbPath -PathType Leaf)) {
  throw "adb not found at $adbPath"
}

if (-not (Test-Path $mobileDir -PathType Container)) {
  throw "mobile/ not found at $mobileDir"
}

$gitSha = (& git -C $repoRoot rev-parse HEAD).Trim()
$gitStatus = (& git -C $repoRoot status --porcelain)
Write-OK "Git SHA: $gitSha"
if ($gitStatus) {
  Write-WARN "Worktree is dirty. Captures are not exact-commit provenance."
} else {
  Write-OK "Worktree clean"
}

$selectedDevice = $null
if (-not $SkipCapture -or (-not $SkipBuild -and $BuildMode -eq "local")) {
  $selectedDevice = Resolve-Device -Requested $DeviceId
  Write-OK "ADB device: $selectedDevice"
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
New-Item -ItemType Directory -Force -Path $captureDir | Out-Null

Write-Step "1. Configure local visual runtime"
# Local visual verification is deliberately isolated from production.
$env:EAS_BUILD_PROFILE = "pilot-local"
$env:EXPO_PUBLIC_VISION_FIXTURES = "true"
$env:EXPO_PUBLIC_API_URL = "http://localhost:8000"
$env:EXPO_PUBLIC_TELEMETRY_URL = "http://localhost:8001"
$env:EXPO_PUBLIC_TELEMETRY_WS_INGEST = "false"
$env:EXPO_PUBLIC_ENABLE_FIREBASE = "false"

Write-Host "  EAS_BUILD_PROFILE=$env:EAS_BUILD_PROFILE"
Write-Host "  EXPO_PUBLIC_API_URL=$env:EXPO_PUBLIC_API_URL"
Write-Host "  EXPO_PUBLIC_TELEMETRY_URL=$env:EXPO_PUBLIC_TELEMETRY_URL"
Write-Host "  EXPO_PUBLIC_VISION_FIXTURES=$env:EXPO_PUBLIC_VISION_FIXTURES"

if (-not $SkipBuild) {
  Write-Step "2. Build fresh Android artifact ($BuildMode)"

  if ($BuildMode -eq "local") {
    Invoke-Cmd "npx" @("expo", "prebuild", "--clean", "-p", "android") $mobileDir

    # expo prebuild --clean recreates android/, so local.properties must be
    # written AFTER prebuild, never before it.
    $androidDir = Join-Path $mobileDir "android"
    if (-not (Test-Path $androidDir -PathType Container)) {
      throw "Expo prebuild did not create $androidDir"
    }

    $localProperties = Join-Path $androidDir "local.properties"
    $escapedSdk = $sdkRoot -replace "\\", "\\"
    "sdk.dir=$escapedSdk" | Set-Content -Path $localProperties -Encoding ASCII

    Invoke-Cmd "cmd" @("/c", "gradlew.bat", "assembleRelease") $androidDir

    if (-not (Test-Path $apkPath -PathType Leaf)) {
      throw "Gradle completed but APK is missing: $apkPath"
    }
    $apkHash = (Get-FileHash -Algorithm SHA256 $apkPath).Hash.ToLowerInvariant()
    Write-OK "APK: $apkPath"
    Write-OK "APK SHA-256: $apkHash"

    Write-Step "3. Install exact APK"
    & $adbPath -s $selectedDevice install -r $apkPath
    if ($LASTEXITCODE -ne 0) { throw "APK install failed on $selectedDevice" }

    $packageDump = & $adbPath -s $selectedDevice shell dumpsys package com.sport.athlete
    $versionName = ($packageDump | Select-String "versionName=" | Select-Object -First 1).Line.Trim()
    $versionCode = ($packageDump | Select-String "versionCode=" | Select-Object -First 1).Line.Trim()
    Write-OK "Installed com.sport.athlete: $versionName; $versionCode"
  } else {
    Invoke-Cmd "npx" @(
      "eas", "build",
      "--platform", "android",
      "--profile", "preview",
      "--non-interactive"
    ) $mobileDir

    if (-not $SkipCapture) {
      throw @"
EAS cloud build completed/queued, but this harness did not install that artifact.
Refusing screenshot capture from an unproven/stale device build.
Install and record the EAS artifact first, then re-run with -SkipBuild.
"@
    }
  }
} else {
  Write-Step "2. Build SKIPPED"
  Write-WARN "Artifact provenance must be recorded separately when -SkipBuild is used."
}

if (-not $SkipCapture) {
  Write-Step "4. Capture emulator walkthrough"
  $auditScript = Join-Path $repoRoot "scripts\emulator-ui-audit.py"
  if (-not (Test-Path $auditScript -PathType Leaf)) {
    throw "Audit script not found: $auditScript"
  }

  Invoke-Cmd "python" @(
    $auditScript,
    "--serial", $selectedDevice,
    "--app-id", "com.sport.athlete"
  ) $repoRoot
  Write-OK "Screenshots captured from $selectedDevice"
} else {
  Write-Step "4. Capture SKIPPED"
}

Write-Step "5. Directional vision parity report"
$parityScript = Join-Path $repoRoot "scripts\vision_parity_harness.py"
if (-not (Test-Path $parityScript -PathType Leaf)) {
  throw "Parity script not found: $parityScript"
}
if (-not (Test-Path $visionDir -PathType Container)) {
  throw "Vision reference directory missing: $visionDir"
}
if (-not (Test-Path $captureDir -PathType Container)) {
  throw "Capture directory missing: $captureDir"
}

Invoke-Cmd "python" @(
  $parityScript,
  "--actual", $captureDir,
  "--vision", $visionDir,
  "--out", $outputDir,
  "--threshold", [string]$Threshold,
  "--composite",
  "--report-only"
) $repoRoot

Write-Step "6. Summary"
Write-Host "  Git SHA:             $gitSha"
Write-Host "  Device:              $selectedDevice"
Write-Host "  Android SDK:         $sdkRoot"
Write-Host "  JAVA_HOME:           $env:JAVA_HOME"
Write-Host "  Captures:            $captureDir"
Write-Host "  Parity report:       $outputDir\report.md"
Write-Host "  Human checklist:     $outputDir\checklist.md"
Write-Host ""
Write-WARN "SSIM is directional only. Runtime/visual PASS requires the human checklist and exact-artifact provenance."
