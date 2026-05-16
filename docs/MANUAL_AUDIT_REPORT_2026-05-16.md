# Raport z audytu manualnego 4VELO (Global Owner) — 2026-05-16

**Audytor:** Antigravity (AI Assistant)
**Rola:** GLOBAL_OWNER
**URL:** https://admin-production-083b.up.railway.app/

---

## 1. Podsumowanie wykonawcze
Przeprowadzono pełny przegląd funkcjonalny panelu administracyjnego pod kątem roli `GLOBAL_OWNER`. Aplikacja jest stabilna w obszarach zarządzania użytkownikami, konfiguracji RBAC oraz systemów Anti-Cheat. Zidentyfikowano jednak **3 krytyczne błędy (404)** oraz kilka problemów z interfejsem użytkownika (UI/UX), które utrudniają codzienną pracę.

---

## 2. Co NIE DZIAŁA (Krytyczne błędy)

| Funkcjonalność | Opis problemu | Szczegóły techniczne |
| :--- | :--- | :--- |
| **Szczegóły aktywności** | Kliknięcie w dowolną aktywność na liście kończy się błędem 404. | Brak endpointu: `/api/activities/sessions/{id}/detail/` |
| **Eksport do PDF** | Przycisk "Statistics PDF" w Export Center nie generuje pliku. | Błąd 404: `/api/activities/export/statistics/?format=pdf` |
| **Nawigacja Sidebar** | Linki do "Export Center" oraz "API Playground" są nieklikalne. | Brak logiki interakcji (tylko tekst w UI). Wymagane wejście przez URL. |
| **Czas trwania (Duration)** | Na liście aktywności czas wyświetla się jako `NaN min`. | Błąd parsowania danych lub brak pola `duration` w API. |

---

## 3. Co DZIAŁA (Stabilne)

*   **Dashboard**: Poprawnie wyświetla statystyki ogólne (liczba sportowców, dystans, weryfikacja).
*   **RBAC Manager**: Pełna widoczność ról i uprawnień. Zarządzanie zasobami działa.
*   **Anti-Cheat Engine**: Konfiguracja parametrów BRouter oraz czułości modelu ML działa poprawnie.
*   **Zarządzanie użytkownikami**: Lista użytkowników oraz **Audit Log** działają bez zarzutu.
*   **Tenanci i Branding**: Konfiguracja domen, kolorów oraz flag (np. heatmapy) zapisuje się poprawnie.

---

## 4. Uwagi UI/UX i brakujące elementy

*   **Identyfikacja użytkowników**: Na liście aktywności widoczne są ID użytkowników (np. "4", "5") zamiast ich nazw/loginów. Utrudnia to szybką inspekcję.
*   **Sekcja Heatmaps**: Mimo że w konfiguracji Tenanta zaznaczono "Has Heatmap Analytics", odpowiednia sekcja nie pojawia się w nawigacji.
*   **API Playground**: Strona istnieje, ale wyświetla jedynie komunikat `BOOTSTRAP_OK`. Brak interaktywnej dokumentacji Swagger/OpenAPI.

---

## 5. Rekomendacje

1.  **Naprawa endpointów**: Priorytetowo należy dodać brakujące widoki w Django dla szczegółów aktywności oraz silnika generowania PDF (np. za pomocą `ReportLab` lub `WeasyPrint`).
2.  **Poprawa Sidebar**: Naprawa komponentu nawigacji, aby obsługiwał linki do centrum eksportu i playgroundu.
3.  **Mapowanie danych**: Rozszerzenie serializera aktywności o nazwy użytkowników (`username`) zamiast samych ID.

---
*Dokument przygotowany na prośbę użytkownika w celu weryfikacji błędów zgłoszonych w wersji produkcyjnej.*
