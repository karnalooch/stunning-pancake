# ADR 011: Telemetry ingest durability under burst load

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../adr/011-telemetry-ingest-durability-under-load.md) |
| **canonical_path** | docs/pl/adr/011-telemetry-ingest-durability-under-load.md |
---

## Stan

Zaakceptowano (2026-06-04)

## Kontekst

Główną obietnicą produktu SPORT jest **dokładny, pozbawiony przerw ślad aktywności** nawet w dniu wydarzenia (około 50 tys. użytkowników). [ADR-005](./005-telemetry-tracking.md) ustalono lokalizację Expo → MMKV `gps_buffer` → 30-sekundowe pobieranie wsadowe HTTP → TimescaleDB. Ten projekt wytrzymuje sporadyczne połączenia, gdy klient może ponowić próbę do czasu HTTP **201/202**, ale **nie** gwarantuje trwałości, gdy **serwer odrzuci przetwarzanie** w przypadku przeciążenia platformy.

Obecnie ochrona jest wielowarstwowa (patrz [EVENT_BURST_50K.md](../../EVENT_BURST_50K.md)):

1. **Globalny strażnik obciążenia** ([`backend/core/load_guard.py`](../../../backend/core/load_guard.py)) — zawsze włączone przesuwane okna do dołączania, rozpoczynania sesji i pozyskiwania telemetrii (`GLOBAL_MAX_INGEST_PER_SECOND`, domyślnie 20 k/s). Otwieranie awaryjne w przypadku błędów Redis.
2. **Wybuch wydarzenia** — limity dołączeń/sesji ograniczone do wydarzenia i limit jednoczesnych map na żywo (~10 tys. użytkowników).

Usługa telemetryczna FastAPI ([`telemetry/main.py`](../../../telemetry/main.py)) odzwierciedla limity pozyskiwania poprzez `_ingest_allowed()` i zwraca **`429 + Retry-After`** w `/api/telemetry/ingest` i `/ingest/batch` w przypadku przekroczenia limitu na sekundę. W przypadku prawdziwego impulsu **nadmiarowe pakiety są odrzucane na krawędzi**, chyba że klient mobilny przechowuje je w lokalnej pamięci masowej i ponawia próby — co obecnie jest wdrażane tylko częściowo.

### Hotspoty geoprzestrzenne w dniu wydarzenia

Imprezy masowe to nie tylko **globalny problem QPS**: kolarze skupiają się w tym samym **regionie i oknie czasowym** („każdy dzień to Ride London” w przypadku wydarzeń wirtualnych/fizycznych). To koncentruje:

- **Zapisz hotspoty** — gęste klucze `GEORADIUS` / shard i pozyskuj fragmenty kolejki dla jednego bboxa.
- **Przeczytaj hotspoty** — mapa na żywo i kafelki widzów uderzają w tę samą parę odłamków.

[TELEMETRY_SHARDING](../../operations/TELEMETRY_SHARDING.md) skaluje **odczyt/indeks** w poziomie; to ADR dodaje **absorpcję zapisu** (kolejka + drenaż), więc lokalne skoki nie korelują z liniowymi przerwami w zakończonych działaniach. Zobacz [Strava Engineering – grupowanie aktywności](https://medium.com/strava-engineering/activity-grouping-the-heart-of-a-social-network-for-athletes-865751f7dca).

### Zaobserwowane tryby awarii

| Objaw | Przyczyna | Wpływ |
|--------|--------|--------|
| Luki w linii prostej po zakończonej jeździe | 429 w partii; bufor wyczyszczony lub punkt nie został ponownie umieszczony w kolejce po „zaakceptowanym” nieporozumieniu | Widoczny dla użytkownika zły utwór; ranking/spory PR |
| Mapa na żywo jest rzadka, podczas gdy jazda „wydaje się” w porządku | Pozyskiwanie zostało ograniczone, ale sesja jest nadal aktywna; zaktualizowano tylko ostatnią pozycję nadawczą | Zamieszanie w operacjach, nie zawsze skierowane do użytkownika |
| WS spożywa bez ograniczeń | `/ws/telemetry/ingest` omija `_ingest_allowed()` | Ciśnienie w basenie DB; nieuczciwe wobec klientów HTTP |
| Partia nie liczy ładunku | Przyrosty `_ingest_allowed()` **raz na żądanie HTTP**, a nie `len(batch.packets)` | Duże partie wsuwają się pod nakrętkę; potem nagłe 429 dla małych partii |
| Symulator a asymetria mobilna | Ścieżka Django używa `check_ingest(n)` z liczbą pakietów; telemetria HTTP nie | Niespójna semantyka strażników w punktach wejścia |
| Ścieżka odczytu konkuruje z zapisem | Mapa na żywo `GEORADIUS` + rozwinięcie fragmentu ([TELEMETRY_SHARDING](../../operations/TELEMETRY_SHARDING.md)) udostępnia Redis/CPU przy przetwarzaniu | Prawidłowe ograniczenie **jednoczesnych żywych punktów**; źle rzucić spożycie i czyta jednakowo |
| Ponów próbę burzy po 429 | Wielu klientów wycofuje się niezależnie, ale nadal uruchamia równoległe procesy robocze skrzynki nadawczej na każdym urządzeniu | Wzmacnia przeciążenie; strażnik pozostaje zaangażowany dłużej |

### Napięcie projektowe: rzucić czyta, nie pisze

W przypadku **aktywnej sesji uwierzytelnionej** (użytkownik kliknął „rozpocznij jazdę”, prawidłowy „id_aktywności”):

- **Zapisy** (punkty GPS, próbki tętna) to **krytyczna telemetria** — muszą ostatecznie wylądować w trwałym magazynie.
- **Odczyty** (mapa na żywo dla widzów, kafelki analityki administracyjnej, zapytania historyczne) są **najlepiej sprawdzane pod obciążeniem** — mogą zwracać nieaktualne próbki, dolny „limit” lub wartość 503

---

## Pełna wersja (kanoniczna)

Pełny tekst ADR (język źródłowy dokumentu): **[011-telemetry-ingest-durability-under-load.md](../../adr/011-telemetry-ingest-durability-under-load.md)**.

> Skrót PL — nie zastępuje pełnego ADR przy review architektury.
