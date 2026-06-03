# Railway production checklist — marvelous-gratitude

| | |
|--|--|
| **Status** | ✅ Active |
| **Ostatnia aktualizacja** | 2026-06-03 |
| **Cel** | Zweryfikować konfigurację produkcyjną workerów Celery (simulation + routing) przed load testem lub po deploy. |
| **Audience** | Platform Operator |
| **SSOT pamięć / caps** | [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) |
| **Macierz runbooków** | [OPERATIONS_INDEX.md](./OPERATIONS_INDEX.md) |

---

## Wymagania wstępne

| Wymaganie | Uwagi |
|-----------|--------|
| Railway CLI | `npm i -g @railway/cli` |
| `RAILWAY_API_TOKEN` | Windows **User** environment (Cursor/agent po restarcie IDE). **Nie** commituj. Usuń legacy `RAILWAY_TOKEN`. |
| Projekt | `marvelous-gratitude` / `production` |
| Opcjonalnie lokalnie | `.env.railway.local.example` → `.env.railway.local` (gitignored) |

---

## Procedura

### 1. Przygotowanie CLI (Platform Operator)

1. Upewnij się, że `RAILWAY_API_TOKEN` jest w User env (nie w repo).
2. Z katalogu repo:
   ```powershell
   railway link --project marvelous-gratitude --environment production
   ```

### 2. Weryfikacja automatyczna (Platform Operator)

1. Uruchom:
   ```powershell
   .\scripts\railway-verify-production.ps1
   ```
2. **PASS:** komunikat `PASS: all checks`.
3. Skrypt sprawdza m.in.:
   - obecność `RAILWAY_API_TOKEN` (bez drukowania wartości),
   - repo `karnalooch/stunning-pancake` na `celery-worker-routing` i `celery-worker-simulation`,
   - zmienne z `railway.json` (kolejki, `solo`, `SCALE_SIM_ASYNC_ROUTING`),
   - logi routing — **brak** Expo/Metro,
   - opcjonalnie GraphQL: `dockerfilePath`, `railwayConfigFile`, `source.repo` dla routing.

### 3. Serwisy — źródło prawdy (Platform Operator)

| Serwis | Repo | Dockerfile | Config as code |
|--------|------|------------|----------------|
| `celery-worker-simulation` | `karnalooch/stunning-pancake` | `/celery-worker-simulation/Dockerfile` | `celery-worker-simulation/railway.json` |
| `celery-worker-routing` | **ten sam repo** | **ten sam Dockerfile** | `celery-worker-routing/railway.json` |
| `celery-worker` | ten sam repo | `celery-worker/Dockerfile` | `celery-worker/railway.json` |

**Routing:** bez repo + Dockerfile Railway uruchamia Railpack (np. Expo z `mobile/`). Ustaw w Dashboard lub GraphQL `serviceInstanceUpdate`: `rootDirectory=/`, `railwayConfigFile`, `dockerfilePath` — szczegóły: [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) § Config as code.

### 4. Zmienne — simulation (Platform Operator)

Skopiuj z backendu: `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `DEBUG=0` (wartości tylko w Railway Variables).

Baseline z `celery-worker-simulation/railway.json` (nie podbijaj bez RAM):

- `CELERY_WORKER_QUEUES=simulation`
- `CELERY_WORKER_POOL=solo`
- `CELERY_WORKER_CONCURRENCY=2`
- `CELERY_WORKER_PREFETCH_MULTIPLIER=1`
- `CELERY_MAX_TASKS_PER_CHILD=50`
- `SCALE_SIM_ASYNC_ROUTING=1`
- `SCALE_MAX_STARTS_PER_LIVE_TICK=30`
- `SCALE_SIM_BROUTER_MAX_CALLS_PER_TICK=25`
- `SCALE_SIM_BROUTER_ROUTE_ATTEMPTS=4`

### 5. Zmienne — routing (Platform Operator)

Te same `DATABASE_URL`, `REDIS_URL`, **`SECRET_KEY`** co simulation/backend.

- `CELERY_WORKER_QUEUES=routing`
- `CELERY_WORKER_HOSTNAME=routing@%h`
- `CELERY_WORKER_POOL=solo`
- `CELERY_WORKER_CONCURRENCY=2`
- `CELERY_WORKER_PREFETCH_MULTIPLIER=1`
- `CELERY_MAX_TASKS_PER_CHILD=50`
- `SCALE_SIM_ASYNC_ROUTING=1`
- `BROUTER_URL=http://brouter.railway.internal:17777/brouter`

### 6. RAM — tylko Railway Dashboard (Platform Operator)

| Serwis | Minimum |
|--------|---------|
| `celery-worker-simulation` | **≥ 2 GB** |
| `celery-worker-routing` | **≥ 1 GB** |
| `brouter` | [BROUTER.md](./BROUTER.md) |

RAM **nie** jest weryfikowany przez skrypt PowerShell (brak w CLI); ustaw ręcznie w Settings → Resources. Pełna tabela: [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md).

### 7. Deploy routing (Platform Operator)

```powershell
railway service link celery-worker-routing
railway up -s celery-worker-routing -e production --detach -m "celery routing worker"
```

### 8. Weryfikacja logów (Platform Operator)

```powershell
railway logs -s celery-worker-routing --lines 50
```

| Wynik | Oczekiwane |
|-------|------------|
| **PASS** | `Starting Celery … routing@`, `queues=routing`, brak `expo start` / Metro |
| **FAIL** | Expo, `4velo@`, Metro — zły build/repo |

```powershell
railway logs -s celery-worker-simulation --lines 30
```

| Wynik | Oczekiwane |
|-------|------------|
| **PASS** | `simulation@`, `pool=solo`, `concurrency=1` (solo) lub zgodne z prefork |

---

## Rollback (Platform Operator)

| Krok | Akcja |
|------|--------|
| 1 | Railway → serwis → **Deployments** → przywróć poprzedni deployment |
| 2 | Przy OOM: obniż `SCALE_MAX_STARTS_PER_LIVE_TICK` i `SCALE_SIM_BROUTER_*` — [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md) |
| 3 | Stuck live sim: `POST /api/activities/admin/simulator-reset/` lub admin **Reset simulator locks** — [SIMULATOR.md](./SIMULATOR.md) |
| 4 | Tymczasowy bypass async routing: `SCALE_SIM_ASYNC_ROUTING=0` (większe obciążenie tick — tylko awaryjnie) |

---

## Troubleshooting

| Objaw | Prawdopodobna przyczyna | Akcja |
|-------|-------------------------|--------|
| Skrypt: routing repo FAIL | Brak podpięcia GitHub | Dashboard: repo `karnalooch/stunning-pancake` + Dockerfile |
| Logi: Expo / Metro | Railpack z `mobile/` | Ustaw `dockerfilePath` + `railwayConfigFile` |
| `ride_warming` > 0 długo | Brak konsumenta `routing` | Deploy `celery-worker-routing`, sprawdź logi |
| SIGKILL w logach | OOM | RAM ≥ 2 GB simulation; `solo`; patrz RAILWAY_CELERY_MEMORY |
| GraphQL check FAIL | Token lub ID serwisu | `RAILWAY_API_TOKEN`; ręczna weryfikacja Dashboard |

---

## Powiązane

- [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md)
- [../RAILWAY_CELERY_SIMULATION.md](../RAILWAY_CELERY_SIMULATION.md)
- [SIMULATOR.md](./SIMULATOR.md)
- [../admin/P1_ROADMAP.md](../admin/P1_ROADMAP.md) — Paczka 1a/1b
- [../admin/P0_SMOKE_CHECKLIST.md](../admin/P0_SMOKE_CHECKLIST.md)
