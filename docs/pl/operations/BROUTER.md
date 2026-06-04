# Runbook — BRouter (routing live sim)


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../../en/operations/BROUTER.md) |
| **canonical_path** | docs/pl/operations/BROUTER.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Platform Operator |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Platform Operator |

**Obraz:** `infrastructure/brouter/Dockerfile` (BRouter 1.7.9, `RouteServer` HTTP :17777) · **Caps:** [RAILWAY_CELERY_MEMORY.md](./RAILWAY_CELERY_MEMORY.md)

---

## URL w Railway

| Klient | URL |
|--------|-----|
| `celery-worker-simulation`, routing, backend | `BROUTER_URLS` (prod): `http://brouter.railway.internal:17777/brouter,http://brouter-2.railway.internal:17777/brouter` — round-robin w `BRouterService` |
| Pojedynczy (Compose / dev) | `BROUTER_URL=http://brouter:17777/brouter` |
| Przeglądarka / curl z laptopa | tylko jeśli wystawiony publicznie (zwykle **nie**) |

---

## Wdrożenie (skrót)

1. Serwis **brouter** z Dockerfile `infrastructure/brouter/Dockerfile`, build context = **root repo** (`numReplicas: 1` — volume).
2. Opcjonalnie **brouter-2** — ten sam Dockerfile, config `infrastructure/brouter-2/railway.json`, osobny volume **`/brouter/segments4`** (pierwszy start ~10–30 min pobierania PL).
3. Volume na każdym serwisie BRouter (≥ 2 GB) — kafelki `.rd5` przetrwają redeploy.
4. Workery: `BROUTER_URLS` (dwa hosty); `BROUTER_URL` opcjonalny fallback do czasu deployu kodu z `main`.
5. Preset **`poland`** — 16 kafelków, ~1 GB; pierwszy start 10–30 min na nowym volume.
6. `BROUTER_SYNC_LOOKUPS=1` — `lookups.dat` v11 zgodne z segmentami z brouter.de.

Szczegóły build/volume: [infrastructure/brouter/README.md](../../../infrastructure/brouter/README.md).

---

## Błąd: `HTTP 400: no track found at pass=0`

**Znaczenie:** BRouter nie przykleił **punktu startu** do sieci dróg (woda, pole, brak profilu).

**W symulatorze (od 2026-06-02):**

- Start od **centrum miasta**, potem losowe próby w promieniu `SCALE_SIM_BROUTER_START_RADIUS_KM` (domyślnie 4 km).
- Fallback profilu `trekking` po `bicycle`.
- Ograniczenie nogi trasy: `SCALE_SIM_BROUTER_MAX_LEG_KM=4`.

**Sprawdź:**

1. Kafelek dla regionu istnieje i &gt; 1 MB (np. `E20_N50.rd5` dla środkowej Polski).
2. Logi kontenera: brak `lookup version mismatch lookups.dat=10 … rd5=11`.
3. `BROUTER_URL` na workerze symulacji wskazuje **wewnętrzny** host Railway.

---

## Zmienne kontenera BRouter

| Zmienna | Domyślnie |
|---------|-----------|
| `BROUTER_SEGMENT_PRESET` | `poland` |
| `BROUTER_AUTO_DOWNLOAD_SEGMENTS` | `1` |
| `BROUTER_JAVA_XMX` | `768m` |
| `BROUTER_SYNC_LOOKUPS` | `1` |

---

## Anti-cheat (produkcja)

Walidacja tras użytkowników: `BRouterService` w `backend/activities/services.py` — profile `bicycle`, `foot-all`, itd. To ten sam serwer co symulator, ale osobna ścieżka kodu niż live sim.
