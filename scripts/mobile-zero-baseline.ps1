#Requires -Version 5.1
<#
.SYNOPSIS
  Read-only absolute-zero baseline capture for the 4VELO mobile toolchain.

.DESCRIPTION
  Collects evidence about the Windows host, Git worktree, Node/pnpm, Java,
  Android SDK/ADB/emulator, local ports, Metro processes, mobile dependency
  resolution, Expo config, EAS config files, and the installed Android app.

  It does NOT install packages, mutate the repository, start/stop Metro,
  change adb reverse mappings, build an APK, or write Android SDK settings.

  Output is written to a TEMP file by default. Sensitive-looking env values
  are redacted.

.PARAMETER OutputPath
  Optional JSON output path. Defaults to %TEMP%\4velo-mobile-zero-baseline-<timestamp>.json

.PARAMETER RunNetworkChecks
  Opt-in only. Runs ecosystem checks that may access the network/cache:
  expo-doctor and expo install --check. Disabled by default.

.EXAMPLE
  pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/mobile-zero-baseline.ps1

.EXAMPLE
  pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/mobile-zero-baseline.ps1 -RunNetworkChecks
#>

param(
  [string]$OutputPath = "",
  [switch]$RunNetworkChecks
)

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$MobileDir = Join-Path $RepoRoot "mobile"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if (-not $OutputPath) {
  $OutputPath = Join-Path $env:TEMP "4velo-mobile-zero-baseline-$Timestamp.json"
}

function Get-CommandInfo {
  param([Parameter(Mandatory=$true)][string]$Name)
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $cmd) {
    return [ordered]@{ found = $false; path = $null }
  }
  return [ordered]@{
    found = $true
    path = $cmd.Source
    commandType = [string]$cmd.CommandType
  }
}

function Invoke-ReadOnly {
  param(
    [Parameter(Mandatory=$true)][string]$FilePath,
    [string[]]$Arguments = @(),
    [string]$WorkingDirectory = $RepoRoot,
    [int]$TimeoutSeconds = 30
  )
  try {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FilePath
    $psi.Arguments = ($Arguments | ForEach-Object {
      if ($_ -match '[\s"]') { '"' + ($_ -replace '"','\"') + '"' } else { $_ }
    }) -join ' '
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()

    if (-not $proc.WaitForExit($TimeoutSeconds * 1000)) {
      try { $proc.Kill() } catch {}
      return [ordered]@{
        ok = $false
        exitCode = $null
        stdout = ""
        stderr = "TIMEOUT after $TimeoutSeconds seconds"
      }
    }

    return [ordered]@{
      ok = ($proc.ExitCode -eq 0)
      exitCode = $proc.ExitCode
      stdout = $proc.StandardOutput.ReadToEnd().Trim()
      stderr = $proc.StandardError.ReadToEnd().Trim()
    }
  } catch {
    return [ordered]@{
      ok = $false
      exitCode = $null
      stdout = ""
      stderr = $_.Exception.Message
    }
  }
}

function Get-SafeEnv {
  param([Parameter(Mandatory=$true)][string]$Name)

  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrEmpty($value)) {
    return [ordered]@{ set = $false; value = $null }
  }

  $sensitive = $Name -match '(PASSWORD|TOKEN|SECRET|KEY|CREDENTIAL)'
  if ($sensitive) {
    return [ordered]@{
      set = $true
      value = "<REDACTED>"
      length = $value.Length
    }
  }

  return [ordered]@{ set = $true; value = $value }
}

function Get-FileSha256 {
  param([Parameter(Mandatory=$true)][string]$Path)
  if (-not (Test-Path $Path -PathType Leaf)) { return $null }
  try { return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant() } catch { return $null }
}

function Get-RelevantPathEntries {
  $raw = [Environment]::GetEnvironmentVariable("PATH")
  if (-not $raw) { return @() }
  return @($raw -split ';' | Where-Object {
    $_ -match '(Android|Sdk|platform-tools|emulator|cmdline-tools|Java|jdk|node|pnpm|corepack|Python)'
  } | Select-Object -Unique)
}

function Get-PortEvidence {
  param([int[]]$Ports)
  $items = @()
  foreach ($port in $Ports) {
    try {
      $connections = @(Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue)
      if ($connections.Count -eq 0) {
        $items += [ordered]@{ port = $port; listening = $false; entries = @() }
        continue
      }
      $rows = @()
      foreach ($conn in $connections) {
        $procName = $null
        $cmdLine = $null
        if ($conn.OwningProcess) {
          try {
            $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)" -ErrorAction SilentlyContinue
            if ($p) {
              $procName = $p.Name
              $cmdLine = $p.CommandLine
            }
          } catch {}
        }
        $rows += [ordered]@{
          localAddress = $conn.LocalAddress
          localPort = $conn.LocalPort
          state = [string]$conn.State
          pid = $conn.OwningProcess
          process = $procName
          commandLine = $cmdLine
        }
      }
      $items += [ordered]@{ port = $port; listening = $true; entries = $rows }
    } catch {
      $items += [ordered]@{ port = $port; listening = $null; error = $_.Exception.Message }
    }
  }
  return $items
}

function Get-MetroProcesses {
  try {
    return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object {
        $_.CommandLine -and $_.CommandLine -match '(expo\s+start|metro|react-native\s+start)'
      } |
      ForEach-Object {
        [ordered]@{
          pid = $_.ProcessId
          name = $_.Name
          executablePath = $_.ExecutablePath
          commandLine = $_.CommandLine
        }
      })
  } catch {
    return @([ordered]@{ error = $_.Exception.Message })
  }
}

function Parse-MobilePackageId {
  $configPath = Join-Path $MobileDir "app.config.js"
  if (-not (Test-Path $configPath)) { return "com.sport.athlete" }
  try {
    $text = Get-Content $configPath -Raw
    $m = [regex]::Match($text, '"package"\s*:\s*"([^"]+)"')
    if ($m.Success) { return $m.Groups[1].Value }
  } catch {}
  return "com.sport.athlete"
}

function Get-AdbDevices {
  $adb = Get-Command adb -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $adb) {
    return [ordered]@{ available = $false; raw = ""; devices = @() }
  }

  $raw = Invoke-ReadOnly -FilePath $adb.Source -Arguments @("devices","-l")
  $devices = @()

  if ($raw.ok) {
    foreach ($line in ($raw.stdout -split "\r?\n")) {
      if ($line -match '^([^\s]+)\s+device(?:\s+(.*))?$') {
        $serial = $Matches[1]
        $props = $Matches[2]
        $getpropModel = Invoke-ReadOnly -FilePath $adb.Source -Arguments @("-s",$serial,"shell","getprop","ro.product.model")
        $androidRelease = Invoke-ReadOnly -FilePath $adb.Source -Arguments @("-s",$serial,"shell","getprop","ro.build.version.release")
        $sdk = Invoke-ReadOnly -FilePath $adb.Source -Arguments @("-s",$serial,"shell","getprop","ro.build.version.sdk")
        $wmSize = Invoke-ReadOnly -FilePath $adb.Source -Arguments @("-s",$serial,"shell","wm","size")
        $wmDensity = Invoke-ReadOnly -FilePath $adb.Source -Arguments @("-s",$serial,"shell","wm","density")
        $fontScale = Invoke-ReadOnly -FilePath $adb.Source -Arguments @("-s",$serial,"shell","settings","get","system","font_scale")
        $reverse = Invoke-ReadOnly -FilePath $adb.Source -Arguments @("-s",$serial,"reverse","--list")

        $devices += [ordered]@{
          serial = $serial
          descriptor = $props
          model = $getpropModel.stdout
          androidRelease = $androidRelease.stdout
          sdk = $sdk.stdout
          wmSize = $wmSize.stdout
          wmDensity = $wmDensity.stdout
          fontScale = $fontScale.stdout
          reverse = $reverse.stdout
        }
      }
    }
  }

  return [ordered]@{
    available = $true
    raw = $raw.stdout
    devices = $devices
  }
}

function Get-InstalledAppEvidence {
  param(
    [Parameter(Mandatory=$true)][string]$PackageId,
    [Parameter(Mandatory=$true)]$AdbInfo
  )

  $adb = Get-Command adb -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $adb -or -not $AdbInfo.available) { return @() }

  $items = @()
  foreach ($device in $AdbInfo.devices) {
    $serial = $device.serial
    $path = Invoke-ReadOnly -FilePath $adb.Source -Arguments @("-s",$serial,"shell","pm","path",$PackageId)
    $dump = Invoke-ReadOnly -FilePath $adb.Source -Arguments @("-s",$serial,"shell","dumpsys","package",$PackageId)
    $resumed = Invoke-ReadOnly -FilePath $adb.Source -Arguments @("-s",$serial,"shell","dumpsys","activity","activities")

    $versionName = $null
    $versionCode = $null
    if ($dump.stdout) {
      $vm = [regex]::Match($dump.stdout, '(?m)^\s*versionName=([^\r\n]+)')
      if ($vm.Success) { $versionName = $vm.Groups[1].Value.Trim() }
      $vc = [regex]::Match($dump.stdout, '(?m)^\s*versionCode=(\d+)')
      if ($vc.Success) { $versionCode = $vc.Groups[1].Value }
    }

    $foreground = $null
    if ($resumed.stdout) {
      $rm = [regex]::Match($resumed.stdout, '(?m).*mResumedActivity.*')
      if ($rm.Success) { $foreground = $rm.Value.Trim() }
    }

    $items += [ordered]@{
      serial = $serial
      package = $PackageId
      installed = $path.ok -and $path.stdout.StartsWith("package:")
      packagePath = $path.stdout
      versionName = $versionName
      versionCode = $versionCode
      foregroundActivityEvidence = $foreground
    }
  }
  return $items
}

function Get-NodeResolutionEvidence {
  $modules = @(
    "expo",
    "expo-crypto",
    "expo-secure-store",
    "expo-location",
    "expo-task-manager",
    "expo-updates",
    "expo-dev-client",
    "react",
    "react-native",
    "react-native-mmkv",
    "react-native-reanimated",
    "@maplibre/maplibre-react-native"
  )

  $items = @()
  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $pnpm) {
    return @([ordered]@{ module = "*"; ok = $false; error = "pnpm not found" })
  }

  foreach ($module in $modules) {
    $js = "try { console.log(require.resolve(" + [char]39 + $module + [char]39 + ")); } catch (e) { console.error(e.message); process.exit(2); }"
    $probe = Invoke-ReadOnly -FilePath $pnpm.Source -Arguments @("--dir","mobile","exec","node","-e",$js) -WorkingDirectory $RepoRoot
    $items += [ordered]@{
      module = $module
      ok = $probe.ok
      resolvedPath = $probe.stdout
      error = $probe.stderr
    }
  }
  return $items
}

$report = [ordered]@{
  schemaVersion = 1
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  purpose = "4VELO mobile absolute-zero baseline"
  mutationPolicy = "read-only"
  repoRoot = $RepoRoot
}

# Host
$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
$computer = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
$cpu = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
$systemDrive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$($env:SystemDrive)'" -ErrorAction SilentlyContinue

$report.host = [ordered]@{
  os = if ($os) { [ordered]@{
    caption = $os.Caption
    version = $os.Version
    buildNumber = $os.BuildNumber
    architecture = $os.OSArchitecture
  }} else { $null }
  hardware = [ordered]@{
    cpu = if ($cpu) { $cpu.Name } else { $null }
    logicalProcessors = if ($computer) { $computer.NumberOfLogicalProcessors } else { $null }
    totalRamBytes = if ($computer) { [int64]$computer.TotalPhysicalMemory } else { $null }
    systemDriveFreeBytes = if ($systemDrive) { [int64]$systemDrive.FreeSpace } else { $null }
  }
  powershell = [ordered]@{
    version = $PSVersionTable.PSVersion.ToString()
    edition = $PSVersionTable.PSEdition
  }
}

# Commands/toolchain
$commands = @("git","node","npm","corepack","pnpm","java","python","adb","sdkmanager","emulator","eas")
$commandMap = [ordered]@{}
foreach ($name in $commands) { $commandMap[$name] = Get-CommandInfo $name }

$versionProbes = [ordered]@{}
foreach ($spec in @(
  @("git","--version"),
  @("node","--version"),
  @("npm","--version"),
  @("corepack","--version"),
  @("pnpm","--version"),
  @("java","-version"),
  @("python","--version"),
  @("adb","version"),
  @("sdkmanager","--version"),
  @("emulator","-version"),
  @("eas","--version")
)) {
  $name = $spec[0]
  $cmdInfo = $commandMap[$name]
  if ($cmdInfo.found) {
    $versionProbes[$name] = Invoke-ReadOnly -FilePath $cmdInfo.path -Arguments @($spec[1]) -TimeoutSeconds 20
  } else {
    $versionProbes[$name] = [ordered]@{ ok = $false; stderr = "$name not found" }
  }
}

$report.toolchain = [ordered]@{
  commands = $commandMap
  versions = $versionProbes
  javaHome = Get-SafeEnv "JAVA_HOME"
  androidHome = Get-SafeEnv "ANDROID_HOME"
  androidSdkRoot = Get-SafeEnv "ANDROID_SDK_ROOT"
  relevantPathEntries = Get-RelevantPathEntries
}

# Git
$git = $commandMap["git"]
if ($git.found) {
  $report.git = [ordered]@{
    toplevel = (Invoke-ReadOnly -FilePath $git.path -Arguments @("rev-parse","--show-toplevel")).stdout
    branch = (Invoke-ReadOnly -FilePath $git.path -Arguments @("branch","--show-current")).stdout
    head = (Invoke-ReadOnly -FilePath $git.path -Arguments @("rev-parse","HEAD")).stdout
    status = (Invoke-ReadOnly -FilePath $git.path -Arguments @("status","--short","--branch")).stdout
    diffStat = (Invoke-ReadOnly -FilePath $git.path -Arguments @("diff","--stat")).stdout
    worktrees = (Invoke-ReadOnly -FilePath $git.path -Arguments @("worktree","list","--porcelain")).stdout
  }
} else {
  $report.git = [ordered]@{ error = "git not found" }
}

# Repository/config fingerprints
$configPaths = @(
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  ".npmrc",
  ".nvmrc",
  "eas.json",
  ".easignore",
  "version.json",
  "mobile/package.json",
  "mobile/app.config.js",
  "mobile/eas.json",
  "mobile/.easignore",
  "mobile/metro.config.js",
  "mobile/babel.config.js",
  "mobile/tsconfig.json",
  "mobile/eas-build-pre-install.sh"
)
$fingerprints = [ordered]@{}
foreach ($relative in $configPaths) {
  $full = Join-Path $RepoRoot $relative
  $fingerprints[$relative] = [ordered]@{
    exists = Test-Path $full -PathType Leaf
    sha256 = Get-FileSha256 $full
  }
}
$report.repoConfigFingerprints = $fingerprints

# pnpm configuration
$pnpmInfo = $commandMap["pnpm"]
if ($pnpmInfo.found) {
  $report.pnpm = [ordered]@{
    nodeLinker = (Invoke-ReadOnly -FilePath $pnpmInfo.path -Arguments @("config","get","node-linker")).stdout
    shamefullyHoist = (Invoke-ReadOnly -FilePath $pnpmInfo.path -Arguments @("config","get","shamefully-hoist")).stdout
    storeDir = (Invoke-ReadOnly -FilePath $pnpmInfo.path -Arguments @("store","path")).stdout
    nodeResolution = Get-NodeResolutionEvidence
  }
} else {
  $report.pnpm = [ordered]@{ error = "pnpm not found" }
}

# Whitelisted mobile env. Never dump arbitrary environment variables.
$envKeys = @(
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_TELEMETRY_URL",
  "EXPO_PUBLIC_TELEMETRY_WS_INGEST",
  "EXPO_PUBLIC_ENABLE_FIREBASE",
  "EXPO_PUBLIC_VISION_FIXTURES",
  "EXPO_PUBLIC_E2E_AUTO_LOGIN",
  "EXPO_PUBLIC_E2E_SKIP_ONBOARDING",
  "EXPO_PUBLIC_E2E_EMAIL",
  "EXPO_PUBLIC_E2E_PASSWORD",
  "EXPO_PUBLIC_E2E_GPS_RECOVERY",
  "EXPO_PUBLIC_LLM_API_URL",
  "EXPO_PUBLIC_LLM_API_KEY",
  "EXPO_PUBLIC_LLM_MODEL",
  "EAS_BUILD_PROFILE"
)
$mobileEnv = [ordered]@{}
foreach ($key in $envKeys) { $mobileEnv[$key] = Get-SafeEnv $key }
$report.mobileEnvironment = $mobileEnv

# Android SDK / emulator inventory
$androidInventory = [ordered]@{}
if ($commandMap["sdkmanager"].found) {
  $androidInventory.sdkManagerInstalled = Invoke-ReadOnly -FilePath $commandMap["sdkmanager"].path -Arguments @("--list_installed") -TimeoutSeconds 45
}
if ($commandMap["emulator"].found) {
  $androidInventory.avds = Invoke-ReadOnly -FilePath $commandMap["emulator"].path -Arguments @("-list-avds")
}
$adbInfo = Get-AdbDevices
$androidInventory.adb = $adbInfo
$report.android = $androidInventory

# Runtime/process evidence
$packageId = Parse-MobilePackageId
$report.runtime = [ordered]@{
  packageIdFromAppConfig = $packageId
  installedApps = Get-InstalledAppEvidence -PackageId $packageId -AdbInfo $adbInfo
  ports = Get-PortEvidence -Ports @(8000,8001,8081,8083)
  metroProcesses = Get-MetroProcesses
}

# Expo config using the already-installed local Expo CLI only.
if ($pnpmInfo.found) {
  $report.expoConfig = Invoke-ReadOnly -FilePath $pnpmInfo.path -Arguments @("--dir","mobile","exec","expo","config","--type","public","--json") -WorkingDirectory $RepoRoot -TimeoutSeconds 45
} else {
  $report.expoConfig = [ordered]@{ ok = $false; stderr = "pnpm not found" }
}

# Optional network/cache checks. Never implicit.
if ($RunNetworkChecks -and $pnpmInfo.found) {
  $report.networkChecks = [ordered]@{
    expoDoctor = Invoke-ReadOnly -FilePath $pnpmInfo.path -Arguments @("dlx","expo-doctor@latest",".") -WorkingDirectory $MobileDir -TimeoutSeconds 180
    expoInstallCheck = Invoke-ReadOnly -FilePath $pnpmInfo.path -Arguments @("--dir","mobile","exec","expo","install","--check") -WorkingDirectory $RepoRoot -TimeoutSeconds 180
  }
} else {
  $report.networkChecks = [ordered]@{
    skipped = $true
    reason = "RunNetworkChecks not supplied; no implicit download/network access"
  }
}

# Evidence-only flags, not PASS/FAIL conclusions.
$report.observations = [ordered]@{
  rootEasJsonExists = Test-Path (Join-Path $RepoRoot "eas.json")
  mobileEasJsonExists = Test-Path (Join-Path $MobileDir "eas.json")
  generatedAndroidTracked = Test-Path (Join-Path $MobileDir "android")
  generatedIosTracked = Test-Path (Join-Path $MobileDir "ios")
  note = "This collector records evidence only. Interpretation belongs to T80-Z."
}

$json = $report | ConvertTo-Json -Depth 12
$json | Set-Content -Path $OutputPath -Encoding UTF8

Write-Host ""
Write-Host "4VELO mobile zero-baseline evidence captured." -ForegroundColor Green
Write-Host "Report: $OutputPath"
Write-Host "Repository was not modified by this script."
Write-Host ""
Write-Host "Key identity:"
Write-Host "  Branch: $($report.git.branch)"
Write-Host "  HEAD:   $($report.git.head)"
Write-Host "  Status: $($report.git.status)"
Write-Host "  APK id: $packageId"
Write-Host ""
Write-Output $OutputPath
