# Shared ApiBase resolution for sim-lab scripts (dot-source only).
function Resolve-SimLabApiBase {
    param(
        [string]$ApiBase,
        [switch]$AllowProdFallback
    )
    if ($ApiBase) { return $ApiBase.TrimEnd('/') }

    if ($env:SIM_LAB_API_BASE) {
        return $env:SIM_LAB_API_BASE.TrimEnd('/')
    }

    $prodDefault = "https://backend-production-55c7.up.railway.app/api"
    if ($AllowProdFallback -or $env:ALLOW_PROD_LOAD_TEST -eq '1') {
        return $prodDefault
    }

    $local = "http://localhost:8000/api"
    if ($env:SIM_LAB_PREFER_LOCAL -eq '1') {
        return $local
    }

    throw @"
Sim-lab API base not set. Use one of:
  `$env:SIM_LAB_API_BASE = 'https://your-sim-lab-backend/api'
  -ApiBase parameter
  copy infrastructure/sim-lab/.env.sim-lab.example -> .env.sim-lab

Prod load tests require ALLOW_PROD_LOAD_TEST=1 explicitly.
"@
}

function Test-ProdApiGuard {
    param([string]$ApiBase)
    if ($ApiBase -match 'backend-production-55c7|marvelous-gratitude') {
        if ($env:ALLOW_PROD_LOAD_TEST -ne '1') {
            throw "Refusing prod API ($ApiBase). Set ALLOW_PROD_LOAD_TEST=1 only with Platform Operator approval."
        }
        Write-Warning "ALLOW_PROD_LOAD_TEST=1 - hitting production API."
    }
}
