# Dokumentacja 4VELO

To punkt wejścia dla osoby przejmującej projekt. Szczegółowe dokumenty PL/EN
zachowują dotychczasowe ścieżki. Raporty są datowanymi obserwacjami, plany opisują
zamierzenia, a instrukcje operacyjne wymagają sprawdzenia w docelowym środowisku.

| Potrzeba | Dokument |
|---|---|
| Poznać projekt i kryteria gotowości | [PROJECT_TAKEOVER](PROJECT_TAKEOVER.md) |
| Znaleźć moduł | [Mapa repozytorium](reports/REPOSITORY_MAP.md) |
| Uruchomić lokalnie | [Getting started PL](pl/GETTING_STARTED.md) / [EN](en/GETTING_STARTED.md) |
| Zrozumieć architekturę | [Architektura](ARCHITECTURE.md) i [ADR](adr/) |
| Zmieniać kod | [Development](pl/DEVELOPMENT.md) i [Contributing](../CONTRIBUTING.md) |
| Sprawdzić jakość | [Macierz poleceń](reports/QUALITY_COMMAND_MATRIX.md) i [program jakości](quality/README.md) |
| Obsługiwać wdrożenie | [Operacje](pl/operations/README.md) i [rotacja klucza](operations/SIGNING_KEY_ROTATION.md) |
| Ustalić kolejność prac | [Ryzyka](reports/RISK_AND_OWNERSHIP_MAP.md) i [kolejka przejęcia](TAKEOVER_WORK_QUEUE.md) |

## Materiały szczegółowe

- [Pełny indeks PL](pl/README.md) / [EN](en/README.md).
- [Panel administracyjny](admin/README.md).
- [Dokumenty projektowe](design/) — referencje i zamierzenia UI, nie dowód wdrożenia.
- [Raporty](reports/) — zachowuj datę, commit i ograniczenia pomiaru.
- [Archiwum](archive/) — historia; nie używaj jako instrukcji bieżącego wdrożenia.

Nowe instrukcje powinny aktualizować istniejący dokument kanoniczny. Nie twórz
kolejnej równoległej instrukcji startu. Przy zmianie zachowania aktualizuj kod,
testy i właściwy dokument w tym samym PR.
