# Live sim — rekomendowane limity (infra prod)

> Uzupełnij po `scripts/sim-live-infra-benchmark.ps1`. Poniżej model z topologii Railway + obserwacji tick stall.

## Topologia (marvelous-gratitude / prod)

| Serwis | Repliki | CPU | RAM | Rola |
|--------|---------|-----|-----|------|
| celery-worker-simulation | 1 | 2 | 8 GB | tick inline + batch orchestration |
| celery-worker-routing | 8 | 2 | 2 GB | BRouter (`solo`, concurrency 6) → ~48 równoległych route |
| brouter + brouter-2 | 1+1 | — | — | HTTP routing |

## Wąskie gardła

1. **Simulation worker (1 replika)** — jeden inline tick na cykl; przy 10k / 50% hash `live_rides` jest duży → tick > 2s → TICK STALLED.
2. **Routing drain** — ~15–30 route/s realnie (48 workerów × ~3–5 s/BRouter). Dispatch 600/tick zalewa kolejkę jeśli drain wolniejszy.
3. **Niesynchronizowane env** — backend pokazywał routing 150/tick mimo 600 w repo → uruchom `railway-sync-300k-50k.ps1`.

## Rekomendowane ustawienia (start)

### Pula ≤ 5k użytkowników

| Zmienna | Wartość |
|---------|---------|
| `SCALE_SIM_OPTIMAL_TICK_SECONDS` | **2** |
| `SCALE_MAX_STARTS_PER_LIVE_TICK` | **400** |
| `SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK` | **300** |
| `SCALE_SIM_MAX_ROUTING_QUEUE_DEPTH` | **3000** |
| Udział na mapie (wizard) | **30–50%** |

### Pula 10k użytkowników

| Zmienna | Wartość |
|---------|---------|
| `SCALE_SIM_OPTIMAL_TICK_SECONDS` | **3–4** (nie 2 dopóki stall) |
| `SCALE_MAX_STARTS_PER_LIVE_TICK` | **300** |
| `SCALE_SIM_MAX_ROUTING_DISPATCH_PER_TICK` | **200–250** |
| Udział na mapie | **max 30%** (~3k ACTIVE), potem 50% po stabilnym ramp |

### Pula 50k+ (event)

| Zmienna | Wartość |
|---------|---------|
| tick | **6–8** |
| starts/tick | **150–200** |
| routing dispatch | **120** |
| active_ratio | **≤ 17%** (50k / 300k) |

## Jak zmierzyć na żywo

```powershell
$env:ADMIN_PASS = '<GLOBAL_OWNER>'
$env:ALLOW_PROD_LOAD_TEST = '1'
$env:SIM_LAB_API_BASE = 'https://backend-production-55c7.up.railway.app/api'
.\scripts\sim-live-infra-benchmark.ps1 -UserSteps 1000,5000,10000 -ActivePercentSteps 20,30,50
```

Raport: `scripts/load/reports/sim-infra-benchmark-*.json` → pole `recommended_limits`.

## Kiedy skalować infra zamiast podbijać limity

- **TICK STALLED** przy warming > 100 → +1 replika `celery-worker-simulation` lub tick 4s
- **routing_queue** rośnie, warming nie spada → +2 repliki `celery-worker-routing`
- **CPU simulation** > 70% sustained → tick 4s lub więcej CPU
