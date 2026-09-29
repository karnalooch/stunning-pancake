#Requires -Version 5.1
<#
.SYNOPSIS
  Fail-closed local Android/ADB preflight for 4VELO Windows development.

.DESCRIPTION
  Resolves the canonical Android SDK/JDK through scripts/android-env.ps1,
  rejects conflicting SDK/ADB authorities, validates the pinned Node/pnpm/JDK
  toolchain, checks device/package/ports/adb reverse state, and writes a
  secret-free provenance JSON file.

  This command never builds or installs an APK. Use -ToolchainOnly while
  bootstrapping a new machine before a device/emulator is available.
#>

[CmdletBinding()]
param(
  [string]$SdkRoot = "",
  [string]$JavaHome = "",
  [string]$DeviceId = "",
  [string]$ExpectedPackage = "com.sport.athlete",
  [string]$OutputPath = "",
  [int]$TimeoutSeconds = 15,
  [switch]$ToolchainOnly,
  [switch]$RequirePilotReverse
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($TimeoutSeconds -lt 1 -or $TimeoutSeconds -gt 120) {
  throw "TimeoutSeconds must be between 1 and 120."
}

function Normalize-PathText {
  param([string]$Path)
  if (-not $Path) { return $null }
  $resolved = $Path
  try {
    if (Test-Path $Path) { $resolved = (Resolve-Path $Path).Path }
  } catch {}
  if ($env:USERPROFILE) {
    $escaped = [Regex]::Escape($env:USERPROFILE.TrimEnd("\"))
    $resolved = [Regex]::Replace($resolved, "^$escaped", "%USERPROFILE%", "IgnoreCase")
  }
  return $resolved
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

function Invoke-BoundedProcess {
  param(
    [Parameter(Mandatory=$true)][string]$FilePath,
    [string[]]$Arguments = @(),
    [int]$Timeout = $TimeoutSeconds,
    [switch]$AllowFailure
  )

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $extension = [System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()
  $quotedArguments = ($Arguments | ForEach-Object {
    if ($_ -match '[\s"]') { '"' + ($_ -replace '"','\"') + '"' } else { $_ }
  }) -join ' '

  if ($extension -eq ".cmd" -or $extension -eq ".bat") {
    $psi.FileName = $env:ComSpec
    $escapedFile = '"' + ($FilePath -replace '"','""') + '"'
    $psi.Arguments = '/d /s /c "' + $escapedFile + $(if ($quotedArguments) { ' ' + $quotedArguments } else { '' }) + '"'
  } elseif ($extension -eq ".ps1") {
    $powershellExe = Join-Path $PSHOME "powershell.exe"
    $escapedFile = '"' + ($FilePath -replace '"','\"') + '"'
    $psi.FileName = $powershellExe
    $psi.Arguments = '-NoProfile -ExecutionPolicy Bypass -File ' + $escapedFile + $(if ($quotedArguments) { ' ' + $quotedArguments } else { '' })
  } else {
    $psi.FileName = $FilePath
    $psi.Arguments = $quotedArguments
  }

  $psi.WorkingDirectory = $repoRoot
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $psi
  if (-not $process.Start()) {
    throw "Could not start: $FilePath $($Arguments -join ' ')"
  }

  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  if (-not $process.WaitForExit($Timeout * 1000)) {
    try { $process.Kill() } catch {}
    try { $process.WaitForExit() } catch {}
    throw "Timed out after $($Timeout)s: $FilePath $($Arguments -join ' ')"
  }

  $stdout = $stdoutTask.GetAwaiter().GetResult().Trim()
  $stderr = $stderrTask.GetAwaiter().GetResult().Trim()
  if ($process.ExitCode -ne 0 -and -not $AllowFailure) {
    throw ("Exit code $($process.ExitCode): $FilePath $($Arguments -join ' ')" + [Environment]::NewLine + $stderr)
  }

  return [pscustomobject]@{
    ExitCode = $process.ExitCode
    StdOut = $stdout
    StdErr = $stderr
  }
}

function Resolve-CommandPath {
  param([Parameter(Mandatory=$true)][string]$Name)

  foreach ($candidate in @("$Name.exe", "$Name.cmd", "$Name.bat", "$Name.ps1", $Name)) {
    $command = Get-Command $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command -and $command.Source) {
      return $command.Source
    }
  }
  throw "Required command not found: $Name"
}

function Get-ValidSdkCandidates {
  param([string]$Override)
  $raw = @()
  if ($Override) { $raw += $Override }
  if ($env:ANDROID_SDK_ROOT) { $raw += $env:ANDROID_SDK_ROOT }
  if ($env:ANDROID_HOME) { $raw += $env:ANDROID_HOME }
  if ($env:LOCALAPPDATA) { $raw += (Join-Path $env:LOCALAPPDATA "Android\Sdk") }

  $valid = @()
  foreach ($candidate in ($raw | Where-Object { $_ } | Select-Object -Unique)) {
    $expanded = [Environment]::ExpandEnvironmentVariables($candidate)
    $adb = Join-Path $expanded "platform-tools\adb.exe"
    if (Test-Path $adb -PathType Leaf) {
      $valid += (Resolve-Path $expanded).Path
    }
  }
  return @($valid | Select-Object -Unique)
}

function Get-AdbProcessAuthorities {
  $paths = @()
  try {
    $processes = @(Get-CimInstance Win32_Process -Filter "Name = 'adb.exe'" -ErrorAction Stop)
    foreach ($process in $processes) {
      if ($process.ExecutablePath) {
        $paths += $process.ExecutablePath
      }
    }
  } catch {
    Write-Warning "Could not inspect running adb.exe processes: $($_.Exception.Message)"
  }
  return @($paths | Select-Object -Unique)
}

function Get-ListeningPorts {
  $result = Invoke-BoundedProcess -FilePath "netstat.exe" -Arguments @("-ano", "-p", "tcp")
  $listeners = @()
  foreach ($line in ($result.StdOut -split "\r?\n")) {
    if ($line -match "^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$") {
      $listeners += [pscustomobject]@{
        Port = [int]$Matches[1]
        Pid = [int]$Matches[2]
      }
    }
  }
  return $listeners
}

function Get-ProcessEvidence {
  param([int]$ProcessId)
  if ($ProcessId -le 0) { return $null }
  try {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    if (-not $process) { return $null }
    return [ordered]@{
      pid = $ProcessId
      name = $process.Name
      executable = Normalize-PathText $process.ExecutablePath
    }
  } catch {
    return [ordered]@{ pid = $ProcessId; name = $null; executable = $null }
  }
}

function Get-ProcessCommandLine {
  param([int]$ProcessId)
  if ($ProcessId -le 0) { return $null }
  try {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    if (-not $process -or -not $process.CommandLine) { return $null }
    return $process.CommandLine
  } catch {
    return $null
  }
}

function Get-OnlineDevices {
  param([Parameter(Mandatory=$true)][string]$Adb)
  $result = Invoke-BoundedProcess -FilePath $Adb -Arguments @("devices")
  $devices = @()
  foreach ($line in ($result.StdOut -split "\r?\n")) {
    if ($line -match "^(\S+)\s+device(?:\s|$)") {
      $devices += $Matches[1]
    }
  }
  return $devices
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) {
  throw "Run this command from inside the 4VELO repository."
}

$gitSha = (git -C $repoRoot rev-parse HEAD).Trim()
if ($gitSha -notmatch "^[0-9a-f]{40}$") {
  throw "Could not resolve a full 40-character Git SHA."
}
$gitBranch = ((git -C $repoRoot branch --show-current) | Out-String).Trim()
if (-not $gitBranch) { $gitBranch = "DETACHED" }
$gitDirty = @((git -C $repoRoot status --porcelain --untracked-files=all)).Count -gt 0

$sdkCandidatesBefore = @(Get-ValidSdkCandidates -Override $SdkRoot)
if ($sdkCandidatesBefore.Count -gt 1) {
  throw "Conflicting Android SDK roots detected before resolution: $($sdkCandidatesBefore -join ', ')"
}

$androidEnv = Join-Path $repoRoot "scripts\android-env.ps1"
if (-not (Test-Path $androidEnv -PathType Leaf)) {
  throw "Missing canonical Android environment resolver: $androidEnv"
}
. $androidEnv -SdkRoot $SdkRoot -JavaHome $JavaHome

$resolvedSdk = (Resolve-Path $env:ANDROID_SDK_ROOT).Path
$resolvedJava = (Resolve-Path $env:JAVA_HOME).Path
$adbPath = (Resolve-Path (Join-Path $resolvedSdk "platform-tools\adb.exe")).Path

$pathAdbCommands = @(Get-Command adb -All -ErrorAction SilentlyContinue | Where-Object { $_.Source } | ForEach-Object { $_.Source } | Select-Object -Unique)
$foreignPathAdb = @($pathAdbCommands | Where-Object {
  try { (Resolve-Path $_).Path -ne $adbPath } catch { $true }
})
if ($foreignPathAdb.Count -gt 0) {
  throw "PATH exposes adb outside the canonical SDK: $($foreignPathAdb -join ', '). Canonical: $adbPath"
}

$runningAdbAuthorities = @(Get-AdbProcessAuthorities)
$foreignRunningAdb = @($runningAdbAuthorities | Where-Object {
  try { (Resolve-Path $_).Path -ne $adbPath } catch { $true }
})
if ($foreignRunningAdb.Count -gt 0) {
  throw "A stale/foreign adb server is running from: $($foreignRunningAdb -join ', '). Stop it before continuing."
}

$nodePath = Resolve-CommandPath "node"
$pnpmPath = Resolve-CommandPath "pnpm"
$javaPath = Join-Path $resolvedJava "bin\java.exe"
if (-not (Test-Path $javaPath -PathType Leaf)) {
  throw "Resolved JAVA_HOME does not contain bin\java.exe: $resolvedJava"
}

$nodeVersion = (Invoke-BoundedProcess -FilePath $nodePath -Arguments @("--version")).StdOut
$pnpmVersion = (Invoke-BoundedProcess -FilePath $pnpmPath -Arguments @("--version")).StdOut
$javaVersionRaw = Invoke-BoundedProcess -FilePath $javaPath -Arguments @("-version")
$javaVersion = (($javaVersionRaw.StdErr + [Environment]::NewLine + $javaVersionRaw.StdOut).Trim())
$adbVersion = (Invoke-BoundedProcess -FilePath $adbPath -Arguments @("version")).StdOut

$expectedNode = "24.21.0"
$expectedPnpm = "12.4.2"
if ($nodeVersion.TrimStart("v") -ne $expectedNode) {
  throw "Node version mismatch. Expected $expectedNode, got $nodeVersion."
}
if ($pnpmVersion -ne $expectedPnpm) {
  throw "pnpm version mismatch. Expected $expectedPnpm, got $pnpmVersion."
}
if ($javaVersion -notmatch 'version "?17(?:\.|")') {
  throw "JDK 17 is required. Resolved Java reports: $javaVersion"
}

$listeners = @(Get-ListeningPorts)
$portEvidence = [ordered]@{}
foreach ($port in @(5037, 8081, 8000, 8001)) {
  $matches = @($listeners | Where-Object { $_.Port -eq $port })
  $owners = @()
  foreach ($match in $matches) {
    $owners += Get-ProcessEvidence -ProcessId $match.Pid
  }
  $portEvidence["$port"] = $owners
}

$metroOwners = @($portEvidence["8081"])
if ($metroOwners.Count -gt 0) {
  foreach ($owner in $metroOwners) {
    if ($owner.name -and $owner.name -notmatch "^node(?:\.exe)?$") {
      throw "Port 8081 is occupied by non-Node process PID $($owner.pid) ($($owner.name))."
    }
    $metroCommand = Get-ProcessCommandLine -ProcessId $owner.pid
    if ($metroCommand -and $metroCommand -notmatch [Regex]::Escape($repoRoot)) {
      throw "Port 8081 is owned by a Node/Metro process outside this 4VELO checkout (PID $($owner.pid))."
    }
  }
}

$selectedDevice = $null
$deviceEvidence = $null
$reverseEvidence = @()
$packageInstalled = $null

if (-not $ToolchainOnly) {
  $online = @(Get-OnlineDevices -Adb $adbPath)
  if ($DeviceId) {
    if ($online -notcontains $DeviceId) {
      throw "Requested device '$DeviceId' is not online. Online: $($online -join ', ')"
    }
    $selectedDevice = $DeviceId
  } elseif ($online.Count -eq 0) {
    throw "No authorized Android device/emulator is online. Use -ToolchainOnly during initial machine setup."
  } elseif ($online.Count -gt 1) {
    throw "Multiple Android devices are online ($($online -join ', ')). Re-run with -DeviceId <serial>."
  } else {
    $selectedDevice = $online[0]
  }

  $deviceModel = (Invoke-BoundedProcess -FilePath $adbPath -Arguments @("-s", $selectedDevice, "shell", "getprop", "ro.product.model")).StdOut
  $deviceApi = (Invoke-BoundedProcess -FilePath $adbPath -Arguments @("-s", $selectedDevice, "shell", "getprop", "ro.build.version.sdk")).StdOut
  $deviceAbi = (Invoke-BoundedProcess -FilePath $adbPath -Arguments @("-s", $selectedDevice, "shell", "getprop", "ro.product.cpu.abi")).StdOut

  $packageProbe = Invoke-BoundedProcess -FilePath $adbPath -Arguments @("-s", $selectedDevice, "shell", "pm", "path", $ExpectedPackage) -AllowFailure
  $packageInstalled = $packageProbe.ExitCode -eq 0 -and $packageProbe.StdOut -match "^package:"
  if (-not $packageInstalled) {
    throw "Expected Android package '$ExpectedPackage' is not installed on the selected device."
  }

  $reverseRaw = (Invoke-BoundedProcess -FilePath $adbPath -Arguments @("-s", $selectedDevice, "reverse", "--list") -AllowFailure).StdOut
  $reverseEvidence = @($reverseRaw -split "\r?\n" | Where-Object { $_ -match "\S" })
  if ($RequirePilotReverse) {
    foreach ($required in @("tcp:8000", "tcp:8001")) {
      if (-not ($reverseEvidence -match [Regex]::Escape($required))) {
        throw "Required pilot-local adb reverse mapping is missing: $required. Configure 8000/8001 before continuing."
      }
    }
  }

  $deviceEvidence = [ordered]@{
    serialHash = (Get-Sha256Text -Value $selectedDevice).Substring(0, 16)
    model = $deviceModel
    api = $deviceApi
    abi = $deviceAbi
    expectedPackage = $ExpectedPackage
    packageInstalled = [bool]$packageInstalled
  }
}

if (-not $OutputPath) {
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $shortSha = $gitSha.Substring(0, 12)
  $OutputPath = Join-Path $repoRoot "artifacts\android-preflight\$shortSha-$timestamp.json"
}

$provenance = [ordered]@{
  schemaVersion = 1
  result = "PASS"
  generatedAtUtc = [DateTime]::UtcNow.ToString("o")
  repository = [ordered]@{
    root = Normalize-PathText $repoRoot
    sha = $gitSha
    branch = $gitBranch
    dirty = $gitDirty
  }
  toolchain = [ordered]@{
    node = [ordered]@{ version = $nodeVersion; path = Normalize-PathText $nodePath }
    pnpm = [ordered]@{ version = $pnpmVersion; path = Normalize-PathText $pnpmPath }
    java = [ordered]@{ version = $javaVersion; home = Normalize-PathText $resolvedJava; path = Normalize-PathText $javaPath }
    androidSdk = Normalize-PathText $resolvedSdk
    adb = [ordered]@{ version = $adbVersion; path = Normalize-PathText $adbPath }
  }
  adbAuthorities = [ordered]@{
    pathCommands = @($pathAdbCommands | ForEach-Object { Normalize-PathText $_ })
    runningProcesses = @($runningAdbAuthorities | ForEach-Object { Normalize-PathText $_ })
  }
  ports = $portEvidence
  device = $deviceEvidence
  adbReverse = $reverseEvidence
  modes = [ordered]@{
    toolchainOnly = [bool]$ToolchainOnly
    requirePilotReverse = [bool]$RequirePilotReverse
  }
}

$outputParent = Split-Path $OutputPath -Parent
if ($outputParent) {
  New-Item -ItemType Directory -Force -Path $outputParent | Out-Null
}
$provenance | ConvertTo-Json -Depth 8 | Set-Content -Path $OutputPath -Encoding UTF8

Write-Host ""
Write-Host "=== 4VELO Android preflight PASS ===" -ForegroundColor Green
Write-Host "  Git SHA:     $gitSha"
Write-Host "  SDK:         $resolvedSdk"
Write-Host "  ADB:         $adbPath"
Write-Host "  Node/pnpm:   $nodeVersion / $pnpmVersion"
if ($selectedDevice) {
  Write-Host "  Device hash: $($deviceEvidence.serialHash)"
  Write-Host "  Package:     $ExpectedPackage"
}
Write-Host "  Provenance:  $OutputPath"
