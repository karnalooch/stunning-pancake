# Android SDK configuration for 4velo vision parity harness
# Source this file before running the pipeline:
#   . G:\gem\stunning-pancake\scripts\android-sdk-gdrive.ps1
$env:ANDROID_HOME = "G:\android-sdk"
$env:ANDROID_SDK_ROOT = "G:\android-sdk"
$env:PATH = "G:\android-sdk\platform-tools;G:\android-sdk\emulator;G:\android-sdk\cmdline-tools\latest\bin;$env:PATH"

# Java 17 (Microsoft OpenJDK)
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"

# Vision fixtures for deterministic screenshots
$env:EXPO_PUBLIC_VISION_FIXTURES = "true"
$env:EXPO_PUBLIC_E2E_AUTO_LOGIN = "true"
$env:EXPO_PUBLIC_E2E_SKIP_ONBOARDING = "false"

Write-Host "[android-sdk-gdrive] Configured:" -ForegroundColor Green
Write-Host "  ANDROID_HOME:    $env:ANDROID_HOME"
Write-Host "  JAVA_HOME:       $env:JAVA_HOME"
Write-Host "  ADB:             $(if(Test-Path "$env:ANDROID_HOME\platform-tools\adb.exe"){'Ready'}else{'MISSING'})"
Write-Host "  Emulator:        $(if(Test-Path "$env:ANDROID_HOME\emulator\emulator.exe"){'Ready'}else{'MISSING'})"
Write-Host "  VISION_FIXTURES: $env:EXPO_PUBLIC_VISION_FIXTURES"
