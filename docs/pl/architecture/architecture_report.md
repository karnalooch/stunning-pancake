# Kompleksowy Raport Architektoniczny: Platforma SPORT
## Skalowanie aplikacji sportowych z wykorzystaniem Pythona, TypeScripta i 4-poziomowego RBAC

### 1. Wprowadzenie i Filozofia
Platforma SPORT to wysokiej klasy ekosystem sportowy zbudowany na bazie telemetrii GPS w czasie rzeczywistym i grywalizacji. Nasza architektura wykorzystuje strategię „Power Couple”: **Python** do ciężkich operacji logicznych na backendzie (Anti-Cheat, analiza przestrzenna) oraz **TypeScript** dla solidnych, bezpiecznych typologicznie interfejsów w panelach mobilnych i administracyjnych.

### 2. Wielonajemność (Multi-tenancy) i Izolacja Danych (RLS)
Aby obsługiwać wiele niezależnych organizacji (miasta, kluby) na jednej infrastrukturze, wdrażamy model **Współdzielonej Bazy Danych i Współdzielonego Schematu**, wspierany przez PostgreSQL **Row-Level Security (RLS)**.

*   **Wymuszanie Bezpieczeństwa**: Izolacja zostaje przeniesiona z kodu aplikacji (ORM) bezpośrednio do silnika bazy danych.
*   **Mechanizm Fail-Closed**: Jeśli backend nie dostarczy kontekstu sesji (`app.current_tenant`), baza danych domyślnie odmawia dostępu (zwracając 0 wierszy).
*   **PostGIS**: Wszystkie zapytania przestrzenne (Geofencing poprzez `ST_Intersects`) są wykonywane natywnie w bazie danych, zapewniając wysoką wydajność dla tysięcy współbieżnych sportowców.

### 3. 4-poziomowa Kontrola Dostępu Oparta na Rolach (RBAC)

| Poziom | Rola | Zakres | Kluczowe Obowiązki |
| :--- | :--- | :--- | :--- |
| **Poziom 1** | **Global Admin** | Globalny (Wszystkie Organizacje) | Konfiguracja platformy, rozliczenia, tworzenie organizacji, audyty systemu. Pomija RLS (`BYPASSRLS`). |
| **Poziom 2** | **Tenant Admin** | Konkretna Organizacja | Zarządzanie klubami, tworzenie wydarzeń, konfiguracja PoI, przypisywanie moderatorów. |
| **Poziom 3** | **Moderator** | Konkretna Organizacja | Monitorowanie Anti-Cheat, weryfikacja tras, obsługa incydentów. Brak dostępu do rozliczeń. |
| **Poziom 4** | **Użytkownik** | Konkretny Zasób | Rejestracja GPS, statystyki osobiste, udział w rankingach. |

### 4. Modularna Architektura Admina
Panel Administratora został zrefaktoryzowany z monolitu do struktury **Modularnego Monorepo**.

#### 4.1 Strategia Wdrożenia (3 Oddzielne Aplikacje)
Wdrażamy trzy odrębne kontenery zbudowane z tego samego kodu źródłowego przy użyciu flagi `VITE_APP_MODE`:
1.  **Global Admin Panel** (Port 3001)
2.  **Tenant Admin Panel** (Port 3002)
3.  **Moderation Command Center** (Port 3003)

#### 4.2 Organizacja Kodu Źródłowego (`admin/src/`)
*   `core/`: Szkielet aplikacji, routing i style globalne.
*   `modules/`: Logika specyficzna dla domen (Analityka, Anti-Cheat, Moderacja, Społeczność, Tracking).
*   `shared/`: Wspólne komponenty UI, hooki i typy TypeScript.

### 5. Silnik Anti-Cheat
Platforma wykorzystuje zaawansowane algorytmy detekcji w Pythonie.
*   **Integracja BRouter**: Weryfikuje, czy trasy są zgodne z rzeczywistą topologią terenu.
*   **Analiza Wektorowa**: Wykrywa anomalie, takie jak jazda e-bike'iem lub transport pojazdem, analizując wektory przyspieszenia i korelacje tętna (jeśli są dostępne).
*   **Human-in-the-Loop**: Oflagowane sesje są automatycznie kierowane do **Aplikacji Moderatora** w celu ręcznego przeglądu i podjęcia działań dyscyplinarnych (przycinanie trasy, dyskwalifikacja).

---

### 6. Roadmapa i Strategiczne Następne Kroki (2026)

Po udanej modularyzacji ekosystemu Admina, projekt przechodzi w fazę **Utwardzania i Ekspansji**.

#### 6.1 Utwardzanie Bazy Danych (RLS i Tenancy)
*   **Cel**: Przeniesienie izolacji wielonajemcy z warstwy aplikacji (Django ORM) do warstwy bazy danych (PostgreSQL RLS).
*   **Cel końcowy**: Dostęp do danych w modelu Zero-Trust. Nawet jeśli backend zostanie naruszony, organizacja nigdy nie uzyska dostępu do danych innej organizacji.

#### 6.2 Integracja z Urządzeniami Ubieralnymi i Biometrią
*   **Cel**: Integracja SDK dla Garmin Connect, Apple HealthKit i Google Health Connect.
*   **Cel końcowy**: Pobieranie wysokiej jakości danych biometrycznych (HRV, VO2Max) w celu wzmocnienia warstwy 1.5 detekcji Anti-Cheat (korelacja Człowiek vs. Bot).

#### 6.3 Interoperacyjność GIS (OGC API)
*   **Cel**: Pełna implementacja **OGC API - Features** oraz **Moving Features**.
*   **Cel końcowy**: Umożliwienie partnerom miejskim integracji ich narzędzi GIS (QGIS, ArcGIS) bezpośrednio ze strumieniem telemetrii SPORT.

---
*Aktualizacja: 2026-04-24 | Arch-Ref: SPORT-PHASE-6-ROADMAP*
