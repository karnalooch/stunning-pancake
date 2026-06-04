# ADR 011 — trwałość ingestu telemetrii pod obciążeniem

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Architektura, Platform Operator |
| **lang** | pl |
| **translation** | [English](../../adr/011-telemetry-ingest-durability-under-load.md) |
| **canonical_path** | docs/pl/adr/011-telemetry-ingest-durability-under-load.md |

---

## Stan

**Zaakceptowano** (2026-06-04)

## Kontekst (skrót)

[ADR-005](./005-telemetry-tracking.md) opisuje ścieżkę mobilną → MMKV → batch HTTP → TimescaleDB. Przy impulsie wydarzenia (~50k użytkowników) **globalny load guard** i limity FastAPI mogą zwracać **429** — punkty giną na krawędzi, jeśli nie ma kolejki po stronie serwera i outboxu po stronie klienta. Hotspoty geoprzestrzenne koncentrują zapis i odczyt mapy na tych samych shardach ([TELEMETRY_SHARDING](../../operations/TELEMETRY_SHARDING.md)).

## Decyzja (skrót)

| Warstwa | Kierunek |
|---------|----------|
| **Zapis (sesja aktywna)** | Kolejka ingest + drenaż do DB; **202/429** z semantyką retry; mobilny outbox do ACK |
| **Odczyt (mapa live, analityka)** | **Shedding** — wolniejszy poll, niższy `detail`, cache; nie odrzucać zapisów na rzecz widzów |
| **Spójność guardów** | Liczenie `n` pakietów w batchu tak samo w Django i FastAPI; WS ingest pod tym samym limitem co HTTP |
| **Operacje** | `ingest_engaged` w meta live map; env `LIVE_MAP_INGEST_*`, `GLOBAL_MAX_INGEST_PER_SECOND` |

## Konsekwencje

- Wymaga workerów drenażu i monitoringu głębokości kolejki ([TELEMETRY_INGEST_QUEUE.md](../../operations/TELEMETRY_INGEST_QUEUE.md)).
- Testy: `verify-adr011-ingest.sh`, `test_live_map_read_policy.py`, load test w [TELEMETRY_LOAD_TEST.md](../../operations/TELEMETRY_LOAD_TEST.md).
- **Nie zastępuje** pełnego ADR przy review architektury.

## Pełna wersja (kanoniczna, EN)

**[011-telemetry-ingest-durability-under-load.md](../../adr/011-telemetry-ingest-durability-under-load.md)**
