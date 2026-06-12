# Lista podprocesorów — szablon per tenant

| | |
|--|--|
| **Status** | Active — template |
| **Wersja** | 1.0 |
| **Data** | 2026-06-12 |
| **Owner** | DPO / Legal |
| **Tenant** | `[NAZWA_TENANTA]` |
| **lang** | pl |
| **translation** | [English](../../en/compliance/SUBPROCESSORS_TEMPLATE.md) |
| **canonical_path** | docs/gtm/pl/compliance/SUBPROCESSORS_TEMPLATE.md |
| **DPIA** | [DPIA_TEMPLATE.md](./DPIA_TEMPLATE.md) |

---

## Instrukcja

1. Skopiuj tabelę do załącznika DPIA lub umowy powierzenia.
2. Oznacz **DPA status**: `Aktywny` / `W toku` / `N/A` (brak danych osobowych).
3. Aktualizuj przy każdej zmianie dostawcy — powiadom tenant min. 30 dni wcześniej (standardowy klauzula DPA).
4. Dla map komercyjnych — patrz [MAP_BASEMAP_LICENSING.md](../../../compliance/MAP_BASEMAP_LICENSING.md).

---

## Tabela podprocesorów (domyślna dla 4VELO)

| # | Podprocesor | Rola | Przetwarzane dane | Lokalizacja | DPA status | Uwagi |
|---|-------------|------|-------------------|-------------|------------|-------|
| 1 | `[Railway / hosting]` | Hosting aplikacji, DB, Redis | Wszystkie dane platformy | `[USA/UE — uzupełnij]` | `[ ]` | Postgres, Redis, Celery workers |
| 2 | `[Operator e-mail]` | Transakcyjne e-maile kampanii | E-mail, imię | `[ ]` | `[ ]` | Kickoff, reset hasła |
| 3 | `[Push provider]` | Powiadomienia push mobile | Device token, treść powiadomienia | `[ ]` | `[ ]` | FCM / APNs via Expo |
| 4 | OpenStreetMap / tile provider | Mapy bazowe, heatmapy | Agregaty lokalizacji (nie PII w warstwie kafelków) | Global CDN | N/A / licencja | Zob. MAP_BASEMAP_LICENSING |
| 5 | `[Matrix / chat — jeśli włączony]` | Czat klubu/eventu | Wiadomości, ID użytkownika | `[ ]` | `[ ]` | Opcjonalny moduł |
| 6 | Strava / Garmin (API) | Import aktywności użytkownika | OAuth token, metadane aktywności | USA | Zgoda użytkownika | Tylko gdy user łączy konto |
| 7 | `[Stripe — jeśli płatności]` | Płatności / nagrody | Dane płatnicze | `[ ]` | `[ ]` | Tylko przy module nagród płatnych |
| 8 | `[Datadog / monitoring — jeśli prod]` | Metryki, logi operacyjne | Logi zanonimizowane, metryki | `[ ]` | `[ ]` | Bez treści PII w logach |

---

## Podprocesorzy specyficzni tenanta `[NAZWA_TENANTA]`

| # | Podprocesor | Rola | Dane | Lokalizacja | DPA | Uwagi |
|---|-------------|------|------|-------------|-----|-------|
| T1 | `[np. biuro HR tenant]` | Lista uczestników pracowniczych | E-mail służbowy | Polska | `[ ]` | Tylko kampanie korporacyjne |
| T2 | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |

---

## Transfer poza EOG

Jeśli podprocesor przetwarza poza EOG:

- [ ] Standard Contractual Clauses (SCC) podpisane
- [ ] Ocena transferu udokumentowana
- [ ] Tenant poinformowany w DPIA §5

---

## Historia zmian

| Data | Zmiana | Autor |
|------|--------|-------|
| `[DATA]` | Wersja początkowa | `[ ]` |

---

## Checklist

- [ ] Wszystkie aktywne podprocesorzy z tabeli domyślnej zweryfikowane
- [ ] Wiersze tenant-specific uzupełnione lub usunięte
- [ ] DPA status = Aktywny dla każdego przetwarzającego PII
- [ ] Załącznik dołączony do DPIA i umowy z tenantem
