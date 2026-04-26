# Strategia „Power Couple”: Python i TypeScript

## 1. Wizja
Platforma SPORT wykorzystuje architekturę „Power Couple”: łączenie analitycznej potęgi **Pythona** na backendzie z bezpiecznymi typologicznie i responsywnymi interfejsami **TypeScript** na frontendzie. Strategia ta zapewnia szybki rozwój, wysoką wydajność i absolutną niezawodność systemu.

## 2. Rola Pythona (Mózg)
Python został wybrany dla backendu ze względu na swój niezrównany ekosystem dla danych przestrzennych i uczenia maszynowego.

*   **Django i DRF**: Zapewnia gotowy panel administracyjny, solidne migracje i główną logikę biznesową B2B.
*   **FastAPI**: Obsługuje wysokowydajne przyjmowanie telemetrii w czasie rzeczywistym przy użyciu asynchronicznego I/O (ASGI).
*   **Analiza Przestrzenna**: Biblioteki takie jak `GeoPandas`, `Shapely` i `BRouter` pozwalają nam wykonywać złożone kontrole anti-cheat i dopasowywanie tras, które byłyby niemożliwe w prostszych frameworkach.
*   **Integracja z PostGIS**: Python działa jako koordynator dla naszej przestrzennej bazy danych PostGIS, zarządzając RLS (Row-Level Security) i indeksowaniem przestrzennym.

## 3. Rola TypeScript (Tarcza)
TypeScript jest używany w Panelu Administratora i Aplikacji Mobilnej (React Native), aby zapewnić jednolite, bezpieczne typologicznie środowisko programistyczne.

*   **Przewidywalność**: Współdzielone definicje typów między API a interfejsem użytkownika eliminują błędy wynikające z niedopasowania danych.
*   **Architektura Modularna**: Nasz Panel Administratora jest zorganizowany w moduły specyficzne dla domen (Analityka, Anti-Cheat, Moderacja), co zapewnia łatwość utrzymania kodu wraz z jego rozwojem.
*   **Wysokowydajny UI**: Wykorzystanie silników takich jak MapLibre GL JS i renderowania opartego na Canvas do wizualizacji tysięcy sportowców na żywo przy 60 FPS.

## 4. Kluczowe Punkty Integracji
*   **JWT i RBAC**: Jednolity przepływ uwierzytelniania, w którym role zdefiniowane w Pythonie są ściśle egzekwowane w interfejsie TypeScript.
*   **Synchronizacja Schematów**: Użycie interfejsów TypeScript do odzwierciedlenia modeli Pydantic i Django, zapewniając spójność całego stosu (full-stack integrity).
*   **Współdzielona Logika**: Logika domenowa (taka jak obliczenia prędkości lub normalizacja współrzędnych) może być koncepcyjnie współdzielona, co redukuje błędy tłumaczenia między zespołami backendu i frontendu.

---
*Wersja Dokumentu: 1.2.0 | Język: Polski*
