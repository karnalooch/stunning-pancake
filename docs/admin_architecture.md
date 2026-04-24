# Architektura Paneli Administracyjnych (SPORT Phase 5+)

## 1. Koncepcja Trzech Aplikacji (Multi-App Strategy)
W celu zapewnienia najwyższego poziomu izolacji i bezpieczeństwa, system SPORT został rozdzielony na trzy niezależne aplikacje webowe budowane z jednego kodu źródłowego (`src/admin`).

### 1.1 Izolacja Trybów (APP_MODE)
Podczas budowania obrazów Docker, wstrzykiwana jest zmienna środowiskowa `VITE_APP_MODE`, która trwale konfiguruje przeznaczenie danej instancji:

*   **GLOBAL_ADMIN** (Port 3001): Panel zarządczy dla właścicieli platformy.
*   **LOCAL_ADMIN** (Port 3002): Panel B2B dla właścicieli klubów i miast (Tenant Admin).
*   **MODERATOR** (Port 3003): Narzędzie operacyjne dla służb weryfikacyjnych (Anti-Cheat).

## 2. Mapa Portów i Kontenerów
Każda aplikacja działa jako osobny kontener Nginx:

| Serwis | Kontener | Port Host | Rola |
| :--- | :--- | :--- | :--- |
| `global_admin` | `sport_global_admin` | 3001 | Superuser |
| `tenant_admin` | `sport_tenant_admin` | 3002 | Lokalny Admin |
| `moderator` | `sport_moderator` | 3003 | Moderator |

## 3. Struktura Widoków i Uprawnień (RBAC)
Aplikacja wykorzystuje `react-router-dom` do dynamicznego serwowania tras w zależności od trybu `APP_MODE`:

*   **Wspólne**: `Live Tracking`.
*   **Global Admin**: `Analytics (Global)`, `Anti-Cheat`, `Tenant Management`.
*   **Local Admin**: `Analytics (Tenant)`, `Events`, `Clubs`.
*   **Moderator**: `Moderation Center`, `Anti-Cheat`.

## 4. Bezpieczeństwo i Kompilacja
Dzięki zastosowaniu warunkowego renderowania tras na etapie kompilacji (Vite), kod nieużywanych widoków jest optymalizowany, a użytkownik (np. Moderator) nie posiada w swoim bundle'u komponentów do zarządzania finansami platformy.

---
*Ostatnia aktualizacja: 2026-04-24*
