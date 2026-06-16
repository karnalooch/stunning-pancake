#Requires -Version 5.1
<#
.SYNOPSIS
  Vision Parity Full Harness — build, capture, diff, report.
  Pojedyncze polecenie do pełnej pętli wizja-vs-kod.

.DESCRIPTION
  Kolejność:
    1. Konfiguruje .env (EXPO_PUBLIC_VISION_FIXTURES=true)
    2. Instaluje/aktualizuje Android SDK (jeśli brak)
    3. Buduje APK (lokalnie lub przez EAS)
    4. Instaluje APK na emulatorze/devicu
    5. Uruchamia emulator-ui-audit.py → screenshoty 19 ekranów
    6. Odpala vision_parity_harness.py → SSIM + checklist + composite diffy
    7. Zapisuje raport w docs/design/screenshots/<DATE>-parity-progress/

.PARAMETER DeviceId
  ADB device ID (domyślnie: emulator-5554)

.PARAMETER SkipBuild
  Pomiń budowanie APK (użyj istniejącego)

.PARAMETER SkipCapture
  Pomiń przechwytywanie screenshotów (użyj istniejących)

.PARAMETER BuildMode
  "local" (gradle) lub "eas" (Expo Application Services cloud)

.PARAMETER Threshold
  Próg SSIM (domyślnie 0.6, kierunkowy)

.EXAMPLE
  .\scripts\vision-parity-full-harness.ps1
  Pełna pętla: build → capture → SSIM → raport

.EXAMPLE
  .\scripts\vision-parity-full-harness.ps1 -SkipBuild -DeviceId emulator-5556
  Tylko capture + SSIM na drugim emulatorze, bez rebuildowania

.EXAMPLE
  .\scripts\vision-parity-full-harness.ps1 -BuildMode eas
  Build przez EAS cloud zamiast lokalnego gradle
#>

param(
  [string]$DeviceId = "emulator-5554",
  [switch]$SkipBuild,
  [switch]$SkipCapture,
  [ValidateSet("local", "eas")]
  [string]$BuildMode = "local",
  [float]$Threshold = 0.6
)

$ErrorActionPreference = "Continue"
$repoRoot = Split-Path -Parent $PSScriptRoot
$dateTag = Get-Date -Format "yyyy-MM-dd"
$outputDir = Join-Path $repoRoot "docs\design\screenshots\$dateTag-parity-progress"
$captureDir = Join-Path $repoRoot "docs\design\screenshots\$dateTag-emulator-audit"
$visionDir = Join-Path $repoRoot "docs\design\screenshots\2026-06-14-emulator-audit\vision"
$mobileDir = Join-Path $repoRoot "mobile"
$apkPath = Join-Path $mobileDir "android\app\build\outputs\apk\release\app-release.apk"

# ─── Android SDK config (G: drive) ─────────────────────────────────────
$configScript = Join-Path $PSScriptRoot "android-sdk-gdrive.ps1"
if (Test-Path $configScript) {
    . $configScript
    Write-Host ""
} else {
    Write-Host "[harness] WARN: android-sdk-gdrive.ps1 not found; SDK may not be configured" -ForegroundColor Yellow
}

# ─── helpers ────────────────────────────────────────────────────────────

function Write-Step { param([string]$Text) Write-Host "`n=== $Text ===" -ForegroundColor Cyan }
function Write-OK { param([string]$Text) Write-Host "  OK  $Text" -ForegroundColor Green }
function Write-WARN { param([string]$Text) Write-Host "  WARN $Text" -ForegroundColor Yellow }
function Write-FAIL { param([string]$Text) Write-Host "  FAIL $Text" -ForegroundColor Red }

function Invoke-Cmd {
  param([string]$Exe, [string[]]$Args, [string]$WorkDir = $repoRoot)
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $Exe
  $psi.Arguments = $Args -join " "
  $psi.WorkingDirectory = $WorkDir
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $proc = [System.Diagnostics.Process]::Start($psi)
  $stdout = $proc.StandardOutput.ReadToEnd()
  $stderr = $proc.StandardError.ReadToEnd()
  $proc.WaitForExit()
  if ($stdout) { Write-Host $stdout }
  if ($stderr) { Write-Host $stderr -ForegroundColor DarkYellow }
  if ($proc.ExitCode -ne 0) { throw "Exit code $($proc.ExitCode): $Exe $($Args -join ' ')" }
}

# ─── Step 0: preflight ──────────────────────────────────────────────────

Write-Step "0. Preflight"
if (-not (Test-Path $mobileDir)) { throw "mobile/ not found at $mobileDir" }
if (-not (Test-Path $visionDir)) { Write-WARN "Vision references missing: $visionDir (SSIM won't run)" }
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
New-Item -ItemType Directory -Force -Path $captureDir | Out-Null
Write-OK "Output: $outputDir"
Write-OK "Captures: $captureDir"

# ─── Step 1: verify SDK ─────────────────────────────────────────────────

Write-Step "1. Verify Android SDK (G:\android-sdk)"
$adbPath = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
if ($env:ANDROID_HOME -and (Test-Path $adbPath)) {
    Write-OK "ADB ready: $adbPath"
} else {
    Write-WARN "ADB not found. Run: .\scripts\android-sdk-gdrive.ps1"
    Write-WARN "If SDK missing, harness will auto-download on first run."
}

# ─── Step 2: build APK ──────────────────────────────────────────────────

if (-not $SkipBuild) {
  Write-Step "3. Build APK ($BuildMode)"
  $localProperties = Join-Path $mobileDir "android\local.properties"
  @"
sdk.dir=$($sdkRoot -replace '\\','\\')
"@ | Set-Content -Path $localProperties -Encoding UTF8

  if ($BuildMode -eq "local") {
    Write-Host "  Building via gradle (this may take 5-15 minutes)..."
    Push-Location $mobileDir
    try {
      Invoke-Cmd "npx" @("expo", "prebuild", "--clean", "-p", "android") -WorkDir $mobileDir
      Invoke-Cmd "cmd" @("/c", "gradlew.bat", "assembleRelease") -WorkDir "$mobileDir\android"
      Write-OK "APK built: $apkPath"
    } finally {
      Pop-Location
    }
  } else {
    Write-Host "  Building via EAS cloud (requires EAS CLI login)..."
    Push-Location $mobileDir
    try {
      Invoke-Cmd "npx" @("eas", "build", "--platform", "android", "--profile", "preview", "--non-interactive") -WorkDir $mobileDir
      Write-OK "EAS build queued. Check https://expo.dev/ for download link."
      Write-WARN "EAS builds download as artifact — set `$apkPath manually after download."
    } finally {
      Pop-Location
    }
  }
} else {
  Write-Step "3. Build SKIPPED (using existing APK)"
}

# ─── Step 4: install APK ────────────────────────────────────────────────

if (-not $SkipBuild -and $BuildMode -eq "local") {
  Write-Step "4. Install APK on device"
  Write-Host "  Looking for devices..."
  $devices = & $adbPath devices 2>&1 | Select-String -Pattern "\w+\s+device$"
  if (-not $devices) {
    Write-FAIL "No ADB devices found. Start an emulator or connect a device."
    Write-Host "  To start an emulator: `$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe -avd SportEmulator"
    Write-Host "  To list AVDs: `$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe -list-avds"
    throw "No ADB devices"
  }
  Write-Host "  Devices found:`n  $($devices -join "`n  ")"
  if (Test-Path $apkPath) {
    Write-Host "  Installing $apkPath ..."
    & $adbPath -s $DeviceId install -r $apkPath 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { Write-FAIL "APK install failed"; throw }
    Write-OK "APK installed on $DeviceId"
  } else {
    Write-FAIL "APK not found: $apkPath"
    throw "Build step must produce APK first"
  }
}

# ─── Step 5: capture screenshots ────────────────────────────────────────

if (-not $SkipCapture) {
  Write-Step "5. Capture screenshots"
  $auditScript = Join-Path $repoRoot "scripts\emulator-ui-audit.py"

  if (Test-Path $auditScript) {
    Write-Host "  Running emulator-ui-audit.py ..."
    Push-Location $repoRoot
    try {
      # The audit script uses adb internally; ensure it's on PATH
      $env:PATH = "$sdkRoot\platform-tools;$env:PATH"
      Invoke-Cmd "python" @($auditScript) -WorkDir $repoRoot
      Write-OK "Screenshots captured to $captureDir"
    } catch {
      Write-WARN "Python audit failed: $_"
      Write-Host "  Trying Maestro fallback..."
      $maestroYaml = Join-Path $mobileDir ".maestro\flows\emulator-full-audit.yaml"
      if (Test-Path $maestroYaml) {
        Invoke-Cmd "maestro" @("test", $maestroYaml) -WorkDir $mobileDir
        Write-OK "Maestro capture complete"
      } else {
        Write-FAIL "Neither Python audit nor Maestro flow available"
      }
    } finally {
      Pop-Location
    }
  } else {
    Write-FAIL "Audit script not found: $auditScript"
    throw "Cannot capture screenshots"
  }
} else {
  Write-Step "5. Capture SKIPPED (using existing screenshots)"
}

# ─── Step 6: run vision parity harness ───────────────────────────────────

Write-Step "6. Vision parity SSIM + checklist"
$harnessScript = Join-Path $repoRoot "scripts\vision_parity_harness.py"

if (-not (Test-Path $harnessScript)) {
  Write-FAIL "Harness script not found: $harnessScript"
  throw
}

$actualDir = if (Test-Path $captureDir) { $captureDir } else { $captureDir }
Write-Host "  Actual screenshots: $actualDir"
Write-Host "  Vision references:  $visionDir"
Write-Host "  Output:             $outputDir"

Invoke-Cmd "python" @(
  $harnessScript,
  "--actual", $actualDir,
  "--vision", $visionDir,
  "--out", $outputDir,
  "--threshold", [string]$Threshold,
  "--composite",
  "--report-only"
) -WorkDir $repoRoot

# ─── Step 7: summary ─────────────────────────────────────────────────────

Write-Step "7. Summary"
$reportJson = Join-Path $outputDir "report.json"
$reportMd = Join-Path $outputDir "report.md"
$checklistMd = Join-Path $outputDir "checklist.md"

@("$reportJson", "$reportMd", "$checklistMd") | ForEach-Object {
  if (Test-Path $_) {
    $size = (Get-Item $_).Length
    Write-OK "$_ ($size bytes)"
  } else {
    Write-WARN "$_ MISSING"
  }
}

Write-Host "`n=== Pipeline complete ===" -ForegroundColor Cyan
Write-Host "Checklist (human gate): $checklistMd"
Write-Host "SSIM report:            $reportMd"
Write-Host "Composite diff PNGs:    $outputDir\diff_*.png"
Write-Host "`nTo iterate: fix code → rebuild → rerun this script."
Write-Host "Threshold is directional ($Threshold) — the real gate is checklist.md."
