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
  [string]$OutputRoot = "",
  [switch]$UseCiArtifact,
  [string]$CiRunId = ""
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

$nodeVersion = $null
$pnpmVersion = $null
$javaVersion = $null
if (-not $UseCiArtifact) {
  $nodeVersion = (& node --version).Trim()
  $pnpmVersion = (& pnpm --version).Trim()
  $javaVersion = ((& (Join-Path $env:JAVA_HOME "bin\java.exe") -version 2>&1) | Out-String).Trim()
}
$adbVersion = ((& $adbPath version) | Out-String).Trim()
$deviceApi = (& $adbPath -s $selectedDevice shell getprop ro.build.version.sdk).Trim()
$deviceAbi = (& $adbPath -s $selectedDevice shell getprop ro.product.cpu.abi).Trim()
$deviceModel = (& $adbPath -s $selectedDevice shell getprop ro.product.model).Trim()

$mobileDir = Join-Path $repoRoot "mobile"
$androidDir = Join-Path $mobileDir "android"
$apkPath = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
$repoDriveRoot = [System.IO.Path]::GetPathRoot($repoRoot)
$shortVirtualStore = Join-Path $repoDriveRoot ("4v\" + $gitShort)

$env:NODE_ENV = "production"
$env:MOBILE_RUNTIME_ACCEPTANCE = "true"
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
$artifactSource = if ($UseCiArtifact) { "ci" } else { "local-build" }
$ciWorkflowRunId = $null
$ciBuiltGitSha = $null
$packageVersionName = $null
$packageVersionCode = $null

try {
  Write-Host ""
  Write-Host "=== Exact-SHA mobile runtime acceptance ===" -ForegroundColor Cyan
  Write-Host "  Git SHA:     $gitSha"
  Write-Host "  Branch:      $gitBranch"
  Write-Host "  Device hash: $deviceHash"
  Write-Host "  Evidence:    $runDir"

  if ($UseCiArtifact) {
    Write-Host ""
    Write-Host "=== Download verified CI release APK ===" -ForegroundColor Cyan

    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
      throw "GitHub CLI (gh) is required for -UseCiArtifact."
    }
    if ($gitBranch -eq "DETACHED" -and -not $CiRunId) {
      throw "Detached HEAD requires an explicit -CiRunId when using a CI artifact."
    }

    if (-not $CiRunId) {
      $runsJson = ((& gh run list --workflow "Mobile Native Smoke" --branch $gitBranch --event pull_request --status success --commit $gitSha --limit 20 --json databaseId,headSha,headBranch,conclusion 2>&1) | Out-String).Trim()
      if ($LASTEXITCODE -ne 0) {
        throw "Could not query successful Mobile Native Smoke runs for ${gitSha}: $runsJson"
      }

      $runs = @()
      if ($runsJson) {
        $runs = @($runsJson | ConvertFrom-Json)
      }
      $matchingRun = @($runs | Where-Object {
        $_.headSha -eq $gitSha -and $_.conclusion -eq "success"
      } | Select-Object -First 1)

      if ($matchingRun.Count -eq 0) {
        throw "No successful Mobile Native Smoke run found for exact local SHA $gitSha."
      }
      $CiRunId = [string]$matchingRun[0].databaseId
    }

    $ciWorkflowRunId = [string]$CiRunId
    $ciArtifactDir = Join-Path $runDir "ci-artifact"
    New-Item -ItemType Directory -Force -Path $ciArtifactDir | Out-Null
    $artifactName = "mobile-runtime-$CiRunId"
    Invoke-Checked "gh" @("run", "download", $CiRunId, "--name", $artifactName, "--dir", $ciArtifactDir) $repoRoot

    $manifestPath = Join-Path $ciArtifactDir "manifest.json"
    $apkPath = Join-Path $ciArtifactDir "app-release.apk"
    if (-not (Test-Path $manifestPath -PathType Leaf)) {
      throw "CI artifact manifest missing: $manifestPath"
    }
    if (-not (Test-Path $apkPath -PathType Leaf)) {
      throw "CI release APK missing: $apkPath"
    }

    $manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
    if ([string]$manifest.sourceHeadSha -ne $gitSha) {
      throw "CI artifact source SHA mismatch. Expected $gitSha, got $($manifest.sourceHeadSha)."
    }
    $ciBuiltGitSha = [string]$manifest.builtGitSha
    if (-not $ciBuiltGitSha -or $ciBuiltGitSha -ne $gitSha) {
      throw "CI artifact built SHA mismatch. Expected $gitSha, got $ciBuiltGitSha."
    }
    if ($null -eq $manifest.updatesEnabled -or [bool]$manifest.updatesEnabled) {
      throw "CI artifact is not runtime-isolated: Expo OTA updates must be disabled."
    }
    if ([string]$manifest.visionFixtures -ne "true") {
      throw "CI artifact is not deterministic: vision fixtures are not enabled."
    }
    if ([string]$manifest.runtimeAcceptance -ne "true") {
      throw "CI artifact was not built in runtime-acceptance mode."
    }
    if ([string]$manifest.nodeEnv -ne "production") {
      throw "CI artifact was not bundled with NODE_ENV=production."
    }
    if ([string]$manifest.workflowRunId -ne [string]$CiRunId) {
      throw "CI artifact run-id mismatch. Expected $CiRunId, got $($manifest.workflowRunId)."
    }

    $apkHash = (Get-FileHash -Algorithm SHA256 $apkPath).Hash.ToLowerInvariant()
    $expectedApkHash = ([string]$manifest.apkSha256).ToLowerInvariant()
    if ($apkHash -ne $expectedApkHash) {
      throw "CI artifact APK SHA-256 mismatch. Expected $expectedApkHash, got $apkHash."
    }
    Write-Host "  CI run:      $CiRunId"
    Write-Host "  Built SHA:   $ciBuiltGitSha"
    Write-Host "  APK SHA-256: $apkHash"
  } else {
    Write-Host ""
    Write-Host "=== Install exact workspace dependencies ===" -ForegroundColor Cyan
    if (Test-Path $shortVirtualStore) {
      Remove-Item -Recurse -Force $shortVirtualStore
    }
  
    $workspaceConfig = Join-Path $repoRoot "pnpm-workspace.yaml"
    $originalWorkspaceBytes = [System.IO.File]::ReadAllBytes($workspaceConfig)
    $originalWorkspaceConfig = [System.Text.Encoding]::UTF8.GetString($originalWorkspaceBytes)
    if ($originalWorkspaceConfig -match "(?m)^virtualStoreDir:") {
      throw "Tracked workspace config unexpectedly defines virtualStoreDir."
    }
  
    $shortVirtualStoreYaml = $shortVirtualStore -replace "\\", "/"
    try {
      $replacement = "virtualStoreDir: `"$shortVirtualStoreYaml`"`nvirtualStoreDirMaxLength: 16"
      $shortStoreConfig = $originalWorkspaceConfig -replace "(?m)^virtualStoreDirMaxLength:\s*40\s*$", $replacement
      if ($shortStoreConfig -eq $originalWorkspaceConfig) {
        throw "Could not inject short Windows virtual-store configuration."
      }
      $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
      [System.IO.File]::WriteAllText($workspaceConfig, $shortStoreConfig, $utf8NoBom)
  
      Invoke-Checked "pnpm" @("install", "--frozen-lockfile") $repoRoot
      if (-not (Test-Path $shortVirtualStore -PathType Container)) {
        throw "pnpm short virtual store was not materialized: $shortVirtualStore"
      }
    } finally {
      [System.IO.File]::WriteAllBytes($workspaceConfig, $originalWorkspaceBytes)
    }
  
    $env:EXPO_METRO_PNPM_VIRTUAL_STORE = $shortVirtualStore
  
    Write-Host ""
    Write-Host "=== Resolve Expo/native provenance ===" -ForegroundColor Cyan
    Push-Location $mobileDir
    try {
      pnpm exec expo config --type public --json | Set-Content -Path $expoConfigPath -Encoding UTF8
      if ($LASTEXITCODE -ne 0) { throw "expo config failed" }
      $expoConfig = Get-Content -Raw $expoConfigPath | ConvertFrom-Json
      if ($null -eq $expoConfig.updates.enabled -or [bool]$expoConfig.updates.enabled) {
        throw "Runtime acceptance local build must disable Expo OTA updates."
      }
      if ([string]$expoConfig.extra.EXPO_PUBLIC_VISION_FIXTURES -ne "true") {
        throw "Runtime acceptance local build must enable vision fixtures."
      }
    } finally {
      Pop-Location
    }
  
    Write-Host ""
    Write-Host "=== Clean native generation ===" -ForegroundColor Cyan
    Invoke-Checked "pnpm" @("exec", "expo", "prebuild", "--clean", "--platform", "android", "--no-install") $mobileDir
  
    $gradleProperties = Join-Path $androidDir "gradle.properties"
    $gradleText = [System.IO.File]::ReadAllText($gradleProperties)
    $heapBaseline = "-Xmx2048m"
    $metaspaceBaseline = "-XX:MaxMetaspaceSize=512m"
    if (-not $gradleText.Contains($heapBaseline)) {
      throw "Generated gradle.properties no longer contains the expected 2048m heap baseline."
    }
    if (-not $gradleText.Contains($metaspaceBaseline)) {
      throw "Generated gradle.properties no longer contains the expected 512m metaspace baseline."
    }
    $gradleText = $gradleText.Replace($heapBaseline, "-Xmx4096m")
    $gradleText = $gradleText.Replace($metaspaceBaseline, "-XX:MaxMetaspaceSize=1g")
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($gradleProperties, $gradleText, $utf8NoBom)
  
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
    Invoke-Checked "cmd" @("/c", "gradlew.bat", "assembleRelease", "--no-daemon", "--stacktrace", "--max-workers=2") $androidDir
    if (-not (Test-Path $apkPath -PathType Leaf)) {
      throw "Gradle completed but APK is missing: $apkPath"
    }
    $apkHash = (Get-FileHash -Algorithm SHA256 $apkPath).Hash.ToLowerInvariant()
  }

  Write-Host ""
  Write-Host "=== Install exact APK ===" -ForegroundColor Cyan
  Invoke-Checked $adbPath @("-s", $selectedDevice, "install", "-r", $apkPath) $repoRoot
  Invoke-Checked $adbPath @("-s", $selectedDevice, "shell", "pm", "clear", "com.sport.athlete") $repoRoot

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
      pnpmVirtualStore = $shortVirtualStore
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
      source = $artifactSource
      path = $apkPath
      sha256 = $apkHash
      packageId = "com.sport.athlete"
      versionName = $packageVersionName
      versionCode = $packageVersionCode
      ciWorkflowRunId = $ciWorkflowRunId
      ciBuiltGitSha = $ciBuiltGitSha
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
