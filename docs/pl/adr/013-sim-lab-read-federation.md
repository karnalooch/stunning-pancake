# ADR-013: Federacja odczytu sim-lab (prod BFF → izolowany data plane)


| | |
|--|--|
| **Status** | Accepted |
| **translation** | [English](../../adr/013-sim-lab-read-federation.md) |
| **canonical_path** | docs/pl/adr/013-sim-lab-read-federation.md |
| **Epic** | [docs/todo/sim-lab-read-federation.md](../../todo/sim-lab-read-federation.md) |

Pełny tekst ADR (język źródłowy): **[013-sim-lab-read-federation.md](../../adr/013-sim-lab-read-federation.md)**.

**Skrót:** Sim-lab pozostaje jedynym write path dla danych syntetycznych. Prod backend federuje wybrane GET (Faza 1: `admin/stats`) z etykietą `data_source: sim-lab`. Sales demo — osobne środowisko ([demo-environment.md](../../todo/demo-environment.md)).
