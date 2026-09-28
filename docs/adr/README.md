# Architecture Decision Records

| | |
|--|--|
| **Status** | ✅ Active |
| **Document class** | REFERENCE |
| **Owner role** | Tech Lead |
| **Last reviewed** | 2026-09-28 |

Ten katalog zawiera kanoniczne ADR-y. Numer ADR jest unikalny i nie jest ponownie używany po publikacji.

| ADR | Decyzja |
|---|---|
| [001](001-react-native-bridgeless.md) | React Native Bridgeless |
| [002](002-unistyles-v3-initialization.md) | Unistyles v3 initialization |
| [003](003-state-management-legend-state.md) | Legend State |
| [004](004-persistent-storage-mmkv.md) | MMKV persistent storage |
| [005](005-telemetry-tracking.md) | Telemetry tracking |
| [006](006-design-system-stitch.md) | Design system / Stitch |
| [007](007-ai-coaching-architecture.md) | AI coaching architecture |
| [008](008-backend-strategy.md) | Backend strategy |
| [009](009-admin-user-management-and-event-matchmaking.md) | Admin user management and event matchmaking |
| [010](010-simulator-redis-celery.md) | Simulator Redis + Celery |
| [011](011-telemetry-ingest-durability-under-load.md) | Telemetry ingest durability under load |
| [012](012-live-map-enterprise-phase2.md) | Live Map enterprise phase 2 |
| [013](013-sim-lab-read-federation.md) | Sim Lab read federation |
| [014](014-mobile-immersive-pixel-art-and-bike-computer.md) | Mobile immersive pixel-art / bike computer |
| [015](015-critical-data-acknowledgement.md) | Critical data acknowledgement |
| [016](016-mobile-performance-budgets.md) | Mobile performance budgets |

## Zasada numeracji

Nowy ADR bierze kolejny wolny numer. `scripts/check_docs_structure.py` blokuje duplikaty identyfikatorów.

Polskie streszczenia, jeśli istnieją, są materiałem pomocniczym. Kanoniczna decyzja pozostaje w `docs/adr/`.
