# Architektura Techniczna Panelu Administratora

## 1. Stos Technologiczny
Panel Zarządzania został zbudowany z wykorzystaniem systemu projektowego **Obsidian** (Technical Blue / Glassmorphism) w oparciu o ultra-nowoczesny stos korporacyjny 2025/2026.

- **Framework**: **Vite + React 19** — wysokowydajna Single Page Application (SPA) zoptymalizowana pod kątem złożonego renderowania WebGL i strumieni danych w czasie rzeczywistym.
- **Stylizacja**: **Tailwind CSS v4** + **Mantine v7** — wysokiej klasy komponenty UI z pełnym wsparciem dla systemu Obsidian.
- **Wizualizacja Analityki**: **Tremor** (metryki dashboardu) + **Apache ECharts** (złożone modele danych).
- **Zarządzanie Stanem**: **Zustand** (stan UI) + **TanStack Query v5** (buforowanie i mutacje).
- **System Projektanta (Designer System)**: **@dnd-kit** do orkiestracji układu i trwałości w czasie rzeczywistym.
- **Silnik Geoprzestrzenny**: **MapLibre GL JS** w połączeniu z **deck.gl**. Ten stos wizualizacji danych oparty na WebGL pozwala na renderowanie milionów punktów telemetrii GPS i anomalii przestrzennych przy 60 FPS.

## 2. Wdrożenie Wielu Aplikacji (Strategia 3 Kontenerów)
Aby zapewnić maksymalne bezpieczeństwo i izolację, interfejs administracyjny SPORT został podzielony na trzy niezależne aplikacje webowe. Choć współdzielą ten sam kod źródłowy, są kompilowane do oddzielnych pakietów w czasie budowania za pomocą silnika **Vite**.

### 2.1 Tryby Aplikacji (`VITE_APP_MODE`)
Tryb wdrożenia jest blokowany za pomocą zmiennych środowiskowych podczas procesu budowania:
*   **GLOBAL_ADMIN** (Port 3001): Zarządzanie platformą na wysokim poziomie. Obejmuje onboarding organizacji (tenantów) i globalną analitykę.
*   **LOCAL_ADMIN** (Port 3002): Dashboard B2B dla właścicieli klubów i koordynatorów miejskich. Zakres ograniczony do konkretnego Tenant ID.
*   **MODERATOR** (Port 3003): Narzędzie operacyjne do weryfikacji Anti-Cheat i inspekcji tras.

## 3. Centrum Dowodzenia Moderatora
Wysokowydajny interfejs do przeglądania oflagowanych aktywności.
- **Układ Split-screen**: Lista oflagowanych aktywności (po lewej) + Szczegółowa mapa trasy (po prawej).
- **Interaktywna Mapa**: Renderuje problematyczną trasę poprzez nakładki `deck.gl` ze znacznikami anomalii (naruszenia prędkości, punkty teleportacji).
- **Zestaw Akcji**: Jedno kliknięcie, aby Zatwierdzić, Odrzucić lub Zbanować użytkownika poprzez punkty końcowe API Backend.

## 4. Tryb Hyper-Edit (Projektant Live)
Platforma posiada system edycji „w locie”, który pozwala administratorom na dostosowanie interfejsu bez zmian w kodzie.

### 4.1 Silnik Projektanta
- **DesignerProvider**: Kontekst React, który śledzi `isEditMode`, mapowanie niestandardowej treści i kolejność układu.
- **Orkiestracja DND**: Wykorzystuje `@dnd-kit`, aby umożliwić zmianę kolejności widżetów dashboardu (karty KPI, wykresy) w czasie rzeczywistym.
- **Edycja w linii (Inline)**: Komponent `EditableText` umożliwia bezpośrednią modyfikację nagłówków, etykiet i metryk poprzez `contentEditable`.

### 4.2 Warstwa Trwałości
- Zmiany układu i treści są serializowane i przechowywane w **LocalStorage** dla natychmiastowej trwałości.
- (Planowane) Synchronizacja manifestów projektowych z backendem poprzez **Silnik White-Label**.

## 5. Modularna Struktura Katalogów
Kod źródłowy w `admin/src/` podąża za strukturą modułową opartą na domenach:
- **`src/core/`**: Powłoka (shell), routing (React Router 7) i konfiguracja motywu.
- **`src/providers/`**: Dostawcy kontekstu (Auth, Designer, Query).
- **`src/shared/components/`**: Atomic UI library (EditableText, DraggableWidget, StatsCard).
- **`src/modules/`**: Domeny biznesowe (analityka, anti-cheat, tracking).

## 6. Bezpieczeństwo i RBAC
Panel wymusza kontrolę dostępu opartą na rolach (RBAC) poprzez strażników tras (Route Guards) po stronie klienta oraz ścisłą walidację API na backendzie:
- **`GLOBAL_ADMIN`**: Pełny nadzór nad systemem i zarządzanie organizacjami.
- **`MODERATOR`**: Skoncentrowany dostęp do pakietu Anti-Cheat i weryfikacji.
- **`TENANT_ADMIN`**: Zakres dostępu ograniczony do danych miejskich/korporacyjnych.

---
*Status: GOTOWY DO PRODUKCJI (Vite SPA) | Wersja Architektury: 3.2.0*
