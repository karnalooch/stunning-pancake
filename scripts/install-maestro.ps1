# Installs Maestro CLI to %USERPROFILE%\.maestro (Windows).
# Requires Java 17+ (Maestro runtime).
param(
    [string]$InstallDir = "$env:USERPROFILE\.maestro",
    [string]$Version = "cli-2.6.0"
)

$ErrorActionPreference = "Stop"

function Test-Java17Plus {
    try {
        $raw = (cmd /c "java -version 2>&1") | Out-String
        if ($raw -match 'version "(\d+)') {
            return [int]$Matches[1] -ge 17
        }
        if ($raw -match 'version (\d+)') {
            return [int]$Matches[1] -ge 17
        }
    } catch {
        return $false
    }
    return $false
}

if (-not (Test-Java17Plus)) {
    Write-Error "Java 17+ is required. Install JDK 17+ and ensure 'java' is on PATH."
}

$zipUrl = "https://github.com/mobile-dev-inc/Maestro/releases/download/$Version/maestro.zip"
$zipPath = Join-Path $env:TEMP "maestro.zip"
$markerFile = Join-Path $InstallDir "install-path.txt"

function Get-MaestroBinDir([string]$Root) {
    $candidates = @(
        (Join-Path $Root "bin"),
        (Join-Path $Root "maestro\bin")
    )
    foreach ($dir in $candidates) {
        if (Test-Path (Join-Path $dir "maestro.bat")) {
            return $dir
        }
    }
    return $null
}

if (Test-Path $markerFile) {
    $binDir = Get-Content $markerFile -Raw
    $maestroExe = Join-Path $binDir.Trim() "maestro.bat"
    if (Test-Path $maestroExe) {
        Write-Host "Maestro already installed at $maestroExe"
        & $maestroExe --version
        exit 0
    }
}

Write-Host "Downloading Maestro $Version..."
Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing

Write-Host "Extracting to $InstallDir..."
if (Test-Path $InstallDir) {
    Remove-Item -Recurse -Force $InstallDir
}
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Expand-Archive -Path $zipPath -DestinationPath $InstallDir -Force
Remove-Item $zipPath -Force

$binDir = Get-MaestroBinDir $InstallDir
if (-not $binDir) {
    Write-Error "Maestro binary not found under $InstallDir after extraction."
}
$maestroExe = Join-Path $binDir "maestro.bat"
Set-Content -Path $markerFile -Value $binDir -NoNewline

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$binDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$binDir", "User")
    $env:Path = "$env:Path;$binDir"
    Write-Host "Added $binDir to user PATH. Restart terminal if 'maestro' is not found."
}

& $maestroExe --version
Write-Host "Maestro installed successfully."
