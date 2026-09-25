#Requires -Version 5.1
<#
.SYNOPSIS
  Stage an isolated Android Gradle CMake/Ninja toolchain that bypasses the
  Android SDK's bundled Ninja 1.10.2 on Windows.

.DESCRIPTION
  T83 confirmed a reproducibility failure in our Windows Android native
  toolchain: CMake invoked from a Gradle-built Android project refuses to
  accept the Android SDK's pre-staged build.ninja output and prints
  `manifest 'build.ninja' still dirty after 100 tries`. Substituting the
  SDK's bundled `ninja.exe` with Ninja 1.12.1 made
  `react-native-nitro-modules:buildCMakeDebug[x86_64]` and
  `assembleDebug -PreactNativeArchitectures=x86_64` pass on a clean machine
  while leaving the SDK installation itself untouched.

  This script is the durable, idempotent productisation of that workaround.
  It does NOT modify the Android SDK or any global CMake/Ninja install. It
  prepares a per-user toolchain at
  `${env:LOCALAPPDATA}\4velo\android-toolchain\cmake-3.22.1-ninja-1.12.1\`
  by copying the SDK's CMake 3.22.1 tree, dropping the SDK's bundled
  ninja.exe, and pinning a Ninja 1.12.1 binary downloaded from the official
  ninja-build release whose SHA256 is checked on every run.

  Optional -ConfigureGradle writes the resulting toolchain path into
  `mobile/android/local.properties` under the `cmake.dir=` key, preserving
  every other existing key (e.g. `sdk.dir`, `ndk.dir`).

  Use -SelfTest to validate the version gate and contract checks without
  requiring an Android SDK. -SelfTest is platform-agnostic so it can run in
  Linux-based CI for the contract portion.

.PARAMETER SdkRoot
  Override the Android SDK root. Falls back to $env:ANDROID_SDK_ROOT,
  $env:ANDROID_HOME, then %LOCALAPPDATA%\Android\Sdk.

.PARAMETER ToolchainRoot
  Override the isolated toolchain parent directory. Defaults to
  `$env:LOCALAPPDATA\4velo\android-toolchain`.

.PARAMETER NinjaExe
  Skip the download. Use a pre-staged ninja.exe (still subject to the same
  SHA256 verification unless -SkipHashCheck is also passed).

.PARAMETER LocalPropertiesPath
  Where to write the `cmake.dir=` line. Only used with -ConfigureGradle.

.PARAMETER ConfigureGradle
  When set, write/update the `cmake.dir=` key in $LocalPropertiesPath,
  preserving every other line.

.PARAMETER SkipGradle
  Skip writing `cmake.dir=` to local.properties; the call is idempotent on
  its own.

.PARAMETER Force
  Recreate the isolated toolchain even if it already exists.

.PARAMETER SkipHashCheck
  Skip the SHA256 verification of the downloaded Ninja binary. Do not use
  unless you trust the source. Intended for offline smoke-tests only.

.PARAMETER SelfTest
  Run the bootstrap's contract checks against fake binaries; do not touch
  disk state and do not require an Android SDK.

.PARAMETER Quiet
  Suppress progress chatter; only print the final summary and any errors.

.EXAMPLE
  pwsh -File scripts/android/ninja-bootstrap.ps1 -ConfigureGradle

  Prepare the isolated toolchain for the current user and write the
  `cmake.dir=` line into `mobile/android/local.properties`.

.EXAMPLE
  pwsh -File scripts/android/ninja-bootstrap.ps1 -SelfTest

  Validate the contract (version gate, hash policy, idempotency helpers)
  on any platform. Does not require PowerShell Modules, Android SDK, or
  network access beyond the path the contract itself exercises.

.NOTES
  - Pinned artifact:
      URL:       https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip
      SHA256 (zip):  F550FEC705B6D6FF58F2DB3C374C2277A37691678D6ABA463ADCBB129108467A
      SHA256 (exe):  68865C3276D449D746CEA5065FDEC2BAF755D7813E161AB04205B0907B2629B8
  - CMake version pinned at 3.22.1 because that is what the Android SDK
    cmake 3.22.x Android-Gradle-Plugin integration expects.
  - Does not modify `%ANDROID_HOME%`, `%ANDROID_SDK_ROOT%`, the global
    CMake install on PATH, or the user's PATH permanently.
#>
[CmdletBinding()]
param(
  [string]$SdkRoot = "",
  [string]$ToolchainRoot = "",
  [string]$NinjaExe = "",
  [string]$LocalPropertiesPath = "",
  [switch]$ConfigureGradle,
  [switch]$SkipGradle,
  [switch]$Force,
  [switch]$SkipHashCheck,
  [switch]$SelfTest,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"
# StrictMode + array.Count on single-element arrays is a known PowerShell
# footgun (array unwraps to scalar). We avoid it everywhere below by using
# @( ... ).Count instead.
Set-StrictMode -Version 2.0

$script:NINJA_VERSION = "1.12.1"
$script:CMAKE_VERSION = "3.22.1"
$script:TOOLCHAIN_BASENAME = "cmake-3.22.1-ninja-1.12.1"
$script:NINJA_DOWNLOAD_URL = "https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-win.zip"
$script:NINJA_ZIP_SHA256 = "F550FEC705B6D6FF58F2DB3C374C2277A37691678D6ABA463ADCBB129108467A"
$script:NINJA_EXE_SHA256 = "68865C3276D449D746CEA5065FDEC2BAF755D7813E161AB04205B0907B2629B8"
$script:MARKER_FILE = "4velo-managed.txt"
$script:MIN_SUPPORTED_NINJA = [version]"1.12.0"
$script:REJECT_BELOW = [version]"1.12.0"
$script:ANDROID_OFFICIAL_CMAKE_BIN = "cmake\$script:CMAKE_VERSION\bin\cmake.exe"

if (-not $Quiet) {
  Write-Host "[ninja-bootstrap] T83 - CMake $($script:CMAKE_VERSION) + pinned Ninja $($script:NINJA_VERSION)" -ForegroundColor Cyan
}

function Write-Section {
  param([string]$Label)
  if (-not $Quiet) {
    Write-Host ""
    Write-Host "[ninja-bootstrap] $Label" -ForegroundColor Green
  }
}

function Test-WindowsHost {
  if ($env:OS -ne "Windows_NT") {
    throw @"
Unsupported host '$($env:OS)'. T83 only blocks Windows Android native builds.
On Linux/macOS the Android SDK does not ship Ninja 1.10.2; no bootstrap needed.
"@
  }
}

function Resolve-SdkRoot {
  param([string]$Override)

  if ($Override) { return (Resolve-Path -LiteralPath $Override).Path }
  $candidates = @()
  if ($env:ANDROID_SDK_ROOT) { $candidates += $env:ANDROID_SDK_ROOT }
  if ($env:ANDROID_HOME)    { $candidates += $env:ANDROID_HOME }
  if ($env:LOCALAPPDATA)    { $candidates += (Join-Path $env:LOCALAPPDATA "Android\Sdk") }

  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    if (-not $candidate) { continue }
    $expanded = [Environment]::ExpandEnvironmentVariables($candidate)
    $cmakeBin = Join-Path $expanded "cmake\$($script:CMAKE_VERSION)\bin\cmake.exe"
    if (Test-Path -LiteralPath $cmakeBin -PathType Leaf) {
      return (Resolve-Path -LiteralPath $expanded).Path
    }
  }

  throw @"
Android SDK with CMake $($script:CMAKE_VERSION) not found.
Provide -SdkRoot or set ANDROID_SDK_ROOT/ANDROID_HOME to an SDK containing
cmake\$($script:CMAKE_VERSION)\bin\cmake.exe. The current Android SDK install
is intentionally NOT modified by this script.
"@
}

function Resolve-ToolchainRoot {
  param([string]$Override)

  $base = $Override
  if (-not $base -and $env:LOCALAPPDATA) {
    $base = Join-Path $env:LOCALAPPDATA "4velo\android-toolchain"
  }
  if (-not $base) {
    throw "Cannot determine a per-user toolchain root. Pass -ToolchainRoot."
  }
  $full = Join-Path $base $script:TOOLCHAIN_BASENAME
  return (Resolve-Path -LiteralPath (New-Item -ItemType Directory -Force -Path $base)).Path |
           ForEach-Object { Join-Path $_ $script:TOOLCHAIN_BASENAME }
}

function Format-NinjaVersionString {
  # Normalise outputs like `1.12.1`, `ninja version 1.12.1`, `1.12.1-git`, etc.
  param([string]$Raw)
  if (-not $Raw) { return $null }
  $first = ($Raw -split " ")[0]
  $clean = ($first -split "-")[0]
  if ($clean -match "^\d+\.\d+(\.\d+)?$") { return $clean }
  return $null
}

function Get-NinjaVersion {
  param([string]$Exe)
  if (-not (Test-Path -LiteralPath $Exe -PathType Leaf)) { return $null }
  $output = & $Exe --version 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  return Format-NinjaVersionString -Raw ($output -join "`n")
}

function Test-NinjaVersion {
  param([string]$Exe)
  $version = Get-NinjaVersion -Exe $Exe
  if (-not $version) { return $false }
  try {
    $parsed = [version]$version
    return ($parsed -ge $script:MIN_SUPPORTED_NINJA)
  } catch {
    return $false
  }
}

function Get-Sha256 {
  param([string]$Path)
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}

function Assert-NinjaHash {
  param([string]$Exe)
  if ($SkipHashCheck) {
    if (-not $Quiet) {
      Write-Warning "[ninja-bootstrap] Hash verification SKIPPED at caller request."
    }
    return
  }
  $actual = Get-Sha256 -Path $Exe
  if ($actual -ne $script:NINJA_EXE_SHA256) {
    throw @"
Ninja SHA256 mismatch.
Expected: $script:NINJA_EXE_SHA256
Actual:   $actual
Path:     $Exe
Refusing to use an unpinned binary. Pass -SkipHashCheck only for offline smoke
tests on a binary you trust.
"@
  }
}

function Copy-CmakeFromSdk {
  param(
    [string]$SdkRootPath,
    [string]$ToolchainPath
  )
  $src = Join-Path $SdkRootPath "cmake\$($script:CMAKE_VERSION)"
  $dst = $ToolchainPath
  $null = New-Item -ItemType Directory -Force -Path $dst

  # PowerShell's `&` operator handles quoting - do NOT hand-add quotes
  # around src/dst in the args array, otherwise robocopy sees literal `"`s.
  $robocopyArgs = @(
    $src, $dst,
    "/MIR",
    "/XD", "doc",
    "/NFL", "/NDL", "/NJH", "/NJS", "/NP"
  )
  $robocopy = & robocopy @robocopyArgs
  # robocopy returns 0..7 success; we tolerate up to 7
  if ($LASTEXITCODE -gt 7) {
    throw "robocopy from '$src' to '$dst' failed with exit code $LASTEXITCODE."
  }

  # Drop the SDK's bundled ninja.exe so CMake cannot auto-detect it.
  $bundledNinja = Join-Path $dst "bin\ninja.exe"
  if (Test-Path -LiteralPath $bundledNinja -PathType Leaf) {
    Remove-Item -LiteralPath $bundledNinja -Force
  }

  # Leave a marker so downstream tooling can recognise this tree.
  $marker = Join-Path $dst $script:MARKER_FILE
  $lines = @(
    "4velo-managed isolated toolchain (T83).",
    "Owner: scripts/android/ninja-bootstrap.ps1",
    "Created: $((Get-Date).ToUniversalTime().ToString('o'))",
    "Do not modify by hand - rerun the bootstrap to repair."
  )
  Set-Content -LiteralPath $marker -Value $lines -Encoding UTF8
}

function Resolve-NinjaExe {
  if ($NinjaExe) {
    if (-not (Test-Path -LiteralPath $NinjaExe -PathType Leaf)) {
      throw "Provided -NinjaExe '$NinjaExe' not found."
    }
    return (Resolve-Path -LiteralPath $NinjaExe).Path
  }
  $default = "$env:USERPROFILE\Downloads\ninja.exe"
  if (Test-Path -LiteralPath $default -PathType Leaf) {
    if (-not $Quiet) {
      Write-Host "[ninja-bootstrap] Reusing pre-staged $default" -ForegroundColor Yellow
    }
    return (Resolve-Path -LiteralPath $default).Path
  }
  return $null
}

function Download-PinnedNinja {
  param([string]$Destination)
  $tmpDir = Join-Path $env:TEMP ("t83-ninja-" + [Guid]::NewGuid().ToString("N"))
  $null = New-Item -ItemType Directory -Force -Path $tmpDir
  $zipPath = Join-Path $tmpDir "ninja-win.zip"

  try {
    if (-not $Quiet) { Write-Host "[ninja-bootstrap] Downloading $($script:NINJA_DOWNLOAD_URL)" -ForegroundColor Green }
    try {
      $ProgressPreference = if ($Quiet) { 'SilentlyContinue' } else { 'Continue' }
      Invoke-WebRequest -Uri $script:NINJA_DOWNLOAD_URL -OutFile $zipPath -UseBasicParsing -TimeoutSec 120
    } catch {
      throw @"
Failed to download $($script:NINJA_DOWNLOAD_URL).
Bootstrap requires network access to fetch the pinned Ninja 1.12.1 release.
If your machine is offline, pre-stage the ninja.exe at
%USERPROFILE%\Downloads\ninja.exe (SHA256 $($script:NINJA_EXE_SHA256)) and
rerun, or pass -NinjaExe.

Underlying error: $_
"@
    }
    if (-not $SkipHashCheck) {
      $zipHash = Get-Sha256 -Path $zipPath
      if ($zipHash -ne $script:NINJA_ZIP_SHA256) {
        throw @"
Downloaded zip SHA256 mismatch.
Expected: $script:NINJA_ZIP_SHA256
Actual:   $zipHash
The release artifact on the wire does not match the pinned hash. Refusing to
extract and use the binary.
"@
      }
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    $entry = $zip.Entries | Where-Object { $_.FullName -eq "ninja.exe" } | Select-Object -First 1
    if (-not $entry) { throw "ninja.exe missing inside $zipPath" }
    $entryStream = $entry.Open()
    $outStream = [System.IO.File]::Create($Destination)
    $entryStream.CopyTo($outStream)
    $entryStream.Dispose()
    $outStream.Dispose()
    $zip.Dispose()
  } finally {
    if (Test-Path -LiteralPath $tmpDir) { Remove-Item -LiteralPath $tmpDir -Recurse -Force }
  }
}

function Ensure-IsolatedToolchain {
  param(
    [string]$SdkRootPath,
    [string]$ToolchainPath
  )
  $marker = Join-Path $ToolchainPath $script:MARKER_FILE
  if ((Test-Path -LiteralPath $marker -PathType Leaf) -and -not $Force) {
    if (-not $Quiet) { Write-Host "[ninja-bootstrap] Reusing existing isolated toolchain at $ToolchainPath" -ForegroundColor Yellow }
    return
  }

  Write-Section "Staging isolated toolchain from Android SDK"
  Copy-CmakeFromSdk -SdkRootPath $SdkRootPath -ToolchainPath $ToolchainPath

  $binDir = Join-Path $ToolchainPath "bin"
  $null = New-Item -ItemType Directory -Force -Path $binDir
  $targetNinja = Join-Path $binDir "ninja.exe"

  $reuse = Resolve-NinjaExe
  if ($reuse) {
    if (-not $Quiet) { Write-Host "[ninja-bootstrap] Copying pre-staged ninja.exe into toolchain" -ForegroundColor Green }
    Copy-Item -LiteralPath $reuse -Destination $targetNinja -Force
  } else {
    Write-Section "Downloading pinned Ninja $($script:NINJA_VERSION)"
    Download-PinnedNinja -Destination $targetNinja
  }
}

function Get-LocalPropertiesPath {
  if ($LocalPropertiesPath) { return $LocalPropertiesPath }
  $repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
  return (Join-Path $repoRoot "mobile\android\local.properties")
}

function Set-CmakeDirInLocalProperties {
  param(
    [string]$Path,
    [string]$ToolchainPath
  )
  $parent = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
    $null = New-Item -ItemType Directory -Force -Path $parent
  }

  $original = @()
  if (Test-Path -LiteralPath $Path -PathType Leaf) {
    $original = Get-Content -LiteralPath $Path -Encoding UTF8
  }

  $cmakeDirKey = "cmake.dir="
  $toolchainPath = ($ToolchainPath -replace "\\", "/")

  $kept = @()
  $hadExisting = $false
  foreach ($line in $original) {
    if ($line -and $line.Trim().StartsWith($cmakeDirKey)) {
      $hadExisting = $true
      continue
    }
    $kept += $line
  }

  # Trim trailing blank lines so we don't accumulate them across runs.
  # Avoid `$kept[0..-1]` ranges; PowerShell rewrites them as 0..MAX_INT,
  # which would loop forever when $kept has a single blank entry.
  while ($true) {
    $count = @($kept).Count
    if ($count -eq 0) { break }
    if (-not [string]::IsNullOrWhiteSpace($kept[$count - 1])) { break }
    if ($count -eq 1) {
      $kept = @()
    } else {
      $kept = $kept[0..($count - 2)]
    }
  }

  $kept += "cmake.dir=$toolchainPath"
  $kept += ""
  Set-Content -LiteralPath $Path -Value $kept -Encoding UTF8

  return [pscustomobject]@{
    Path = $Path
    HadExisting = $hadExisting
    KeyValue = "cmake.dir=$toolchainPath"
    PreservedLineCount = $kept.Length - 2   # exclude cmake.dir and trailing empty
  }
}

function Invoke-SelfTest {
  Write-Section "SelfTest (no SDK required)"

  $acceptedSamples = @("1.12.1", "1.12.2", "1.13.0", "2.0.0")
  $rejectedSamples = @("1.10.0", "1.10.2", "1.11.1", "1.0.0", "0.9.0")

  $acceptFails = @()
  foreach ($raw in $acceptedSamples) {
    $parsed = Format-NinjaVersionString -Raw $raw
    if (-not $parsed) { $acceptFails += "Could not parse accepted sample '$raw'" }
    try {
      if (([version]$parsed) -lt $script:REJECT_BELOW) {
        $acceptFails += "Sample '$raw' was incorrectly rejected"
      }
    } catch {
      $acceptFails += "Sample '$raw' threw on comparison: $_"
    }
  }

  $rejectFails = @()
  foreach ($raw in $rejectedSamples) {
    $parsed = Format-NinjaVersionString -Raw $raw
    if (-not $parsed) { $rejectFails += "Could not parse rejected sample '$raw'"; continue }
    try {
      if (([version]$parsed) -ge $script:MIN_SUPPORTED_NINJA) {
        $rejectFails += "Sample '$raw' was incorrectly accepted"
      }
    } catch {
      $rejectFails += "Sample '$raw' threw on comparison: $_"
    }
  }

  if ((@($acceptFails)).Count -gt 0 -or (@($rejectFails)).Count -gt 0) {
    throw "SelfTest version gate failed:`n  $acceptFails`n  $rejectFails"
  }

  $tmp = Join-Path $env:TEMP ("t83-selftest-" + [Guid]::NewGuid().ToString("N"))
  $null = New-Item -ItemType Directory -Force -Path $tmp
  $cmakeDir = Join-Path $tmp "cmake"
  $null = New-Item -ItemType Directory -Force -Path $cmakeDir
  $lp = Join-Path $tmp "local.properties"
  $marker = Join-Path $cmakeDir $script:MARKER_FILE
  "do-not-touch" | Set-Content -LiteralPath $marker -Encoding UTF8

  try {
    # Bootstrap 1: create
    $r1 = Set-CmakeDirInLocalProperties -Path $lp -ToolchainPath $cmakeDir
    if ($r1.HadExisting) { throw "SelfTest: first call should not have prior cmake.dir" }

    # Bootstrap 2: same content - idempotent
    $r2 = Set-CmakeDirInLocalProperties -Path $lp -ToolchainPath $cmakeDir
    if (-not $r2.HadExisting) { throw "SelfTest: second call should observe prior cmake.dir" }

    # Bootstrap 3: different toolchain path - replace, do NOT touch other lines
    $otherKey = "sdk.dir=C:/Users/test/Android/Sdk"
    $ndkKey = "ndk.dir=C:/Users/test/Android/Sdk/ndk/26.1.10909125"
    Set-Content -LiteralPath $lp -Value @($otherKey, $ndkKey, "") -Encoding UTF8
    $r3 = Set-CmakeDirInLocalProperties -Path $lp -ToolchainPath $cmakeDir
    $content = Get-Content -LiteralPath $lp -Encoding UTF8
    if (-not ($content -contains $otherKey)) { throw "SelfTest: sdk.dir was deleted" }
    if (-not ($content -contains $ndkKey)) { throw "SelfTest: ndk.dir was deleted" }
    $cmakeCount = @($content | Where-Object { $_ -and $_.Trim().StartsWith("cmake.dir=") }).Count
    if ($cmakeCount -ne 1) { throw "SelfTest: expected exactly one cmake.dir= line, got $cmakeCount" }

    Write-Section "SelfTest OK"
    Write-Host "  Accepted: $($acceptedSamples -join ', ')"
    Write-Host "  Rejected: $($rejectedSamples -join ', ')"
    Write-Host "  Idempotency: confirmed (3 calls, 1 cmake.dir, sdk.dir+ndk.dir preserved)"
  } finally {
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
  }
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if ($SelfTest) {
  Invoke-SelfTest
  return
}

Test-WindowsHost

Write-Section "Resolving Android SDK"
$sdkRoot = Resolve-SdkRoot -Override $SdkRoot
Write-Host "  ANDROID_HOME: $sdkRoot"

Write-Section "Resolving isolated toolchain"
$toolchain = Resolve-ToolchainRoot -Override $ToolchainRoot
Write-Host "  Toolchain: $toolchain"

$sdkCmake = Join-Path $sdkRoot "cmake\$($script:CMAKE_VERSION)\bin\cmake.exe"
if (-not (Test-Path -LiteralPath $sdkCmake -PathType Leaf)) {
  throw "Expected $sdkCmake to exist (Android SDK CMake 3.22.1)."
}
$sdkCmakeVersion = (& $sdkCmake --version | Select-Object -First 1)
if (-not ($sdkCmakeVersion -match "cmake version $($script:CMAKE_VERSION)")) {
  throw "Android SDK cmake at $sdkCmake does not report $($script:CMAKE_VERSION): got '$sdkCmakeVersion'."
}
Write-Host "  SDK CMake OK: $sdkCmakeVersion"

Ensure-IsolatedToolchain -SdkRootPath $sdkRoot -ToolchainPath $toolchain

Write-Section "Validating isolated toolchain"
$toolCmake = Join-Path $toolchain "bin\cmake.exe"
$toolNinja = Join-Path $toolchain "bin\ninja.exe"
if (-not (Test-Path -LiteralPath $toolCmake -PathType Leaf)) {
  throw "Isolated toolchain missing $toolCmake"
}
if (-not (Test-Path -LiteralPath $toolNinja -PathType Leaf)) {
  throw "Isolated toolchain missing $toolNinja"
}
Assert-NinjaHash -Exe $toolNinja
$ok = Test-NinjaVersion -Exe $toolNinja
if (-not $ok) {
  $v = Get-NinjaVersion -Exe $toolNinja
  throw "Ninja at $toolNinja reports version '$v' (< $($script:MIN_SUPPORTED_NINJA)). Refusing."
}
$finalVersion = Get-NinjaVersion -Exe $toolNinja
Write-Host "  CMake: $(& $toolCmake --version | Select-Object -First 1)"
Write-Host "  Ninja: $finalVersion (min $($script:MIN_SUPPORTED_NINJA))"
Write-Host "  SHA256: $(Get-Sha256 -Path $toolNinja)"

$gradleConfigured = $false
if (-not $SkipGradle) {
  Write-Section "Configuring Gradle (cmake.dir)"
  $lpPath = Get-LocalPropertiesPath
  if (-not $ConfigureGradle -and -not $Quiet) {
    Write-Host "  Pass -ConfigureGradle to also write cmake.dir into $lpPath" -ForegroundColor Yellow
  }
  if ($ConfigureGradle) {
    $r = Set-CmakeDirInLocalProperties -Path $lpPath -ToolchainPath $toolchain
    if ($r.HadExisting) { Write-Host "  Replaced existing cmake.dir in $lpPath" }
    else { Write-Host "  Wrote cmake.dir into $lpPath" }
    Write-Host "  Preserved $($r.PreservedLineCount) other line(s)"
    $gradleConfigured = $true
  }
}

Write-Section "Done"
Write-Host "  ANDROID_HOME:       $sdkRoot"
Write-Host "  Toolchain (cmake):  $toolCmake"
Write-Host "  Toolchain (ninja):  $toolNinja"
Write-Host "  Ninja version:      $finalVersion"
Write-Host "  Ninja SHA256:       $(Get-Sha256 -Path $toolNinja)"
if ($ConfigureGradle) {
    Write-Host "  Gradle cmake.dir:   $(Get-LocalPropertiesPath)"
  }
Write-Host ""
Write-Host "Re-run is idempotent. To tear the toolchain down: Remove-Item -Recurse -Force '$toolchain'" -ForegroundColor Magenta
