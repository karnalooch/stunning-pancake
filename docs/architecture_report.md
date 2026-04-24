# Komprehensywny Raport Architektoniczny: Projektowanie i Wdrożenie Skalowalnej Aplikacji Sportowej

## 1. Wstęp i Filozofia Systemu
Nowoczesny ekosystem aplikacji sportowych, oparty na zaawansowanym przetwarzaniu danych geolokalizacyjnych w czasie rzeczywistym oraz grywalizacji, wymaga wdrożenia wysoce zoptymalizowanej architektury systemowej. Decyzja o oparciu fundamentów projektu na połączonych siłach języków Python (w warstwie backendowej) oraz TypeScript (w warstwie interfejsów webowych i mobilnych) stanowi strategiczny krok w kierunku budowy otwartego, modularnego i wysoce skalowalnego oprogramowania.

## 2. Paradygmat Wielodostępności (Multi-tenancy) i RLS
Platforma sportowa obsługująca wiele niezależnych wydarzeń musi funkcjonować w architekturze wielodostępnej (multi-tenant). Wybranym modelem jest **Shared Database, Shared Schema** z wykorzystaniem **Row-Level Security (RLS)** w PostgreSQL.

*   **Bezpieczeństwo**: RLS przesuwa odpowiedzialność za izolację danych z kodu aplikacji (ORM) bezpośrednio do silnika bazy danych.
*   **Fail-closed**: Jeśli backend nie dostarczy zmiennej sesyjnej `app.current_tenant`, baza danych odmówi dostępu (zwróci 0 wierszy).

## 3. Czteropoziomowy Model RBAC (Role-Based Access Control)

### Poziom 1: Superuser / Global Admin (Zarządzanie Wszystkim)
*   **Zakres**: Cała infrastruktura chmurowa, wiele tenantów.
*   **Uprawnienia**: Jako jedyny posiada atrybut `BYPASSRLS`. Definiuje nowe instancje tenantów, konfiguruje globalne parametry i audytuje system.

### Poziom 2: Tenant Admin / Lokalny Administrator (Właściciel Firmy)
*   **Zakres**: Wyłącznie własna organizacja (silos informacyjny).
*   **Uprawnienia**: Zarządzanie wydarzeniami (EventCreator), punktami POI, regulaminem oraz mianowanie Moderatorów.

### Poziom 3: Moderator (Osoba Wspierająca)
*   **Zakres**: Higiena cyfrowa i uczciwość sportowa (Fair Play) wewnątrz organizacji.
*   **Uprawnienia**: Dedykowany widok **Anti-Cheat View**. Weryfikacja anomalii, analiza śladów GPX, podejmowanie decyzji o dyskwalifikacji (bez dostępu do danych billingowych).

### Poziom 4: Użytkownik / Sportowiec
*   **Zakres**: Własny profil i wygenerowane trasy.
*   **Uprawnienia**: Rejestrowanie telemetrii, analiza własnych statystyk, udział w rankingach.

## 4. Technologie i Mechanizmy Detekcji
*   **Backend**: Django (DRF) dla logiki biznesowej i zarządzania rolami + FastAPI dla wysokowydajnej telemetrii (ASGI).
*   **Geo-weryfikacja**: Wykorzystanie bibliotek `GeoPandas`, `Shapely` oraz silnika `BRouter` do weryfikacji wektorów przyspieszeń i walki z oszustwami (e-bike, transport samochodowy).
*   **Frontend**: TypeScript, React, Zustand (stan UI) oraz TanStack Query (zarządzanie danymi serwerowymi).

---
*Opracowano na podstawie wytycznych architektury SPORT 2026.*
