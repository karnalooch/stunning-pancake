# Cykl życia dokumentacji 4VELO

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer / Tech Lead |
| **Last reviewed** | 2026-09-28 |
| **Audience** | Autorzy dokumentacji, reviewerzy, operatorzy |

## Cel

Ustalić jeden system klasyfikacji dokumentów, żeby bieżąca instrukcja, snapshot audytu i stary plan nie wyglądały jak trzy równorzędne źródła prawdy.

## Klasy

| Klasa | Znaczenie | Typowe miejsce | Czy prowadzi bieżącą pracę? |
|---|---|---|---|
| **CURRENT** | Aktualny opis zachowania lub polityki | `docs/pl/`, `docs/en/`, `docs/ci/`, `docs/security/`, `docs/quality/` | Tak |
| **REFERENCE** | Stabilna referencja techniczna | `ARCHITECTURE.md`, `API.md`, `RBAC.md` | Tak |
| **RUNBOOK** | Wykonywalna procedura operacyjna | `docs/pl/operations/`, `docs/en/operations/`, `runbooks/` | Tak |
| **ADR** | Zapis decyzji architektonicznej | `docs/adr/` | Tak, jako rationale |
| **SNAPSHOT** | Wynik kontroli / audytu w dacie | `docs/reports/`, `docs/audits/`, datowane pliki domenowe | Nie bez dodatkowej weryfikacji |
| **EVIDENCE** | Dowód konkretnego runu / release gate | domenowy katalog evidence | Nie jako instrukcja |
| **HISTORICAL** | Materiał zachowany dla historii projektu | `docs/archive/` lub legacy path z bannerem | Nie |
| **SUPERSEDED** | Dokument wyparty przez wskazany SSOT | `docs/archive/` lub legacy redirect | Nie |

## Wymagane metadane dla nowych dokumentów aktywnych

```markdown
| | |
|--|--|
| **Status** | ✅ Active |
| **Document class** | CURRENT / REFERENCE / RUNBOOK / ADR |
| **Owner role** | rola, nie imię |
| **Last reviewed** | YYYY-MM-DD |
| **Audience** | odbiorcy |
```

Snapshoty powinny dodatkowo podawać datę, commit/SHA lub run ID (jeśli istnieje) oraz ograniczenia pomiaru.

## Reguła SSOT

Jeśli dwa dokumenty opisują ten sam operacyjny kontrakt, jeden musi być wskazany jako SSOT, a drugi ma linkować do niego albo zostać sklasyfikowany jako snapshot/historyczny. Nie utrzymujemy dwóch pełnych instrukcji dla tego samego procesu.

## Kiedy archiwizować

Archiwizuj dopiero gdy:

1. istnieje wskazany następca / SSOT,
2. repo nie zależy od starej ścieżki jako kontraktu testów, path-filtera albo automatyzacji,
3. odsyłacze zostały zaktualizowane lub legacy URL pozostaje redirectem,
4. `python scripts/check_docs_links.py` przechodzi po zmianie.

Nie usuwaj dowodów historycznych tylko dlatego, że są stare.

## Takeover / pilot / roadmap

`PROJECT_TAKEOVER.md`, `TAKEOVER_*`, `PARTIAL_TAKEOVER_PILOT_PLAN.md` oraz podobne materiały opisują fazę stabilizacji i plan pracy. Zachowują wartość historyczną, ale **nie są domyślnym źródłem bieżącej konfiguracji lub procedury release**. W nowych dokumentach linkuj do aktualnego SSOT domenowego.

## ADR

Każdy ADR ma unikalny trzycyfrowy numer. Kolizje numerów są błędem struktury dokumentacji i blokują CI przez `scripts/check_docs_structure.py`.

## Kontrola

Po zmianach dokumentacji:

```bash
python scripts/check_docs_links.py
python scripts/check_docs_i18n.py
python scripts/check_docs_structure.py
```
