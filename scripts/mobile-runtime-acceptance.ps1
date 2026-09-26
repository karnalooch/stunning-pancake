#Requires -Version 5.1
<#
.SYNOPSIS
  Build, install and exercise an exact-SHA 4VELO Android artifact and write a
  self-contained local evidence bundle.

.DESCRIPTION
  This is the canonical technical half of the mobile visual/runtime sign-off.
  It fails closed when:
    - the Git worktree is dirty;
    - Android/JDK/device selection is ambiguous;
    - native provenance validation fails;
    - the exact APK cannot be installed;
    - the deterministic Home -> Ride -> Summary audit fails;
    - any mandatory Ride screenshot is missing or implausibly small.

  A successful run is AUTOMATION_PASS, not final product acceptance. Major
  visual slices still require manual review of the captured screenshots.
#>

param(
  [string]$DeviceId = "",
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory=$true)][string]$Exe,
    [string[]]$Args = @(),
    [string]$WorkingDirectory = $repoRoot
  )

  Write-Host "  + $Exe $($Args -join ' ')" -ForegroundColor DarkGray
  Push-Location $WorkingDirectory
  try {
    & $Exe @Args
    if ($LASTEXITCODE -ne 0) {
      throw "Exit code ${LASTEXITCODE}: $Exe $($Args -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function Resolve-Device {
  param(
    [Parameter(Mandatory=$true)][string]$Adb,
    [string]$Requested
  )

  $rows = @(& $Adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\S" })
  $online = @()
  foreach ($row in $rows) {
    if ($row -match "^(\S+)\s+device(?:\s|$)") {
      $online += $Matches[1]
    }
  }

  if ($Requested) {
    if ($online -notcontains $Requested) {
      throw "Requested adb device '$Requested' is not online. Online: $($online -join ', ')"
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

function Get-Sha256Text {
  param([Parameter(Mandatory=$true)][string]$Value)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

$repoRoot = (& git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) {
  throw "Run this command from inside the 4VELO repository."
}

$gitSha = (& git -C $repoRoot rev-parse HEAD).Trim()
$gitShort = (& git -C $repoRoot rev-parse --short=12 HEAD).Trim()
$gitBranch = ((& git -C $repoRoot branch --show-current) | Out-String).Trim()
if (-not $gitBranch) { $gitBranch = "DETACHED" }
$gitStatus = @(& git -C $repoRoot status --porcelain --untracked-files=all)
if ($gitStatus.Count -gt 0) {
  throw @"
Worktree must be clean for exact-SHA runtime acceptance.
Current changes:
$($gitStatus -join [Environment]::NewLine)
"@
}

if (-not $OutputRoot) {
  $OutputRoot = Join-Path $repoRoot "artifacts\mobile-runtime-acceptance"
}
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path $OutputRoot "$gitShort-$timestamp"
$shotsDir = Join-Path $runDir "screenshots"
$reportPath = Join-Path $runDir "emulator-audit.md"
$provenancePath = Join-Path $runDir "provenance.json"
$summaryPath = Join-Path $runDir "acceptance-summary.md"
$expoConfigPath = Join-Path $runDir "expo-public.json"

New-Item -ItemType Directory -Force -Path $shotsDir | Out-Null

$androidEnv = Join-Path $repoRoot "scripts\android-env.ps1"
if (-not (Test-Path $androidEnv -PathType Leaf)) {
  throw "Missing Android environment resolver: $androidEnv"
}
. $androidEnv

$adbPath = Join-Path $env:ANDROID_SDK_ROOT "platform-tools\adb.exe"
if (-not (Test-Path $adbPath -PathType Leaf)) {
  throw "adb not found at $adbPath"
}
$selectedDevice = Resolve-Device -Adb $adbPath -Requested $DeviceId
$deviceHash = (Get-Sha256Text -Value $selectedDevice).Substring(0, 16)

$nodeVersion = (& node --version).Trim()
$pnpmVersion = (& pnpm --version).Trim()
$javaVersion = ((& (Join-Path $env:JAVA_HOME "bin\java.exe") -version 2>&1) | Out-String).Trim()
$adbVersion = ((& $adbPath version) | Out-String).Trim()
$deviceApi = (& $adbPath -s $selectedDevice shell getprop ro.build.version.sdk).Trim()
$deviceAbi = (& $adbPath -s $selectedDevice shell getprop ro.product.cpu.abi).Trim()
$deviceModel = (& $adbPath -s $selectedDevice shell getprop ro.product.model).Trim()

$mobileDir = Join-Path $repoRoot "mobile"
$androidDir = Join-Path $mobileDir "android"
$apkPath = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"

$env:EAS_BUILD_PROFILE = "pilot-local"
$env:EXPO_PUBLIC_VISION_FIXTURES = "true"
$env:EXPO_PUBLIC_E2E_SKIP_ONBOARDING = "false"
$env:EXPO_PUBLIC_API_URL = "http://localhost:8000"
$env:EXPO_PUBLIC_TELEMETRY_URL = "http://localhost:8001"
$env:EXPO_PUBLIC_TELEMETRY_WS_INGEST = "false"
$env:EXPO_PUBLIC_ENABLE_FIREBASE = "false"

$automationResult = "FAIL"
$failureMessage = $null
$apkHash = $null
$packageVersionName = $null
$packageVersionCode = $null

try {
  Write-Host ""
  Write-Host "=== Exact-SHA mobile runtime acceptance ===" -ForegroundColor Cyan
  Write-Host "  Git SHA:     $gitSha"
  Write-Host "  Branch:      $gitBranch"
  Write-Host "  Device hash: $deviceHash"
  Write-Host "  Evidence:    $runDir"

  Write-Host ""
  Write-Host "=== Install exact workspace dependencies ===" -ForegroundColor Cyan
  Invoke-Checked "pnpm" @("install", "--frozen-lockfile") $repoRoot

  Write-Host ""
  Write-Host "=== Resolve Expo/native provenance ===" -ForegroundColor Cyan
  Push-Location $mobileDir
  try {
    pnpm exec expo config --type public --json | Set-Content -Path $expoConfigPath -Encoding UTF8
    if ($LASTEXITCODE -ne 0) { throw "expo config failed" }
  } finally {
    Pop-Location
  }

  Write-Host ""
  Write-Host "=== Clean native generation ===" -ForegroundColor Cyan
  Invoke-Checked "pnpm" @("exec", "expo", "prebuild", "--clean", "--platform", "android", "--no-install") $mobileDir

  $localProperties = Join-Path $androidDir "local.properties"
  $escapedSdk = $env:ANDROID_SDK_ROOT -replace "\\", "\\"
  "sdk.dir=$escapedSdk" | Set-Content -Path $localProperties -Encoding ASCII

  Invoke-Checked "python" @(
    "scripts/validate_mobile_native_provenance.py",
    "--expo-config", $expoConfigPath,
    "--version-file", "version.json",
    "--android-dir", "mobile/android",
    "--git-sha", $gitSha
  ) $repoRoot

  Write-Host ""
  Write-Host "=== Build exact release APK ===" -ForegroundColor Cyan
  Invoke-Checked "cmd" @("/c", "gradlew.bat", "assembleRelease", "--no-daemon", "--stacktrace") $androidDir
  if (-not (Test-Path $apkPath -PathType Leaf)) {
    throw "Gradle completed but APK is missing: $apkPath"
  }
  $apkHash = (Get-FileHash -Algorithm SHA256 $apkPath).Hash.ToLowerInvariant()

  Write-Host ""
  Write-Host "=== Install exact APK ===" -ForegroundColor Cyan
  Invoke-Checked $adbPath @("-s", $selectedDevice, "install", "-r", $apkPath) $repoRoot

  $packageDump = @(& $adbPath -s $selectedDevice shell dumpsys package com.sport.athlete)
  $packageVersionName = (($packageDump | Select-String "versionName=" | Select-Object -First 1).Line).Trim()
  $packageVersionCode = (($packageDump | Select-String "versionCode=" | Select-Object -First 1).Line).Trim()
  if (-not $packageVersionName -or -not $packageVersionCode) {
    throw "Installed package identity could not be read from com.sport.athlete."
  }

  Write-Host ""
  Write-Host "=== Deterministic emulator interaction + screenshots ===" -ForegroundColor Cyan
  Invoke-Checked "python" @(
    "scripts/emulator-ui-audit.py",
    "--serial", $selectedDevice,
    "--app-id", "com.sport.athlete",
    "--output-dir", $shotsDir,
    "--report", $reportPath
  ) $repoRoot

  $requiredScreens = @(
    "01_ride_dashboard.png",
    "02_active_ride_hud.png",
    "03_ride_paused.png",
    "03b_ride_resumed.png",
    "03d_ride_summary.png",
    "03e_home_after_summary.png"
  )

  foreach ($name in $requiredScreens) {
    $shot = Join-Path $shotsDir $name
    if (-not (Test-Path $shot -PathType Leaf)) {
      throw "Mandatory acceptance screenshot missing: $name"
    }
    if ((Get-Item $shot).Length -lt 50000) {
      throw "Mandatory acceptance screenshot is implausibly small: $name"
    }
  }

  $automationResult = "AUTOMATION_PASS"
} catch {
  $failureMessage = $_.Exception.Message
  throw
} finally {
  $screenFiles = @()
  if (Test-Path $shotsDir -PathType Container) {
    $screenFiles = @(Get-ChildItem $shotsDir -Filter "*.png" -File | Sort-Object Name | ForEach-Object { $_.Name })
  }

  $provenance = [ordered]@{
    result = $automationResult
    failure = $failureMessage
    createdAt = (Get-Date).ToUniversalTime().ToString("o")
    git = [ordered]@{
      sha = $gitSha
      shortSha = $gitShort
      branch = $gitBranch
      clean = $true
    }
    toolchain = [ordered]@{
      node = $nodeVersion
      pnpm = $pnpmVersion
      java = $javaVersion
      androidSdkRoot = $env:ANDROID_SDK_ROOT
      adb = $adbVersion
    }
    device = [ordered]@{
      serialHash = $deviceHash
      model = $deviceModel
      api = $deviceApi
      abi = $deviceAbi
    }
    artifact = [ordered]@{
      path = $apkPath
      sha256 = $apkHash
      packageId = "com.sport.athlete"
      versionName = $packageVersionName
      versionCode = $packageVersionCode
    }
    runtime = [ordered]@{
      profile = $env:EAS_BUILD_PROFILE
      visionFixtures = $env:EXPO_PUBLIC_VISION_FIXTURES
      screenshots = $screenFiles
      auditReport = (Split-Path $reportPath -Leaf)
    }
  }

  $provenance | ConvertTo-Json -Depth 8 | Set-Content -Path $provenancePath -Encoding UTF8

  $summary = @(
    "# 4VELO exact-SHA mobile runtime acceptance",
    "",
    "- Automation result: **$automationResult**",
    "- Git SHA: $gitSha",
    "- Branch: $gitBranch",
    "- APK SHA-256: $apkHash",
    "- Device: $deviceModel / API $deviceApi / $deviceAbi / serial hash $deviceHash",
    "- Audit: emulator-audit.md",
    "- Provenance: provenance.json",
    "",
    "## Mandatory visual review",
    "",
    "- [ ] Home hero / Start Ride hierarchy",
    "- [ ] Active Ride sunlight/readability and marker/control clarity",
    "- [ ] Pause modal hierarchy and touch targets",
    "- [ ] Summary durable-success truth and production art quality",
    "- [ ] Return Home state",
    "",
    "> AUTOMATION_PASS proves exact-SHA technical/runtime evidence only. Major visual slices still require manual visual sign-off."
  )
  $summary -join [Environment]::NewLine | Set-Content -Path $summaryPath -Encoding UTF8

  Write-Host ""
  Write-Host "Evidence bundle: $runDir" -ForegroundColor Cyan
  Write-Host "Automation result: $automationResult" -ForegroundColor $(if ($automationResult -eq "AUTOMATION_PASS") { "Green" } else { "Red" })
}

if ($automationResult -ne "AUTOMATION_PASS") {
  exit 2
}

Write-Host ""
Write-Host "AUTOMATION_PASS — review screenshots and record manual visual sign-off." -ForegroundColor Green
