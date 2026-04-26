# SPORT Environment Bootstrap Script
# Ten skrypt przygotowuje nowy komputer do pracy nad platformą SPORT w 15 minut.

Write-Host "🛡️ Inicjalizacja odzyskiwania środowiska SPORT..." -ForegroundColor Cyan

# 1. Instalacja narzędzi przez Winget
Write-Host "📦 Instalacja narzędzi systemowych..." -ForegroundColor Yellow
$tools = @(
    "Google.ContainerTools.Skaffold",
    "Kubernetes.kubectl",
    "Kubernetes.kind",
    "RedHat.Podman-Desktop"
)

# 1.1 Narzędzia AI i Subagenty
Write-Host "🤖 Instalacja geminicli..." -ForegroundColor Magenta
# Instalacja globalna narzędzia do współpracy z AI
npm install -g geminicli

foreach ($tool in $tools) {
    Write-Host "Installing $tool..."
    winget install $tool --accept-package-agreements --accept-source-agreements --silent
}

# 2. Tworzenie mostu "Fake Docker" (dla kompatybilności)
Write-Host "🎭 Tworzenie mostu Docker-Podman..." -ForegroundColor Yellow
$binDir = Join-Path $PSScriptRoot "bin"
if (!(Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir }
"@echo off`npodman %*" | Out-File -FilePath (Join-Path $binDir "docker.cmd") -Encoding ASCII

# 3. Informacja o klastrze
Write-Host "☸️ Środowisko gotowe!" -ForegroundColor Green
Write-Host "Kolejne kroki:" -ForegroundColor White
Write-Host "1. Uruchom Podman Desktop i upewnij się, że maszyna 'podman-machine-default' działa."
Write-Host "2. Uruchom: kind create cluster --name kind-cluster"
Write-Host "3. Uruchom: .\dev.ps1 aby wystartować platformę."
