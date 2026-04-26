# Implementation Plan: Security Patching & Vulnerability Resolution (v2.3-HARDENING)

## 🎯 Goal
Resolve 82 vulnerabilities (Security Baseline) reported by GitHub Dependabot and identified via local Gemini CLI audits across all project modules.

## 🛠️ Step-by-Step Execution

### Phase 1: Backend & Telemetry (Python)
1. **Backend Update**: Upgrade Django and Pillow in `backend/requirements.txt`.
   - `django==4.2.19` → `django==4.2.22`
   - `Pillow==12.2.0` → `Pillow==11.1.0` (Downgrade to known safe if 12.2.0 is somehow flagged, or upgrade to fix).
2. **Telemetry Update**: Upgrade `python-dotenv` and `starlette` in `telemetry/requirements.txt`.
   - `python-dotenv==1.0.1` → `python-dotenv==1.2.2`

### Phase 2: Admin Panel (Electron/Vite)
1. **Dependency Update**: Upgrade Electron and tar-related packages.
   - `electron==^33.4.11` → `electron==^41.3.0`
   - `electron-builder==^25.1.8` → `electron-builder==^26.8.1`
2. **Re-installation**: Run `npm install` in `admin/` to update `package-lock.json`.

### Phase 3: Mobile App (Expo/RN)
1. **Dependency Update**: Upgrade `eas-cli`, `xmldom`, `node-forge`.
   - `eas-cli==^18.8.1` → `eas-cli==^18.10.0`
   - Add `overrides` in `package.json` for `node-forge` and `xmldom`.
2. **Re-installation**: Run `npm install` in `mobile/`.

### Phase 4: Validation
1. **Audit**: Run `npm audit` and `pip-audit` again.
2. **MILESTONE**: Close Milestone `v2.3-HARDENING`.
