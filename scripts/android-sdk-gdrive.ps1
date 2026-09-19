#Requires -Version 5.1
# Deprecated compatibility wrapper.
# Historical versions hard-coded G:\android-sdk and a specific JDK path.
# Use scripts/android-env.ps1 for environment-neutral resolution.

Write-Warning "android-sdk-gdrive.ps1 is deprecated; using android-env.ps1 instead."
. (Join-Path $PSScriptRoot "android-env.ps1")
