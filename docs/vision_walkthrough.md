# WIZJA PROJEKTU: "KARMIMY WIEDZĄ"

Poniższy dokument przedstawia kierunek wizualny i techniczny platformy. Całość oparta jest na rygorystycznie dobranym stosie Open Source, gwarantującym bezpieczeństwo komercyjne.

## 1. Koncepcja Wizualna (Management Panel)

Zaprojektowany interfejs panelu administracyjnego (Web/Windows) stawia na przejrzystość danych telemetrycznych oraz nowoczesną estetykę dark mode / glassmorphism.

![Admin Panel Mockup](file:///C:/Users/akarn/.gemini/antigravity/brain/eb4a7fd7-307b-4760-b580-bbe540ddb5af/admin_panel_mockup_1776964330807.png)

> [!TIP]
> **Aestetyka Premium**: Wykorzystanie rozmyć tła (backdrop-filter) oraz żywych akcentów kolorystycznych pozwala na stworzenie narzędzia klasy korporacyjnej, które motywuje do pracy z danymi.

## 2. Architektura "Single Source of Truth" (Mobilna)

Wdrożenie strategii **Offline-First** jest kluczowe dla stabilności śledzenia GPS.

1.  **Lokalna Baza**: Każdy punkt GPS trafia najpierw do SQLite.
2.  **Synchronizacja**: Background Task wykrywa dostępność sieci i wysyła paczki danych (batching) do serwera Traccar.
3.  **Mapy**: MapLibre GL renderuje kafelki wektorowe bezpośrednio z plików mbtiles przechowywanych na urządzeniu.

## 3. Pierwsze Kroki Techniczne

Zalecana kolejność prac deweloperskich:

1.  **Struktura Repozytorium**: Inicjalizacja projektu Flutter w architekturze monorepo lub z wydzielonymi pakietami dla rdzenia telemetrycznego.
2.  **Backend Telemetrii**: Uruchomienie lokalnej instancji Traccar (Docker) do testów komunikacji WebSocket.
3.  **Walidacja BRouter**: Przygotowanie skryptów testowych GPX -> BRouter w celu weryfikacji algorytmu Anti-Cheat.

---

### Czy chcesz, abym przygotował teraz szkielet projektu Flutter dla Panelu Zarządzania, czy skupimy się na konfiguracji backendu (Traccar/BRouter)?
