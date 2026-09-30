# Collect exact-SHA visual evidence from an already installed 4VELO Android runtime.
# This script does NOT build, prebuild, install dependencies, or compile an APK.
param(
    [string]$OutputRoot = "",
    [string]$MaestroBin = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Git {
    param([string[]]$Args)
    $output = & git -C $repoRoot @Args
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Args -join ' ') failed with exit code $LASTEXITCODE"
    }
    return ($output | Out-String).Trim()
}

$gitSha = Invoke-Git @("rev-parse", "HEAD")
$gitShort = $gitSha.Substring(0, 12)
$dirty = Invoke-Git @("status", "--porcelain")
if ($dirty) {
    throw "Visual proof requires a clean exact-SHA checkout. Commit/stash local changes first."
}

$branch = Invoke-Git @("branch", "--show-current")
if (-not $branch) { $branch = "DETACHED" }

if (-not $OutputRoot) {
    $OutputRoot = Join-Path $repoRoot "artifacts\mobile-visual-proof"
}
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path $OutputRoot "$gitShort-$timestamp"
$maestroDir = Join-Path $runDir "maestro"
$shotsDir = Join-Path $runDir "screenshots"
New-Item -ItemType Directory -Force -Path $maestroDir, $shotsDir | Out-Null

$runner = Join-Path $repoRoot "scripts\run-mobile-e2e.ps1"
$args = @{
    Flow = "visual-proof-ride.yaml"
    TestOutputDir = $maestroDir
}
if ($MaestroBin) {
    $args.MaestroBin = $MaestroBin
}

Write-Host "4VELO visual proof"
Write-Host "  source SHA: $gitSha"
Write-Host "  output:     $runDir"
Write-Host "  runtime:    already installed; no APK build"

& $runner @args
if ($LASTEXITCODE -ne 0) {
    throw "Maestro visual proof failed with exit code $LASTEXITCODE"
}

$expected = @(
    "01_today",
    "02_start",
    "03_active",
    "04_paused",
    "05_summary"
)

$evidence = @()
foreach ($name in $expected) {
    $matches = @(
        Get-ChildItem -Path $maestroDir -Recurse -File -Filter "$name.png" -ErrorAction SilentlyContinue
    )
    if ($matches.Count -ne 1) {
        throw "Expected exactly one Maestro screenshot '$name.png'; found $($matches.Count)."
    }

    $source = $matches[0].FullName
    $dest = Join-Path $shotsDir "$name.png"
    Copy-Item -Force $source $dest

    $file = Get-Item $dest
    $sha256 = (Get-FileHash -Algorithm SHA256 $dest).Hash.ToLowerInvariant()
    $evidence += [ordered]@{
        name = $name
        path = "screenshots/$name.png"
        sha256 = $sha256
        bytes = $file.Length
    }
}

$maestroManifest = Get-ChildItem -Path $maestroDir -Recurse -File -Filter "manifest.json" -ErrorAction SilentlyContinue |
    Select-Object -First 1

$manifest = [ordered]@{
    schemaVersion = 1
    evidenceType = "mobile-ride-visual-proof"
    sourceSha = $gitSha
    sourceShortSha = $gitShort
    sourceBranch = $branch
    sourceClean = $true
    capturedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    appId = "com.sport.athlete"
    flow = "mobile/.maestro/flows/visual-proof-ride.yaml"
    buildPerformed = $false
    expectedStates = $expected
    screenshots = $evidence
    maestroManifest = if ($maestroManifest) {
        [IO.Path]::GetRelativePath($runDir, $maestroManifest.FullName).Replace("\", "/")
    } else {
        $null
    }
}

$manifestPath = Join-Path $runDir "manifest.json"
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $manifestPath

Write-Host ""
Write-Host "Visual proof complete."
Write-Host "  manifest: $manifestPath"
Write-Host "  screenshots: $shotsDir"
