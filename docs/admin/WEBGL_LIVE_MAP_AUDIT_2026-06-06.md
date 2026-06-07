# Live Map — WebGL audit (snapshot 2026-06-06)


| | |
|--|--|
| **Status** | Snapshot |
| **Owner role** | QA / Admin Lead |
| **Last reviewed** | 2026-06-07 |
| **Audience** | Platform Operator, frontend (Live Map) |
| **Environment** | `https://admin-production-083b.up.railway.app` (prod) |
| **Script** | `admin/scripts/audit-webgl-live-map.mjs` |
| **Raw JSON** | [reports/webgl-audit-report-2026-06-06.json](./reports/webgl-audit-report-2026-06-06.json) |
| **E2E reference** | [reports/webgl-e2e-audit-2026-06-05.json](./reports/webgl-e2e-audit-2026-06-05.json) |

---

## Cel

Weryfikacja renderowania warstw Live Map (meso klastry, mikro ikony) w różnych profilach WebGL Chromium (ANGLE headless/headed) na produkcji.

Powiązane: [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) § Live Map · [operations/LIVE_MAP.md](../operations/LIVE_MAP.md)

---

## Podsumowanie (2026-06-06 prod audit)

| Profil | WebGL1 | Renderer | Meso / micro | Wynik |
|--------|--------|----------|--------------|-------|
| `prod-headless-angle` | tak | ANGLE (NVIDIA RTX 2070 SUPER) | timeout 120s (`waitForFunction`) | **FAIL** — brak pełnego audytu warstw |
| `prod-headed-angle` | tak | ANGLE (NVIDIA RTX 2070 SUPER) | timeout 60s (`live-map-city-ranking`) | **FAIL** — panel rankingu miast niewidoczny |

**WebGL context:** oba profile uzyskały WebGL1; WebGL2 = false (typowe dla ANGLE w Playwright).

**Bloker prod (2026-06-06):** skrypt nie doszedł do pomiaru `sourceTotal` vs `renderedTotal` — timeout na oczekiwaniu na ranking miast / map ready. Prawdopodobne przyczyny: brak aktywnego symulatora, wolny cold start mapy, lub zmiana UI (`data-testid="live-map-city-ranking"`).

---

## E2E lokalny (referencja 2026-06-05)

Plik [webgl-e2e-audit-2026-06-05.json](./reports/webgl-e2e-audit-2026-06-05.json) — udany przebieg z mock telemetry:

| Tier | zoom | sourceTotal | renderedTotal | renderedPoints |
|------|------|-------------|---------------|----------------|
| meso | 10 | 4 | 2 | 0 |
| micro | 13.5 | 111 | 111 | 111 |

Warstwy `live-clusters`, `live-rider-icons` — **visible**. `canvasColoredPixels: 0` (headless sampling — znany artefakt; nie blokuje PASS L4 gdy `renderedPoints` > 0).

---

## Jak powtórzyć

```bash
cd admin
# Lokalnie (mock API + E2E bridge):
npm run dev   # lub E2E_FORCE_WEB_SERVER=1
node scripts/audit-webgl-live-map.mjs

# Prod (wymaga ADMIN_PASS, bez commitowania do repo):
ADMIN_PASS='<secret>' node scripts/audit-webgl-live-map.mjs --prod
```

Artefakty robocze: `admin/audit-screenshots/` (gitignored / nie commitować). **Snapshot do docs:** kopiuj JSON tutaj jako `reports/webgl-audit-report-YYYY-MM-DD.json` + ten plik `.md`.

Playwright E2E: `npx playwright test e2e/webgl-audit.spec.ts --project=live-map-zoom`

---

## Kryteria PASS (P0 § Live Map)

| # | Kryterium |
|---|-----------|
| L1 | Login → Live Map, `data-map-ready=true` |
| L2 | Badge sync Live/cached + `in view` > 0 przy aktywnym sim |
| L3 | Zoom meso — klastry; mikro — ikony rowerzystów |
| L4 | `renderedPoints` > 0 w mikro (JSON audit) |

**Status 2026-06-06 prod:** L1–L4 **niezweryfikowane** (timeout). Po naprawie cold start / sim ON — ponów audyt i zaktualizuj nowym plikiem datowanym.

---

## Migracje po deploy (MFA + GPX F2)

Backend `Dockerfile` CMD uruchamia `python manage.py migrate --no-input` przy każdym starcie kontenera. Po push `3f146e05` wystarczy **redeploy serwisu backend** na Railway (`marvelous-gratitude` / production):

- `users.0018_user_mfa_fields`
- `activities.0030_activity_gpx_archive_fields`

Lokalnie `railway run` na Windows wymaga GDAL — użyj redeploy lub `railway ssh` (wymaga klucza SSH).
