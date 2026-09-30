#Requires -Version 5.1
<#
.SYNOPSIS
  Run the canonical Maestro Ride visual proof against a verified exact-SHA Android artifact.

.DESCRIPTION
  This proof never compiles an APK. It reuses the immutable release APK produced by
  Mobile Native Smoke, verifies the artifact manifest and APK hash against the current
  clean Git HEAD, installs that exact APK, runs the repository-owned Maestro flow and
  writes screenshot hashes plus provenance into an ignored local evidence bundle.
#>

param(
  [string]$DeviceId = "",
  [string]$CiRunId = "",
  [string]$MaestroBin = "",
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

function Resolve-Maestro {
  param([string]$Override)
  if ($Override -and (Test-Path $Override -PathType Leaf)) { return $Override }

  $marker = Join-Path $env:USERPROFILE ".maestro\install-path.txt"
  if (Test-Path $marker -PathType Leaf) {
    $binDir = (Get-Content $marker -Raw).Trim()
    $local = Join-Path $binDir "maestro.bat"
    if (Test-Path $local -PathType Leaf) { return $local }
  }

  foreach ($candidate in @(
    (Join-Path $env:USERPROFILE ".maestro\bin\maestro.bat"),
    (Join-Path $env:USERPROFILE ".maestro\maestro\bin\maestro.bat")
  )) {
    if (Test-Path $candidate -PathType Leaf) { return $candidate }
  }

  $cmd = Get-Command maestro -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Resolve-Device {
  param(
    [Parameter(Mandatory=$true)][string]$Adb,
    [string]$Requested
  )

  $rows = @(& $Adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "\S" })
  $online = @()
  foreach ($row in $rows) {
    if ($row -match "^(\S+)\s+device(?:\s|$)") { $online += $Matches[1] }
  }

  if ($Requested) {
    if ($online -notcontains $Requested) {
      throw "Requested adb device '$Requested' is not online. Online: $($online -join ', ')"
    }
    return $Requested
  }
  if ($online.Count -eq 0) { throw "No authorized Android device/emulator is online." }
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
if (-not $repoRoot) { throw "Run this command from inside the 4VELO repository." }

$gitSha = (& git -C $repoRoot rev-parse HEAD).Trim()
$gitShort = (& git -C $repoRoot rev-parse --short=12 HEAD).Trim()
$gitBranch = ((& git -C $repoRoot branch --show-current) | Out-String).Trim()
if (-not $gitBranch) { $gitBranch = "DETACHED" }
$gitStatus = @(& git -C $repoRoot status --porcelain --untracked-files=all)
if ($gitStatus.Count -gt 0) {
  throw @"
Worktree must be clean for exact-SHA Maestro visual proof.
Current changes:
$($gitStatus -join [Environment]::NewLine)
"@
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) is required to resolve/download the exact-SHA Mobile Native Smoke artifact."
}

$maestro = Resolve-Maestro -Override $MaestroBin
if (-not $maestro) {
  throw "Maestro CLI not found. Run: pwsh -File scripts/install-maestro.ps1"
}

$androidEnv = Join-Path $repoRoot "scripts\android-env.ps1"
if (-not (Test-Path $androidEnv -PathType Leaf)) { throw "Missing Android environment resolver: $androidEnv" }
. $androidEnv
$adbPath = Join-Path $env:ANDROID_SDK_ROOT "platform-tools\adb.exe"
if (-not (Test-Path $adbPath -PathType Leaf)) { throw "adb not found at $adbPath" }
$selectedDevice = Resolve-Device -Adb $adbPath -Requested $DeviceId
$deviceHash = (Get-Sha256Text -Value $selectedDevice).Substring(0, 16)

if (-not $OutputRoot) {
  $OutputRoot = Join-Path $repoRoot "artifacts\mobile-maestro-visual-proof"
}
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path $OutputRoot "$gitShort-$timestamp"
$artifactDir = Join-Path $runDir "source-artifact"
$shotsDir = Join-Path $runDir "maestro"
$canonicalShotsDir = Join-Path $runDir "screenshots"
$manifestOut = Join-Path $runDir "visual-proof-manifest.json"
$summaryOut = Join-Path $runDir "visual-proof-summary.md"
New-Item -ItemType Directory -Force -Path $artifactDir, $shotsDir, $canonicalShotsDir | Out-Null

if (-not $CiRunId) {
  $runsJson = ((& gh run list --workflow "Mobile Native Smoke" --status success --commit $gitSha --limit 30 --json databaseId,headSha,headBranch,conclusion 2>&1) | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) { throw "Could not query successful Mobile Native Smoke runs for ${gitSha}: $runsJson" }
  $runs = @()
  if ($runsJson) { $runs = @($runsJson | ConvertFrom-Json) }
  $matchingRun = @($runs | Where-Object { $_.headSha -eq $gitSha -and $_.conclusion -eq "success" } | Select-Object -First 1)
  if ($matchingRun.Count -eq 0) {
    throw "No successful Mobile Native Smoke artifact exists for exact Git SHA $gitSha. Trigger the Gumball exact-SHA Android native proof first; do not compile an APK from this visual-proof script."
  }
  $CiRunId = [string]$matchingRun[0].databaseId
}

$artifactName = "mobile-runtime-$CiRunId"
Invoke-Checked "gh" @("run", "download", $CiRunId, "--name", $artifactName, "--dir", $artifactDir) $repoRoot

$sourceManifestPath = Join-Path $artifactDir "manifest.json"
$apkPath = Join-Path $artifactDir "app-release.apk"
if (-not (Test-Path $sourceManifestPath -PathType Leaf)) { throw "Exact-SHA artifact manifest missing: $sourceManifestPath" }
if (-not (Test-Path $apkPath -PathType Leaf)) { throw "Exact-SHA release APK missing: $apkPath" }

$sourceManifest = Get-Content -Raw $sourceManifestPath | ConvertFrom-Json
if ([string]$sourceManifest.sourceHeadSha -ne $gitSha) {
  throw "CI artifact source SHA mismatch. Expected $gitSha, got $($sourceManifest.sourceHeadSha)."
}
if ([string]$sourceManifest.builtGitSha -ne $gitSha) {
  throw "CI artifact built SHA mismatch. Expected $gitSha, got $($sourceManifest.builtGitSha)."
}
if ([string]$sourceManifest.workflowRunId -ne [string]$CiRunId) {
  throw "CI artifact run-id mismatch. Expected $CiRunId, got $($sourceManifest.workflowRunId)."
}
if ([string]$sourceManifest.packageId -ne "com.sport.athlete") {
  throw "Unexpected packageId in exact-SHA artifact: $($sourceManifest.packageId)"
}
if ($null -eq $sourceManifest.updatesEnabled -or [bool]$sourceManifest.updatesEnabled) {
  throw "Exact-SHA visual proof requires Expo OTA updates disabled in the source artifact."
}
if ([string]$sourceManifest.visionFixtures -ne "true") {
  throw "Exact-SHA visual proof requires deterministic EXPO_PUBLIC_VISION_FIXTURES=true."
}
if ([string]$sourceManifest.runtimeAcceptance -ne "true") {
  throw "Exact-SHA visual proof requires MOBILE_RUNTIME_ACCEPTANCE=true."
}
if ([string]$sourceManifest.nodeEnv -ne "production") {
  throw "Exact-SHA visual proof requires NODE_ENV=production."
}

$apkSha256 = (Get-FileHash -Algorithm SHA256 $apkPath).Hash.ToLowerInvariant()
$expectedApkSha256 = ([string]$sourceManifest.apkSha256).ToLowerInvariant()
if ($apkSha256 -ne $expectedApkSha256) {
  throw "CI artifact APK SHA-256 mismatch. Expected $expectedApkSha256, got $apkSha256."
}

$buildProfile = [string]$sourceManifest.buildProfile
if ($buildProfile -eq "pilot-local") {
  try {
    $backendHealth = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health/" -UseBasicParsing -TimeoutSec 10
  } catch {
    throw "pilot-local visual proof requires the Home Lab backend on http://127.0.0.1:8000 before device launch. $($_.Exception.Message)"
  }
  if ($backendHealth.StatusCode -ne 200) {
    throw "pilot-local backend health check returned HTTP $($backendHealth.StatusCode), expected 200."
  }
}

Write-Host ""
Write-Host "=== Exact-SHA Maestro visual proof ===" -ForegroundColor Cyan
Write-Host "  Git SHA:   $gitSha"
Write-Host "  CI run:    $CiRunId"
Write-Host "  APK SHA:   $apkSha256"
Write-Host "  Device:    $deviceHash"
Write-Host "  Evidence:  $runDir"

Invoke-Checked $adbPath @("-s", $selectedDevice, "install", "-r", $apkPath) $repoRoot
Invoke-Checked $adbPath @("-s", $selectedDevice, "shell", "pm", "clear", "com.sport.athlete") $repoRoot

if ($buildProfile -eq "pilot-local") {
  Invoke-Checked $adbPath @("-s", $selectedDevice, "reverse", "tcp:8000", "tcp:8000") $repoRoot
  Invoke-Checked $adbPath @("-s", $selectedDevice, "reverse", "tcp:8001", "tcp:8001") $repoRoot
}

foreach ($permission in @(
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_BACKGROUND_LOCATION"
)) {
  Invoke-Checked $adbPath @("-s", $selectedDevice, "shell", "pm", "grant", "com.sport.athlete", $permission) $repoRoot
}

Invoke-Checked $adbPath @(
  "-s", $selectedDevice,
  "shell", "monkey",
  "-p", "com.sport.athlete",
  "-c", "android.intent.category.LAUNCHER",
  "1"
) $repoRoot

$packagePid = ""
$launchDeadline = (Get-Date).AddSeconds(10)
do {
  $packagePid = ((& $adbPath -s $selectedDevice shell pidof com.sport.athlete 2>$null) | Out-String).Trim()
  if ($packagePid) { break }
  Start-Sleep -Milliseconds 500
} while ((Get-Date) -lt $launchDeadline)

if (-not $packagePid) {
  throw "Explicit ADB launch did not keep com.sport.athlete running."
}

$packageDump = @(& $adbPath -s $selectedDevice shell dumpsys package com.sport.athlete)
$versionName = (($packageDump | Select-String "versionName=" | Select-Object -First 1).Line).Trim()
$versionCode = (($packageDump | Select-String "versionCode=" | Select-Object -First 1).Line).Trim()
if (-not $versionName -or -not $versionCode) { throw "Installed package identity could not be read." }

$flowPath = Join-Path $repoRoot "mobile\.maestro\flows\visual-proof-ride.yaml"
if (-not (Test-Path $flowPath -PathType Leaf)) { throw "Canonical Maestro visual flow missing: $flowPath" }
$maestroVersion = ((& $maestro --version 2>&1) | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw "Could not read Maestro version." }

Invoke-Checked $maestro @("--device=$selectedDevice", "test", "--test-output-dir=$shotsDir", $flowPath) $repoRoot

$requiredScreens = @(
  "01_today.png",
  "02_start_ride.png",
  "03_active_ride.png",
  "04_paused.png",
  "05_summary.png",
  "06_today_after_summary.png"
)
$screenEvidence = @()
foreach ($name in $requiredScreens) {
  $matches = @(
    Get-ChildItem -Path $shotsDir -Recurse -File -Filter $name -ErrorAction SilentlyContinue
  )
  if ($matches.Count -eq 0) { throw "Mandatory Maestro screenshot missing: $name" }
  if ($matches.Count -gt 1) {
    throw "Mandatory Maestro screenshot is ambiguous ($($matches.Count) matches): $name"
  }

  $sourcePath = $matches[0].FullName
  $path = Join-Path $canonicalShotsDir $name
  Copy-Item -LiteralPath $sourcePath -Destination $path -Force

  $file = Get-Item $path
  if ($file.Length -lt 10000) { throw "Mandatory Maestro screenshot is implausibly small: $name" }
  $screenEvidence += [ordered]@{
    name = $name
    bytes = $file.Length
    sha256 = (Get-FileHash -Algorithm SHA256 $path).Hash.ToLowerInvariant()
  }
}

$deviceApi = (& $adbPath -s $selectedDevice shell getprop ro.build.version.sdk).Trim()
$deviceAbi = (& $adbPath -s $selectedDevice shell getprop ro.product.cpu.abi).Trim()
$deviceModel = (& $adbPath -s $selectedDevice shell getprop ro.product.model).Trim()
$deviceManufacturer = (& $adbPath -s $selectedDevice shell getprop ro.product.manufacturer).Trim()
$displaySize = ((& $adbPath -s $selectedDevice shell wm size) | Out-String).Trim()
$displayDensity = ((& $adbPath -s $selectedDevice shell wm density) | Out-String).Trim()

$proof = [ordered]@{
  schemaVersion = 1
  result = "PASS"
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  git = [ordered]@{ sha = $gitSha; shortSha = $gitShort; branch = $gitBranch; clean = $true }
  sourceArtifact = [ordered]@{
    ciWorkflowRunId = [string]$CiRunId
    sourceHeadSha = [string]$sourceManifest.sourceHeadSha
    builtGitSha = [string]$sourceManifest.builtGitSha
    apkSha256 = $apkSha256
    packageId = [string]$sourceManifest.packageId
    buildProfile = $buildProfile
    versionName = $versionName
    versionCode = $versionCode
    otaUpdatesEnabled = [bool]$sourceManifest.updatesEnabled
    visionFixtures = [string]$sourceManifest.visionFixtures
  }
  maestro = [ordered]@{
    version = $maestroVersion
    flow = "mobile/.maestro/flows/visual-proof-ride.yaml"
    rawOutputDirectory = "maestro"
    screenshotDirectory = "screenshots"
    explicitAdbLaunch = $true
  }
  device = [ordered]@{
    serialHash = $deviceHash
    manufacturer = $deviceManufacturer
    model = $deviceModel
    api = $deviceApi
    abi = $deviceAbi
    displaySize = $displaySize
    displayDensity = $displayDensity
  }
  screenshots = $screenEvidence
}
$proof | ConvertTo-Json -Depth 8 | Set-Content -Path $manifestOut -Encoding UTF8

$summary = @(
  "# 4VELO Maestro exact-SHA visual proof",
  "",
  "- Result: **PASS**",
  "- Git SHA: $gitSha",
  "- CI artifact run: $CiRunId",
  "- APK SHA-256: $apkSha256",
  "- Device: $deviceManufacturer $deviceModel / API $deviceApi / serial hash $deviceHash",
  "- Maestro: $maestroVersion",
  "",
  "## Required manual visual review",
  "",
  "- [ ] Today hierarchy / dominant Start Ride",
  "- [ ] Start Ride readiness / primary START",
  "- [ ] Active Ride map-data-control hierarchy",
  "- [ ] Paused overlay keeps Ride context and dominant Resume",
  "- [ ] Summary terminal truth precedes celebration",
  "- [ ] Return to Today remains coherent",
  "",
  "> PASS proves deterministic exact-artifact execution and screenshot provenance. It does not replace human visual acceptance."
)
$summary -join [Environment]::NewLine | Set-Content -Path $summaryOut -Encoding UTF8

Write-Host ""
Write-Host "PASS — exact-SHA Maestro visual proof captured." -ForegroundColor Green
Write-Host "Manifest: $manifestOut"
Write-Host "Summary:  $summaryOut"
