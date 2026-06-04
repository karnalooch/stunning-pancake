# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | en |
| **translation** | [Polski](../../onboarding/GUIDE.md) |
| **canonical_path** | docs/en/onboarding/GUIDE.md |
---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Developer onboarding |
| **Last reviewed** | 2026-06-03 |
| **Audience** | New developers, tenant ops |

**Index:** [docs/README.md](../README.md)

## 1. Development Environment Setup
The platform uses containerization to ensure consistency between environments.

### Requirements:
- Docker + Docker Compose.
- Python 3.12+, Node.js 20+.
- PowerShell (to the `dev.ps1` script).

### Quick Start:```powershell
# 1. Przygotowanie środowiska
.\setup-environment.ps1

# 2. Uruchomienie stosu deweloperskiego
.\dev.ps1
```Optional: load simulator - [operations/SIMULATOR.md](../operations/SIMULATOR.md).

## 2. User Onboarding (Wizard Flow)
The mobile application guides the user through a 7-step inception process:
1. **Splash**: 60 FPS animation (HD-2D).
2. **Permissions**: GPS (Always), Motion, Bluetooth.
3. **Integrations**: Strava/Garmin OAuth.
4. **Biometrics**: Height, weight, gender (Auto-sync or Manual).
5. **Anti-Cheat**: Calibration and acceptance of fairness principles.
6. **Legal**: Acceptance of GDPR and Regulations.
7. **Identity**: Generate Athlete QR Identity.

## 3. New Tenant Onboarding Process (Tenant)
1. Creating a record in the `Tenant` table (Owner Panel).
2. Branding configuration (Primary Color, Logo URL).
3. Automatic generation of a subdomain (e.g. `city.sportapp.pl`).
4. Start RLS for the new tenant ID.
