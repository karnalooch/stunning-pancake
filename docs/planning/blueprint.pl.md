# BLUEPRINT PROJEKTU: "SPORT" (Edycja 2025/2026)
> Zunifikowana Specyfikacja Techniczna i Architektoniczna

---

## 1. Główne Dyrektywy (Żelazne Zasady)
*Cały rozwój MUSI przestrzegać tych nadrzędnych zasad:*
1.  **Niezmienny Rdzeń Silnika:** Silnik backendowy uważa się za ukończony i stabilny. Optymalizacja jest priorytetem; większe zmiany architektoniczne wymagają wyraźnej autoryzacji Właściciela Projektu.
2.  **Absolutna Zgodność Prawna:** Pełna zgodność z RODO/GDPR (Privacy-by-Design) oraz Zgodność Podatkowa (VAT OSS/JPK).
3.  **Twierdza Bezpieczeństwa i Prywatności:** Standardy PCI DSS dla płatności oraz maskowanie na urządzeniu dla telemetrii GPS nie podlegają negocjacjom.

---

## 2. Misja i Tożsamość
Wysokowydajna platforma telemetrii sportowej B2B/B2C. Ekosystem składa się z:
- **Aplikacji Mobilnej:** Towarzysz sportowca (śledzenie, grywalizacja, funkcje społecznościowe).
- **Panelu Administratora:** Centrum dowodzenia dla moderatorów i menedżerów korporacyjnych.
- **Rdzenia Backendowego:** Silnika do przyjmowania i walidacji danych o dużej przepustowości.

---

## 3. Podróż Użytkownika (Ścieżka Sportowca)
1.  **Wdrożenie (3m TTV):** Szybka rejestracja przez Passkeys/OAuth, progresywne zbieranie danych.
2.  **Moment "Aha!":** Pierwsza aktywność z wizualizacjami Skia w 120FPS i terenem 3D Mapbox.
3.  **Kształtowanie Nawyku:** Głęboka analityka przez Tremor, pętle powiadomień push OneSignal oraz interakcja klanowa Matrix.
4.  **Konwersja:** Bezproblemowe odblokowanie Premium via RevenueCat i odbiór nagród na Marketplace.

---

## 4. Architektura Backendowa i Telemetrii (Ukończony Silnik)

### 4.1 Synergia Frameworków Hybrydowych
- **Django (Auth/Admin/Logika):** Obsługuje tożsamości, zarządzanie najemcami i złożone przepływy relacyjne.
- **FastAPI (Ingestion Telemetrii):** Wysokowydajna, asynchroniczna warstwa przyjmowania dla strumieni GPS.

### 4.2 Prawda Przestrzenna (PostGIS i TimescaleDB)
- **Indeksowanie GIST i ST_Subdivide:** Zoptymalizowane zapytania przestrzenne dla geofencingu.
- **TimescaleDB Hypertables:** Wydajne przechowywanie i agregacja danych GPS z serii czasowych.

### 4.3 3-Warstwowy Potok Anti-Cheat
1.  **Fast Selection Gate (O(N)):** Filtr kinematyczny wykrywający teleporty i niemożliwe przyspieszenie.
2.  **Kontrola Biomechaniczna V-max:** Walidacja prędkości względem ludzkich ograniczeń fizycznych.
3.  **Walidacja Topologiczna BRouter:** Dopasowywanie mapy (map-matching) via Viterbi HMM do siatki OSM.

---

## 5. Architektura Mobilna (Edycja Hyper-Performance)

### 5.1 Stos Technologiczny\n- **Framework:** React Native 0.78+ (Bridgeless / Nowa Architektura).\n- **UI i Grafika:** **Tamagui v4** (Zero-runtime UI) + **React Native Skia** (grafika 120FPS).\n- **Stan i Synchronizacja:** **Legend-State** (Mikro-obserwables) + **PowerSync** (Strumieniowanie SQLite local-first).\n- **Mapy:** **MapLibre SDK** (Wektory kafelkowe open-source, architektura zero-cost).

### 5.2 Przetwarzanie na Krawędzi i Prywatność
- **Metryki Edge:** Tempo/wysokość obliczane w czasie rzeczywistym na urządzeniu.
- **Maskowanie Na Urządzeniu (Strefy v2):** Dynamiczne maskowanie promienia (DOM/PRACA) odbywa się zanim dane opuszczą urządzenie.
- **Sentry Guard:** Automatyczne usuwanie PII/GPS w raportach o awariach.

---

## 6. Architektura Panelu Administratora (Zarządzanie Hyperscale)

### 6.1 Stos Technologiczny
- **Framework:** **Next.js 15+ (App Router)** z React Server Components (RSC).
- **Stylizacja i UI:** **Tailwind CSS v4** + **shadcn/ui** + **Tremor** (Dashboardy analityczne).
- **Wizualizacje:** **deck.gl i MapLibre GL JS** (Sprzętowo akcelerowane renderowanie WebGL milionów punktów).

### 6.2 Kluczowe Funkcje
- **Centrum Moderatora:** Przegląd na podzielonym ekranie z nakładkami tras `deck.gl`.
- **Kreator Wydarzeń:** Interaktywne rysowanie geofence i zarządzanie tabelą wyników w czasie rzeczywistym.
- **Warstwa BI:** Integracja **Cube.js** dla analityki telemetrii na dużą skalę.

---

## 7. Wdrażanie Programistów: Kolejność Czytania
1.  **`docs/constitution.md`**: Zrozumienie Żelaznych Zasad i Kanonu Technologicznego.
2.  **`docs/user_journey.md`**: Zrozumienie zamierzonego doświadczenia użytkownika.
3.  **`docs/backend_architecture.md`**: Przestudiowanie przepływu przyjmowania i walidacji danych.
4.  **`docs/mobile_architecture.md`**: Przegląd silnika local-first i graficznego.
5.  **`docs/admin_architecture.md`**: Zrozumienie przepływów moderacji i BI.
