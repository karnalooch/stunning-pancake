# Konstytucja Projektu 4VELO


| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | See canonical document |
| **lang** | pl |
| **translation** | [English](../en/CONSTITUTION.md) |
| **canonical_path** | docs/pl/CONSTITUTION.md |

---

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Product / Tech Lead |
| **Last reviewed** | 2026-06-03 |
| **Audience** | Cały zespół |

> **Wersja:** v0.2.0-rc.1 · **Data przyjęcia:** 2026-05-15  
> **Motto:** *„Suwerenność poprzez kod, wydajność poprzez dyscyplinę”*  
> **Historyczny charter:** [archive/CHARTER.md](./archive/CHARTER.md) (deprecated)

---

## Spis treści

1. [Preambuła](#1-preambuła)
2. [Zasady Fundamentalne](#2-zasady-fundamentalne)
3. [Reguły Architektury](#3-reguły-architektury)
4. [Standardy Bezpieczeństwa](#4-standardy-bezpieczeństwa)
5. [Standardy Kodu](#5-standardy-kodu)
6. [Zasady Dokumentacji](#6-zasady-dokumentacji)
7. [Zasady Wdrożeń](#7-zasady-wdrożeń)
8. [Zarządzanie Danymi](#8-zarządzanie-danymi)
9. [Reagowanie na Incydenty](#9-reagowanie-na-incydenty)
10. [Wersjonowanie](#10-wersjonowanie)

---

## 1. Preambuła

Platforma **4VELO** to otwartoźródłowy, samohostowany ekosystem dla sportów wytrzymałościowych — od amatorskich treningów po profesjonalne zawody. Łączy śledzenie aktywności GPS, grywalizację, system walki z oszustwami (Anti-Cheat) oraz zaawansowaną analitykę w jednym spójnym środowisku.

Niniejsza Konstytucja definiuje niezmienne zasady, które obowiązują wszystkich współtwórców projektu — od deweloperów, przez DevOps, po projektantów UX. Każda decyzja architektoniczna, każdy pull request i każde wdrożenie muszą być zgodne z duchem i literą tego dokumentu.

### Zakres obowiązywania

| Obszar | Obowiązuje |
|---|---|
| Kod źródłowy (backend, frontend, mobile) | ✅ |
| Infrastruktura (Docker, CI/CD, Railway) | ✅ |
| Dokumentacja techniczna i użytkowa | ✅ |
| Procesy code review i deploymentu | ✅ |
| Zarządzanie danymi i bezpieczeństwo | ✅ |

---

## 2. Zasady Fundamentalne

Pięć filarów, na których opiera się platforma 4VELO. Żaden kompromis nie jest dopuszczalny w tych obszarach.

### 2.1 Security First (Bezpieczeństwo ponad wszystko)

- Wszystkie dane w spoczynku są **szyfrowane** (AES-256, Fernet dla tokenów OAuth)
- Cała komunikacja wymuszana przez **HTTPS** — HSTS z `max-age=31536000`
- **RBAC** (Role-Based Access Control) obowiązkowy dla każdego endpointu API
- Wszystkie sekrety przechowywane w zmiennych środowiskowych (Railway Variables / `.env`)
- **Nigdy** nie commitujemy sekretów do repozytorium

### 2.2 Privacy by Design (Prywatność w DNA)

- **Row-Level Security (RLS)** na poziomie bazy danych — każdy tenant widzi tylko swoje dane
- **Privacy Zones** — maskowanie współrzędnych GPS w strefach prywatnych użytkownika
- Pełna zgodność z **RODO/GDPR**:
  - Prawo do bycia zapomnianym (hard delete + anonymizacja)
  - Prawo do przenoszenia danych (eksport JSON/GPX)
  - Przejrzysta polityka prywatności i zgody użytkownika

### 2.3 Performance (Wydajność)

| Metryka | Cel | Pomiar |
|---|---|---|
| FPS w HUD mobilnym | **60 FPS** | React Native Skia GPU profiling |
| Czas odpowiedzi API | **< 200 ms** (p95) | Prometheus + Grafana |
| Dostępność (uptime) | **99.9%** | Health checks co 30s |
| Czas ładowania SPA | **< 3 s** (First Contentful Paint) | Lighthouse CI |

### 2.4 Fair Play

- **4-warstwowy system Anti-Cheat:**
  1. Walidacja sygnału GPS (prędkość, przyspieszenie, interpolacja)
  2. Analiza statystyczna (outliery, anomalie sezonowe)
  3. Uczenie maszynowe (anomaly detection — Isolation Forest, LSTM)
  4. Moderacja ludzka (dashboard moderatora)
- **Zero tolerancji** dla oszustw — wykryte naruszenia skutkują permanentnym banem
- Wszystkie decyzje Anti-Cheat są **audytowalne** i opatrzone powodem

### 2.5 Open Standards (Otwarte Standardy)

- **REST API** zgodne z konwencjami RESTful
- **OGC Moving Features** — otwarty standard dla danych o ruchu
- **OpenAPI 3.1** — dokumentacja API auto-generowana przez `drf-spectacular`
- Preferencja dla otwartych formatów: **GPX**, **GeoJSON**, **CSV**

---

## 3. Reguły Architektury

### 3.1 Backend — Django + DRF + PostGIS

| Reguła | Opis |
|---|---|
| **ORM-first** | Nigdy nie omijamy ORM Django dla operacji zapisu. Surowe SQL tylko dla optymalizacji odczytu (materialized views) |
| **DRF serializery** | Każdy endpoint API ma zdefiniowany serializer — bez ręcznego budowania JSON |
| **PostGIS** | Wszystkie zapytania geoprzestrzenne przez GeoDjango ORM (`gis` module) |
| **Celery** | Długotrwałe operacje (przetwarzanie GPX, retraining ML) zawsze w taskach asynchronicznych |
| **Testy** | Każdy nowy endpoint musi mieć testy integracyjne (`APITestCase`) |

### 3.2 Frontend (Admin) — React + Mantine + Vite

| Reguła | Opis |
|---|---|
| **TypeScript obowiązkowy** | Cały kod frontendowy w TypeScript, strict mode |
| **Mantine v7** | Komponenty UI wyłącznie z Mantine — bez mieszania bibliotek |
| **Vite** | Build toolchain przez Vite, konfiguracja w `vite.config.ts` |
| **Stan** | React Context dla auth, lokalny stan komponentów dla UI |

### 3.3 Mobile — React Native + Expo

| Reguła | Opis |
|---|---|
| **Expo managed workflow** | Preferowany managed workflow Expo, dev-client dla natywnych modułów |
| **Skia GPU** | Warstwa HUD renderowana przez `@shopify/react-native-skia` dla 60 FPS |
| **Legend-State** | Zarządzanie stanem przez Legend-State (obserwowalny, wydajny) |
| **GPS** | `expo-location` z konfigurowalną dokładnością i oszczędzaniem baterii |

### 3.4 Baza Danych — PostgreSQL + PostGIS + TimescaleDB

| Reguła | Opis |
|---|---|
| **RLS obowiązkowe** | Każda tabela multi-tenant ma włączone Row-Level Security |
| **TimescaleDB** | Dane telemetryczne (GPS, sensory) jako hypertabele z automatyczną kompresją |
| **Materiałizowane widoki** | Rankingi miejskie, agregacje — refresh przez Celery Beat |
| **Indeksy** | Indeksy GiST dla kolumn geoprzestrzennych, B-tree dla kluczy obcych |

### 3.5 Cache — Redis

| Zastosowanie | Klucz |
|---|---|
| Sesje użytkowników | `session:<user_id>` |
| Rankingi (leaderboards) | `leaderboard:<city_id>:<segment_id>` |
| Broker Celery | Kolejki `celery`, `high_priority`, `low_priority` |
| Cache zapytań API | `api:<endpoint_hash>:<params_hash>` (TTL 60s) |

---

## 4. Standardy Bezpieczeństwa

### 4.1 Uwierzytelnianie (Authentication)

| Mechanizm | Szczegóły |
|---|---|
| **JWT Access Token** | 60 minut ważności, podpisany RS256 |
| **JWT Refresh Token** | 7 dni ważności, rotacja + blacklisting przy wylogowaniu |
| **Token blacklist** | Redis `blacklist:<jti>` z TTL = czas ważności tokenu |
| **Rate limiting** | 5 prób logowania / minutę / IP, blokada na 15 min po przekroczeniu |

### 4.2 Autoryzacja (Authorization)

- **RBAC** z 28 granularnymi uprawnieniami (np. `activities.view_activity`, `users.manage_roles`)
- **5 ról systemowych:**

| Rola | Opis |
|---|---|
| `admin` | Pełny dostęp do systemu, zarządzanie tenantami |
| `moderator` | Moderacja aktywności, zarządzanie flagami Anti-Cheat |
| `tenant_admin` | Zarządzanie tenantem, użytkownikami w ramach tenant |
| `sponsor` | Dostęp do sponsorowanych heatmap, analityka kampanii |
| `user` | Podstawowe uprawnienia użytkownika końcowego |

- Wszystkie akcje administracyjne są **logowane** z kontekstem użytkownika

### 4.3 Szyfrowanie

| Dane | Metoda |
|---|---|
| OAuth tokeny (Strava, Garmin) | Fernet (symmetric encryption) w bazie danych |
| Hasła użytkowników | Django `make_password()` (PBKDF2 + SHA-256) |
| Komunikacja | TLS 1.3, HSTS |
| Backupy bazy danych | Szyfrowane AES-256 przed transferem |

### 4.4 Audyt

- Wszystkie akcje administratora rejestrowane w `AuditLog`
- **Impersonacja śledzona** — każda sesja impersonacji ma własny wpis audytowy
- Logi audytu nieusuwalne (append-only)

### 4.5 Sekrety

- **Nigdy nie commitujemy** sekretów do repozytorium
- Używamy **Railway Variables** (produkcja) lub pliku `.env` (development)
- Plik `.env.example` zawiera szablon bez wartości produkcyjnych
- Rotacja sekretów co 90 dni

---

## 5. Standardy Kodu

### 5.1 Python (Backend)

| Reguła | Narzędzie |
|---|---|
| **PEP 8** | `ruff` jako linter i formatter |
| **Type hints** | Wszystkie sygnatury funkcji z adnotacjami typów (`mypy` w CI) |
| **Docstringi** | Google-style docstringi dla każdej publicznej funkcji/metody |
| **Długość linii** | Maksymalnie **120 znaków** |
| **Importy** | Sortowane przez `isort`, absolutne (nie relatywne) |
| **Nazewnictwo** | `snake_case` dla funkcji i zmiennych, `PascalCase` dla klas |

```python
def calculate_segment_effort(
    segment_id: int,
    user_id: int,
    start_time: datetime,
) -> SegmentEffortResult:
    """Oblicza wynik wysiłku na segmencie dla danego użytkownika.

    Args:
        segment_id: Identyfikator segmentu trasy.
        user_id: Identyfikator użytkownika.
        start_time: Czas rozpoczęcia wysiłku.

    Returns:
        SegmentEffortResult zawierający czas, moc i punktację.

    Raises:
        SegmentNotFoundError: Jeśli segment nie istnieje.
    """
    ...
```

### 5.2 TypeScript / React (Frontend)

| Reguła | Narzędzie |
|---|---|
| **Strict mode** | `tsconfig.json` z `"strict": true` |
| **Formatowanie** | Prettier z 2 spacjami, średniki obowiązkowe |
| **Linting** | ESLint z `@typescript-eslint`, `eslint-plugin-react-hooks` |
| **Komponenty** | Funkcyjne, z hookami — bez class components |
| **Nazewnictwo** | `camelCase` dla zmiennych, `PascalCase` dla komponentów, `kebab-case` dla plików CSS |

```typescript
interface SegmentEffortProps {
  segmentId: number;
  userId: number;
  onComplete: (result: SegmentEffortResult) => void;
}

export const SegmentEffort: React.FC<SegmentEffortProps> = ({
  segmentId,
  userId,
  onComplete,
}) => {
  // ...
};
```

### 5.3 Testowanie

| Warstwa | Narzędzie | Cel pokrycia |
|---|---|---|
| Backend (unit) | `pytest` + `pytest-django` | > 80% |
| Backend (integration) | `pytest` + `APITestCase` | Krytyczne endpointy 100% |
| Frontend (unit) | Vitest + React Testing Library | > 70% |
| Frontend (E2E) | Playwright | Kluczowe ścieżki użytkownika |
| Mobile | Jest + React Native Testing Library | > 60% |

### 5.4 Commity — Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

| Typ | Znaczenie |
|---|---|
| `feat:` | Nowa funkcjonalność |
| `fix:` | Poprawka błędu |
| `docs:` | Zmiany w dokumentacji |
| `chore:` | Zmiany nietechniczne (konfiguracja, CI) |
| `refactor:` | Refaktoryzacja bez zmiany zachowania |
| `test:` | Dodanie lub poprawka testów |
| `perf:` | Poprawa wydajności |
| `security:` | Poprawki bezpieczeństwa |

### 5.5 Code Review

- **Każdy PR wymaga review** przez minimum jednego uprawnionego developera
- **Brak bezpośrednich pushów** do `main` — tylko przez PR
- Kryteria akceptacji PR:
  - ✅ Wszystkie testy przechodzą (CI zielone)
  - ✅ Linter nie zgłasza błędów
  - ✅ Pokrycie kodu nie spada poniżej progu
  - ✅ Dokumentacja zaktualizowana (jeśli dotyczy)
  - ✅ Przynajmniej jedno `Approve`

---

## 6. Zasady Dokumentacji

### 6.1 Dokumentacja kodu

| Element | Wymaganie |
|---|---|
| Funkcje/metody publiczne | Docstring (Google-style dla Python, JSDoc dla TypeScript) |
| Złożona logika | Komentarz wyjaśniający "dlaczego", nie "co" |
| Stałe magiczne | Nazwane stałe z komentarzem |
| Obejścia / workarounds | Oznaczone `// FIXME:` lub `// HACK:` z datą i powodem |

### 6.2 Dokumentacja API

- **OpenAPI 3.1** auto-generowana przez `drf-spectacular`
- Dostępna pod `/api/docs/` (Swagger UI) i `/api/redoc/` (ReDoc)
- Każdy endpoint ma: opis, parametry, przykładowe request/response, kody błędów

### 6.3 Decyzje Architektoniczne (ADR)

- Wszystkie istotne decyzje architektoniczne rejestrowane w [`docs/adr/`](adr/)
- Format: [Michael Nygard ADR](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- Numeracja sekwencyjna: `adr/0001-nazwa-decyzji.md`

### 6.4 Dokumentacja użytkownika

- **W języku polskim** (użytkownicy końcowi to głównie polskojęzyczni sportowcy)
- Kluczowe dokumenty:
  - [GETTING_STARTED.md](GETTING_STARTED.md) — pierwsze kroki
  - [INSTALLATION.md](INSTALLATION.md) — instalacja i konfiguracja
  - [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — rozwiązywanie problemów

### 6.5 Aktualność dokumentacji

- **Każda zmiana funkcjonalności wymaga aktualizacji dokumentacji**
- Przegląd dokumentacji co sprint (minimum raz na 2 tygodnie)
- Linki wewnątrz dokumentacji sprawdzane automatycznie (CI check)

---

## 7. Zasady Wdrożeń

### 7.1 Gałąź `main`

| Reguła | Opis |
|---|---|
| **Gotowa do produkcji** | `main` zawsze zawiera kod, który może być bezpiecznie wdrożony |
| **Wszystkie testy muszą przejść** | CI blokuje merge, jeśli jakikolwiek test nie przechodzi |
| **Linear history** | Preferowany squash merge dla czytelności |
| **Protected branch** | `main` chroniona — wymaga PR i review |

### 7.2 Zero-Downtime Deployments

- **Migracje addytywne** — nowe kolumny z domyślnymi wartościami, usuwanie starych kolumn w kolejnej wersji
- **Feature flags** dla łamiących zmian (breaking changes)
- **Rolling updates** w Railway / Docker Swarm — stopniowa podmiana kontenerów
- Health check endpointu `/api/infra/health/` przed przekierowaniem ruchu

### 7.3 Plan Rollbacku

Każde wdrożenie musi mieć **udokumentowany i przetestowany** plan rollbacku:

1. Skrypt rollbacku migracji (jeśli dotyczy)
2. Możliwość przywrócenia poprzedniej wersji kontenera
3. Feature flag do wyłączenia nowej funkcjonalności
4. Oszacowany czas rollbacku (docelowo < 5 minut)

### 7.4 Health Checks

| Endpoint | Opis | Oczekiwany status |
|---|---|---|
| `/api/infra/health/` | Ogólny stan aplikacji | `200 OK` z `{"status": "healthy"}` |
| `/api/infra/health/db/` | Połączenie z bazą danych | `200 OK` |
| `/api/infra/health/redis/` | Połączenie z Redis | `200 OK` |
| `/api/infra/health/celery/` | Status Celery workers | `200 OK` |

### 7.5 Monitoring

| Narzędzie | Zastosowanie |
|---|---|
| **Sentry** | Śledzenie błędów backendu i frontendu |
| **Health endpoints** | Monitoring uptime (UptimeRobot / BetterStack) |
| **Prometheus + Grafana** | Metryki aplikacyjne (opcjonalne, self-hosted) |
| **Railway logs** | Logi kontenerów w produkcji |

---

## 8. Zarządzanie Danymi

### 8.1 Kopie zapasowe (Backupy)

| Element | Częstotliwość | Retencja |
|---|---|---|
| PostgreSQL (pełny backup) | Codziennie (02:00 UTC) | 30 dni |
| PostgreSQL (WAL archiving) | Ciągły | 7 dni |
| Redis (RDB dump) | Codziennie | 7 dni |
| Pliki użytkowników (media) | Codziennie | 30 dni |

- **Procedura odtwarzania testowana raz w miesiącu**
- Backupy szyfrowane AES-256 przed transferem do storage

### 8.2 Polityka Retencji Danych

| Typ danych | Okres przechowywania |
|---|---|
| Aktywności (przejazdy, treningi) | **Czas życia konta + 1 rok** po usunięciu |
| Surowa telemetria (GPS punkty) | **Anonimizowana po 90 dniach** (tylko zagregowane statystyki) |
| Dane kont użytkowników | Do momentu usunięcia konta + 30 dni (grace period) |
| Logi audytu | **Minimum 3 lata** (wymóg RODO) |
| Logi aplikacyjne | 30 dni (rotowane) |

### 8.3 Zgodność z RODO/GDPR

| Prawo użytkownika | Implementacja |
|---|---|
| **Prawo do usunięcia** | Endpoint `/api/users/me/delete/` — hard delete + anonimizacja danych zagregowanych |
| **Prawo do przenoszenia** | Eksport wszystkich danych w formacie JSON + GPX (`/api/users/me/export/`) |
| **Prawo do wglądu** | Endpoint `/api/users/me/data/` — pełny podgląd przechowywanych danych |
| **Prawo do sprostowania** | Edycja profilu, możliwość korekty danych aktywności |
| **Privacy Zones** | Użytkownik definiuje strefy (geofence), gdzie GPS jest maskowany |

### 8.4 Dane produkcyjne w development

- **Nigdy nie kopiujemy produkcyjnej bazy danych do środowisk deweloperskich**
- Używamy **seed data** (`python manage.py seed_data`) dla realistycznych danych testowych
- Alternatywnie: zanonimizowane snapshoty produkcyjne (wszystkie PII usunięte)

---

## 9. Reagowanie na Incydenty

### 9.1 Poziomy Krytyczności (Severity)

| Poziom | Definicja | Przykład |
|---|---|---|
| **P0** — Krytyczny | Całkowita niedostępność platformy | Baza danych offline, 500 na wszystkich endpointach |
| **P1** — Wysoki | Kluczowa funkcjonalność niedostępna | Nie można nagrywać aktywności, logowanie nie działa |
| **P2** — Średni | Degradacja wydajności lub częściowa niedostępność | Leaderboardy nie ładują się, opóźnienia > 5s |
| **P3** — Niski | Drobne usterki | Błąd kosmetyczny, literówka w UI |

### 9.2 Czasy Reakcji (Response Times)

| Poziom | Czas reakcji | Czas naprawy (docelowy) |
|---|---|---|
| **P0** | **1 godzina** | 4 godziny |
| **P1** | **4 godziny** | 24 godziny |
| **P2** | **24 godziny** | Następny sprint |
| **P3** | Następny sprint | Kolejny release |

### 9.3 Post-Mortem

- **Każdy incydent P0 i P1 wymaga pisemnego post-mortem**
- Format post-mortem:
  1. **Oś czasu** — co się działo, krok po kroku
  2. **Przyczyna źródłowa** — dlaczego incydent wystąpił
  3. **Wpływ** — ilu użytkowników dotkniętych, czas trwania
  4. **Działania naprawcze** — co zrobiono, aby przywrócić działanie
  5. **Działania zapobiegawcze** — co zmienić, aby incydent się nie powtórzył
  6. **Lessons learned** — wnioski na przyszłość
- Post-mortem przechowywane w [`docs/runbooks/postmortems/`](runbooks/)

### 9.4 Runbooki

Wszystkie typowe incydenty muszą mieć **runbook** w [`docs/runbooks/`](runbooks/):

| Runbook | Opis |
|---|---|
| [db_recovery.md](runbooks/db_recovery.md) | Baza danych niedostępna |
| `redis-outage.md` | Redis / cache niedostępny |
| [celery-backlog.md](runbooks/celery-backlog.md) | Kolejki Celery rosną |
| `high-cpu.md` | Wysokie zużycie CPU |
| `ssl-expiry.md` | Wygasający certyfikat SSL |
| `data-breach.md` | Podejrzenie wycieku danych |

---

## 10. Wersjonowanie

### 10.1 Semantic Versioning (SemVer)

```
MAJOR.MINOR.PATCH
```

| Wersja | Zwiększana gdy |
|---|---|
| **MAJOR** | Niekompatybilne zmiany API, usunięcie funkcjonalności |
| **MINOR** | Nowa funkcjonalność, kompatybilna wstecz |
| **PATCH** | Poprawki błędów, kompatybilne wstecz |

- Obecna wersja: **v0.2.0-rc.1** (release candidate)
- Wersja `0.y.z` oznacza fazę rozwojową przed v1.0.0

### 10.2 Wersjonowanie API

- **URL-based versioning:** `/api/v1/`, `/api/v2/`
- Nowe wersje API wprowadzane przy zmianach MAJOR
- Stare wersje API wspierane przez minimum **6 miesięcy** po wprowadzeniu nowej

### 10.3 CHANGELOG

- Prowadzony w formacie [Keep a Changelog](https://keepachangelog.com/)
- Plik: [`CHANGELOG.md`](../../CHANGELOG.md)
- Aktualizowany przy **każdym release**
- Kategorie: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`

### 10.4 Polityka Deprecacji (Deprecation)

| Element | Okres wygaszenia |
|---|---|
| Funkcje API / endpointy | **6 miesięcy** od oznaczenia jako deprecated |
| Pola w modelach | 2 releasy MINOR, potem usunięcie w MAJOR |
| Konfiguracja (env vars) | 3 miesiące od oznaczenia jako deprecated |

- Wszystkie deprecacje są **oznaczane w kodzie** adnotacją `@deprecated` / `DeprecationWarning`
- Informacja o deprecacji pojawia się w **CHANGELOG** i **release notes**
- Użytkownicy API informowani przez nagłówek `Sunset` w odpowiedziach HTTP

---

## Historia Wersji Konstytucji

| Wersja | Data | Zmiany |
|---|---|---|
| v0.1.0 | 2026-03-01 | Wersja inicjalna (robocza) |
| v0.2.0-rc.1 | 2026-05-15 | Rozszerzona wersja — dodane sekcje 8-10, tabele, runbooki, ADR |

---

> *Konstytucja 4VELO jest żywym dokumentem. Każda zmiana wymaga PR, review i akceptacji minimum dwóch współtwórców z uprawnieniami maintainer.*
