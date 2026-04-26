# Strategia „Power Couple”: Python i TypeScript

## 1. Wizja
Platforma SPORT wykorzystuje architekturę „Power Couple”: łączenie analitycznej potęgi języka **Python** na zapleczu (backend) z bezpiecznymi pod względem typów, responsywnymi interfejsami w języku **TypeScript** na froncie. Strategia ta zapewnia szybki rozwój, wysoką wydajność i absolutną niezawodność systemu.

## 2. Rola Pythona (Mózg)
Python został wybrany dla backendu ze względu na swój bezkonkurencyjny ekosystem dla danych przestrzennych i uczenia maszynowego.

*   **Django i DRF**: Zapewnia doświadczenie „Admina po wyjęciu z pudełka”, solidne migracje i główną logikę biznesową B2B.
*   **FastAPI**: Obsługuje wysoką współbieżność przyjmowania telemetrii w czasie rzeczywistym przy użyciu asynchronicznego wejścia/wyjścia (ASGI).
*   **Analiza przestrzenna**: Biblioteki takie jak `GeoPandas`, `Shapely` i `BRouter` pozwalają nam przeprowadzać złożone kontrole anty-cheat i dopasowywanie tras, które byłyby niemożliwe w prostszych frameworkach.
*   **Integracja PostGIS**: Python działa jako koordynator dla naszej przestrzennej bazy danych PostGIS, zarządzając RLS (Row-Level Security) i indeksowaniem przestrzennym.

## 3. Rola TypeScriptu (Tarcza)
TypeScript jest używany w Panelu Admina i aplikacji mobilnej (React Native), aby zapewnić ujednolicone, bezpieczne środowisko programistyczne.

*   **Przewidywalność**: Wspólne definicje typów między API a interfejsem użytkownika eliminują „niespodzianki w czasie wykonywania” i błędy niedopasowania danych.
*   **Architektura modułowa**: Nasz Panel Admina jest zorganizowany w moduły specyficzne dla domeny (Analityka, Anti-Cheat, Moderacja), co zapewnia łatwość utrzymania bazy kodu w miarę jej skalowania.
*   **Wysokowydajny interfejs użytkownika**: Wykorzystanie silników takich jak MapLibre GL JS i renderowania opartego na Canvas do wizualizacji tysięcy sportowców na żywo w 60 FPS.

## 4. Kluczowe punkty integracji
*   **JWT i RBAC**: Zunifikowany przepływ uwierzytelniania, w którym role zdefiniowane w Pythonie są ściśle egzekwowane w interfejsie TypeScript.
*   **Synchronizacja schematów**: Używanie interfejsów TypeScript do odzwierciedlenia modeli Pydantic i Django, zapewniając integralność całego stosu (full-stack).
*   **Wspólna logika**: Logika domeny (taka jak obliczenia prędkości lub normalizacja współrzędnych) może być koncepcyjnie współdzielona, co redukuje błędy tłumaczenia między zespołami backendu i frontendu.

---
*Wersja dokumentu: 1.2.0 | Język: Polski*
