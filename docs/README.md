# Dokumentacja 4VELO

| | |
|--|--|
| **Status** | ✅ Active — główny indeks dokumentacji |
| **Owner role** | Documentation maintainer / Tech Lead |
| **Last reviewed** | 2026-09-30 |
| **Audience** | Developer, operator, release manager, reviewer |

Ten plik jest **głównym punktem wejścia i mapą SSOT** dla 4VELO. Dokumentacja ma dziś setki plików, więc zasada jest prosta: **najpierw wybierz zadanie z tabeli poniżej; nie zaczynaj od roadmapy, starego planu takeover ani datowanego audytu.**

## Zacznij od zadania

| Chcę… | Kanoniczny punkt startowy |
|---|---|
| Uruchomić projekt lokalnie | [Getting started PL](pl/GETTING_STARTED.md) / [EN](en/GETTING_STARTED.md) |
| Zrozumieć komponenty i granice systemu | [ARCHITECTURE.md](ARCHITECTURE.md) · [C4](diagrams/architecture_c4.md) · [mapa repo](reports/REPOSITORY_MAP.md) |
| Zmieniać kod | [CONTRIBUTING.md](../CONTRIBUTING.md) · [Development PL](pl/DEVELOPMENT.md) |
| Uruchomić / naprawić Home Lab | [HOME_LAB PL](pl/operations/HOME_LAB.md) / [EN](en/operations/HOME_LAB.md) |
| Zrobić release / pre-release | [PRE_RELEASE_VERIFICATION PL](pl/operations/PRE_RELEASE_VERIFICATION.md) · [Full Release lane](ci/FULL_RELEASE_LANE_V1.md) |
| Pracować z mobile / Android | [MOBILE PL](pl/operations/MOBILE.md) · [runtime acceptance](quality/MOBILE_RUNTIME_ACCEPTANCE_V1.md) |
| Sprawdzić bezpieczeństwo | [SECURITY.md](../SECURITY.md) · [security contracts](security/) |
| Pracować z CI/CD | [CI contracts](ci/) · [quality](quality/README.md) |
| Obsługiwać produkcję | [Operations PL](pl/operations/README.md) / [EN](en/operations/README.md) |
| Sprawdzić API / RBAC | [API.md](API.md) · [RBAC.md](RBAC.md) |
| Zrozumieć decyzję architektoniczną | [ADR index](adr/README.md) |
| Zobaczyć stan ryzyk / audytów | [reports/README.md](reports/README.md) |
| Znaleźć dokument historyczny | [archive/](archive/) oraz sekcja „Historia i evidence” poniżej |

## Mapa SSOT

| Obszar | SSOT / indeks | Czego **nie** traktować jako SSOT |
|---|---|---|
| Architektura | [ARCHITECTURE.md](ARCHITECTURE.md), [C4](diagrams/architecture_c4.md), [ADR](adr/README.md) | roadmapy, datowane audyty i superseded implementation proposals |
| Dev setup | [pl/GETTING_STARTED.md](pl/GETTING_STARTED.md), [pl/DEVELOPMENT.md](pl/DEVELOPMENT.md) | stare instrukcje takeover |
| Operacje | [pl/operations/README.md](pl/operations/README.md) | datowane proofy / incident notes |
| Mobile | [pl/operations/MOBILE.md](pl/operations/MOBILE.md), [DATA_RESILIENCE.md](DATA_RESILIENCE.md), [quality/MOBILE_RUNTIME_ACCEPTANCE_V1.md](quality/MOBILE_RUNTIME_ACCEPTANCE_V1.md) | sprint seedy i stare audyty |
| Release | [pl/operations/PRE_RELEASE_VERIFICATION.md](pl/operations/PRE_RELEASE_VERIFICATION.md), [ci/FULL_RELEASE_LANE_V1.md](ci/FULL_RELEASE_LANE_V1.md) | pojedynczy stary run CI |
| Security | [SECURITY.md](../SECURITY.md), [security/](security/) | historyczne audyty bezpieczeństwa |
| Compliance | [compliance/README.md](compliance/README.md) | template kampanii / snapshoty |
| Jakość | [quality/README.md](quality/README.md), [reports/QUALITY_COMMAND_MATRIX.md](reports/QUALITY_COMMAND_MATRIX.md) | deklaracje „green” bez wskazanego runu |
| Design / UI | [Product UX v2](design/PRODUCT_UX_V2.md) · [Mobile Visual Composition Architecture](design/MOBILE_VISUAL_COMPOSITION_ARCHITECTURE_V1.md) · [design/](design/) | screenshot, stary Frozen UI albo asset bez current authority contract |
| i18n docs | [locales/README.md](locales/README.md) | legacy redirect stub jako miejsce edycji |

## Typy dokumentów

Każdy dokument powinien dać się przypisać do jednego z typów opisanych w [DOCUMENTATION_LIFECYCLE.md](DOCUMENTATION_LIFECYCLE.md):

- **CURRENT / REFERENCE** — opisuje aktualny system lub kontrakt.
- **RUNBOOK** — wykonywalna procedura z weryfikacją i rollbackiem.
- **ADR** — trwały zapis decyzji architektonicznej.
- **SNAPSHOT / EVIDENCE** — wynik audytu, testu lub walidacji w określonym czasie.
- **HISTORICAL / SUPERSEDED** — zachowane dla historii, ale nie prowadzi bieżącej pracy.

Datowany audyt albo plan nie staje się „current” tylko dlatego, że nadal jest w repo.

## Struktura

| Katalog | Rola |
|---|---|
| `docs/pl/`, `docs/en/` | aktywna dokumentacja językowa; patrz [locales/](locales/) |
| `docs/operations/`, `docs/runbooks/` | legacy URL redirecty; treść edytuj w `pl/` / `en/` |
| `docs/adr/` | kanoniczne ADR-y i ich indeks |
| `docs/ci/` | kontrakty i polityki CI/CD |
| `docs/security/` | aktywne kontrakty / release evidence bezpieczeństwa |
| `docs/quality/` | quality gates i kryteria akceptacji |
| `docs/design/` | authority contracts, specyfikacje i datowane audyty UI |
| `docs/reports/` | datowane raporty i przekrojowe mapy |
| `docs/archive/` | materiały historyczne / superseded |
| `docs/compliance/` | compliance i release-legal |
| `docs/gtm/` | go-to-market; nie jest dokumentacją runtime |

## Historia i evidence

Pliki takie jak `PROJECT_TAKEOVER.md`, `TAKEOVER_*`, `PARTIAL_TAKEOVER_PILOT_PLAN.md` i datowane audyty opisują historię stabilizacji projektu lub konkretny moment w czasie. **Nie są domyślnym punktem wejścia do bieżącej pracy.** Zachowujemy ich ścieżki tam, gdzie są częścią kontraktów CI, testów lub istniejących odwołań; nowe instrukcje nie powinny ich używać jako SSOT.

Nowe snapshoty umieszczaj w `reports/`, `audits/` albo odpowiednim katalogu domenowym z datą. Materiał całkowicie wyparty przez nowszy SSOT przenoś do `archive/` dopiero po sprawdzeniu odsyłaczy.

## Zasady zmian

1. Aktualizuj istniejący SSOT zamiast tworzyć równoległą instrukcję.
2. Nowy dokument musi mieć określony typ i właściciela roli.
3. ADR-y dostają unikalny numer — sprawdza to CI.
4. Snapshot nie może deklarować bieżącego stanu bez daty / SHA / ograniczeń.
5. Legacy redirectów nie edytujemy merytorycznie.
6. Przy zmianie zachowania aktualizuj kod, testy i właściwy dokument w tym samym PR.
7. Po zmianie dokumentacji uruchom:

```bash
python scripts/check_docs_links.py
python scripts/check_docs_i18n.py
python scripts/check_docs_structure.py
python scripts/check_docs_freshness.py
```

Standard autora: [DOCUMENTATION_STANDARDS.md](DOCUMENTATION_STANDARDS.md). Zasady życia dokumentu: [DOCUMENTATION_LIFECYCLE.md](DOCUMENTATION_LIFECYCLE.md). SLA przeglądu bieżących SSOT-ów: [`DOCUMENTATION_FRESHNESS.json`](DOCUMENTATION_FRESHNESS.json).
