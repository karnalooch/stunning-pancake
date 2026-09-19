#Requires -Version 5.1
<#
.SYNOPSIS
  Resolve a usable Android SDK/JDK for 4VELO local mobile tooling.

.DESCRIPTION
  Environment-neutral replacement for the historical G:-drive helper.
  Resolution order for Android SDK:
    1. -SdkRoot
    2. ANDROID_SDK_ROOT
    3. ANDROID_HOME
    4. %LOCALAPPDATA%\Android\Sdk

  Resolution order for Java:
    1. -JavaHome
    2. existing JAVA_HOME when it contains bin\java.exe
    3. java.exe already on PATH
    4. Android Studio bundled JBR

  The script mutates only the current PowerShell process environment.
  It does not modify HKCU/HKLM, install SDK packages, or persist PATH changes.
#>

param(
  [string]$SdkRoot = "",
  [string]$JavaHome = ""
)

$ErrorActionPreference = "Stop"

function Resolve-AndroidSdkRoot {
  param([string]$Override)

  $candidates = @()
  if ($Override) { $candidates += $Override }
  if ($env:ANDROID_SDK_ROOT) { $candidates += $env:ANDROID_SDK_ROOT }
  if ($env:ANDROID_HOME) { $candidates += $env:ANDROID_HOME }
  if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA "Android\Sdk") }

  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    if (-not $candidate) { continue }
    $resolved = [Environment]::ExpandEnvironmentVariables($candidate)
    $adb = Join-Path $resolved "platform-tools\adb.exe"
    if (Test-Path $adb -PathType Leaf) {
      return (Resolve-Path $resolved).Path
    }
  }

  throw @"
Android SDK not found.
Provide -SdkRoot or set ANDROID_SDK_ROOT/ANDROID_HOME to an SDK containing platform-tools\adb.exe.
"@
}

function Resolve-JavaHome {
  param([string]$Override)

  $candidates = @()
  if ($Override) { $candidates += $Override }
  if ($env:JAVA_HOME) { $candidates += $env:JAVA_HOME }
  if ($env:ProgramFiles) {
    $candidates += (Join-Path $env:ProgramFiles "Android\Android Studio\jbr")
  }

  foreach ($candidate in ($candidates | Select-Object -Unique)) {
    if (-not $candidate) { continue }
    $expanded = [Environment]::ExpandEnvironmentVariables($candidate)
    if (Test-Path (Join-Path $expanded "bin\java.exe") -PathType Leaf) {
      return (Resolve-Path $expanded).Path
    }
  }

  $java = Get-Command java -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($java -and $java.Source) {
    $bin = Split-Path $java.Source -Parent
    $home = Split-Path $bin -Parent
    if (Test-Path (Join-Path $home "bin\java.exe") -PathType Leaf) {
      return $home
    }
  }

  throw @"
Java/JDK not found.
Provide -JavaHome, set JAVA_HOME, install Android Studio JBR, or place java.exe on PATH.
"@
}

function Add-PathEntry {
  param([string]$Entry)
  if (-not $Entry -or -not (Test-Path $Entry)) { return }
  $entries = @($env:PATH -split ';')
  if ($entries -notcontains $Entry) {
    $env:PATH = "$Entry;$env:PATH"
  }
}

$resolvedSdk = Resolve-AndroidSdkRoot -Override $SdkRoot
$resolvedJava = Resolve-JavaHome -Override $JavaHome

$env:ANDROID_HOME = $resolvedSdk
$env:ANDROID_SDK_ROOT = $resolvedSdk
$env:JAVA_HOME = $resolvedJava

Add-PathEntry (Join-Path $resolvedSdk "platform-tools")
Add-PathEntry (Join-Path $resolvedSdk "emulator")
Add-PathEntry (Join-Path $resolvedSdk "cmdline-tools\latest\bin")
Add-PathEntry (Join-Path $resolvedJava "bin")

$adbPath = Join-Path $resolvedSdk "platform-tools\adb.exe"
$emulatorPath = Join-Path $resolvedSdk "emulator\emulator.exe"
$sdkManagerPath = Join-Path $resolvedSdk "cmdline-tools\latest\bin\sdkmanager.bat"

Write-Host "[android-env] Current-session environment:" -ForegroundColor Green
Write-Host "  ANDROID_HOME:     $env:ANDROID_HOME"
Write-Host "  ANDROID_SDK_ROOT: $env:ANDROID_SDK_ROOT"
Write-Host "  JAVA_HOME:        $env:JAVA_HOME"
Write-Host "  ADB:              $(if(Test-Path $adbPath){$adbPath}else{'MISSING'})"
Write-Host "  Emulator:         $(if(Test-Path $emulatorPath){$emulatorPath}else{'MISSING'})"
Write-Host "  sdkmanager:       $(if(Test-Path $sdkManagerPath){$sdkManagerPath}else{'MISSING'})"
