# PLAN IMPLEMENTACJI: Modernizacja Globalnego Panelu Administratora (Global Admin)

Niniejszy dokument opisuje strategiczne kroki niezbędne do przekształcenia obecnego Globalnego Panelu Admina z makiety w gotowy do produkcji zestaw narzędzi do zarządzania platformą SPORT.

## 🏛 Faza 0: Fundamenty (ZAKOŃCZONE)
- [x] Migracja do **Vite 8 + React 19**.
- [x] Integracja **Tailwind CSS v4** z `@tailwindcss/vite`.
- [x] System projektowy **Cyber-Monolith V3.0**: Styl Windows 11 Fluent/Glassmorphism.
- [x] Silnik wielotrybowy: Wsparcie dla `GLOBAL_ADMIN`, `LOCAL_ADMIN` i `MODERATOR`.

## 🛠 Faza 1: Shell i Główna Nawigacja (Tydzień 1)
*Cel: Budowa interfejsu desktopowego typu "OS-like".*

1.  **Implementacja AppShell**:
    - Budowa trwałego **paska zadań w stylu Windows** na dole ekranu do szybkiego przełączania aplikacji.
    - Implementacja **paska bocznego (Sidebar) z efektem szkła** dla głównych kategorii nawigacji (Platforma, Najemcy, Użytkownicy, System).
2.  **Routing Oparty na Rolach**:
    - Konfiguracja `react-router-dom` do ochrony ścieżek na podstawie `VITE_APP_MODE`.
    - Zapewnienie, że `GLOBAL_ADMIN` widzi widoki "Tworzenie Najemcy" i "Audyty Systemowe".
3.  **Rdzeń DesignerProvider**:
    - Implementacja `DesignerProvider` do zarządzania stanem "Hyper-Edit Mode".

## 📊 Faza 2: Globalne Centrum Zarządzania (Tydzień 2)
*Cel: Wyświetlanie kluczowych wskaźników (KPI) i stanu zdrowia platformy.*

1.  **Dashboard Tremor**:
    - Integracja biblioteki **Tremor** dla gęstych danych KPI: Przychody, MAU, Całkowity Dystans.
    - Budowa widżetu "System Pulse" pokazującego obciążenie Redis i TimescaleDB w czasie rzeczywistym.
2.  **Integracja Deck.gl**:
    - Implementacja **Globalnej Mapy Aktywności**: Wizualizacja gęstych chmur punktów ostatnich aktywności sportowych na całym świecie.
    - Dodanie detekcji "Hotspotów" dla popularnych tras miejskich.

## 🏢 Faza 3: Zarządzanie Najemcami i Użytkownikami (Tydzień 3)
*Cel: Operacyjna kontrola nad instancjami white-label.*

1.  **Tenant CRUD**:
    - Utworzenie zaawansowanej tabeli danych (używając Mantine) do zarządzania najemcami.
    - Implementacja **Kreatora Onboardingu Najemcy**: Konfiguracja schematu Postgres, bucketów S3 i niestandardowych tokenów brandingowych dla nowych miast/klientów.
2.  **Zestaw Audytu Użytkowników**:
    - Budowa globalnej wyszukiwarki użytkowników z głęboką historią telemetrii.
    - Implementacja "Trybu Impersonacji" do debugowania problemów użytkowników (bezpieczny i audytowany).

## 🎨 Faza 4: System Hyper-Edit (Tydzień 4)
*Cel: Umożliwienie dostosowywania brandingu i układu bez użycia kodu (no-code).*

1.  **Zestaw Narzędzi Designera**:
    - Budowa komponentu `EditableText` dla natychmiastowych zmian w treściach.
    - Integracja `@dnd-kit`, aby umożliwić Globalnym Adminom zmianę kolejności widżetów na dashboardzie.
2.  **Wstrzykiwanie Stylów**:
    - Implementacja **Edytora Brandingu**: Regulacja kolorów głównych, promieni zaokrągleń i poziomu przezroczystości szkła (glassmorphism).
    - Zapisywanie tych tokenów w tabeli `branding` w celu dynamicznego wstrzykiwania po stronie klienta.

## 🔒 Faza 5: Bezpieczeństwo i Obserwowalność (Ciągłe)
*Cel: Zapewnienie integralności platformy.*

1.  **Widok Logów Audytowych**:
    - Dedykowany eksplorator logów do śledzenia każdego działania administracyjnego.
2.  **Kontrola Anti-Cheat**:
    - Globalny przełącznik czułości Anti-Cheat dla wszystkich najemców.
    - Widok "God Mode" dla analizy biomechanicznej podejrzanych tras w czasie rzeczywistym.

---
**Stos Techniczny:**
- **UI**: Mantine v7 + Tailwind 4.
- **Wykresy**: Tremor + ECharts.
- **Mapy**: MapLibre GL + deck.gl.
- **Stan**: Zustand + TanStack Query.
