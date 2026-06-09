#Requires -Version 5.1
<#
.SYNOPSIS
  Set Railway CLI token in Windows User environment.

  Project token (Project Settings -> Tokens): use -Scope Project -> RAILWAY_TOKEN
  Account token (Account Settings -> Tokens, No workspace): use -Scope Account -> RAILWAY_API_TOKEN

.EXAMPLE
  .\scripts\set-railway-token.ps1 -Token "..." -Scope Project
  .\scripts\set-railway-token.ps1 -Token "..." -Scope Account
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Token,
    [ValidateSet('Project', 'Account')]
    [string]$Scope = 'Project'
)

$ErrorActionPreference = 'Stop'
$Token = $Token.Trim()
if (-not $Token -or $Token -in @('TWÓJ_TOKEN', '<twój-token>', '<token>')) {
    throw 'Podaj prawdziwy token z Railway Dashboard'
}

$env:CI = 'true'
if ($Scope -eq 'Project') {
    [Environment]::SetEnvironmentVariable('RAILWAY_TOKEN', $Token, 'User')
    [Environment]::SetEnvironmentVariable('RAILWAY_API_TOKEN', $null, 'User')
    $env:RAILWAY_TOKEN = $Token
    Remove-Item Env:RAILWAY_API_TOKEN -ErrorAction SilentlyContinue
    Write-Host "RAILWAY_TOKEN ustawiony (project scope, dlugosc $($Token.Length))" -ForegroundColor Green
    Write-Host 'Weryfikacja: railway logs -p <project-id> -s backend --lines 5' -ForegroundColor DarkGray
} else {
    [Environment]::SetEnvironmentVariable('RAILWAY_API_TOKEN', $Token, 'User')
    [Environment]::SetEnvironmentVariable('RAILWAY_TOKEN', $null, 'User')
    $env:RAILWAY_API_TOKEN = $Token
    Remove-Item Env:RAILWAY_TOKEN -ErrorAction SilentlyContinue
    Write-Host "RAILWAY_API_TOKEN ustawiony (account scope, dlugosc $($Token.Length))" -ForegroundColor Green
    & railway whoami 2>&1
}
