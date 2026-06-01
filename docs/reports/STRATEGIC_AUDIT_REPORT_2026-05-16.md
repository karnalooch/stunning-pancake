# Raport Strategiczny: Standardy Zarządzania i Optymalizacje 4VELO — 2026-05-16

**Audytor:** Antigravity (AI Strategic Assistant)
**Rola:** GLOBAL_OWNER
**Perspektywa:** Hyperscale (zarządzanie platformą przy tysiącach tenantów i milionach aktywności).

---

## 1. Ocena zgodności z nowoczesnymi standardami

| Obszar | Stan obecny | Ocena | Rekomendacja |
| :--- | :--- | :---: | :--- |
| **Architektura UI** | Mantine UI (React) | 🟢 | Doskonały wybór. Spójność wizualna i szybkość działania na wysokim poziomie. |
| **Zarządzanie Multi-Tenant** | Skupienie na pojedynczym tenancie. | 🟡 | Wprowadzenie widoku "Global Overview" (mapa wszystkich miast/klientów). |
| **Obsługa danych** | `useEffect` + `useState`. | 🔴 | Przejście na **TanStack Query** (React Query) dla lepszego cachowania i UX. |
| **Bezpieczeństwo (RBAC)** | Granularne uprawnienia. | 🟢 | Standard rynkowy. Dobrze zaimplementowane logicznie. |
| **Lokalizacja (i18n)** | Mieszany język (PL/EN). | 🔴 | Pełna implementacja `react-i18next`. Platforma globalna nie może mieć "Działów" obok "Users". |

---

## 2. Zidentyfikowane obszary do optymalizacji

### A. Wydajność i Skalowalność (Hyperscale)
1.  **Bulk Actions (Akcje masowe)**: Obecnie każda operacja (np. zatwierdzenie aktywności, zaproszenie użytkownika) wymaga kliknięcia w pojedynczy rekord. Przy 10 000 aktywności dziennie, system staje się nieużywalny dla moderatora.
    *   *Zmiana:* Dodanie checkboxów na listach i akcji grupowych.
2.  **Real-time Observability**: System Health pinguje serwisy co interwał.
    *   *Zmiana:* Implementacja WebSockets dla krytycznych alertów Anti-Cheat.

### B. User Experience (UX)
1.  **Smarter Search & Filter**: Filtrowanie po typie aktywności jest podstawowe.
    *   *Zmiana:* Zaawansowane filtry (zakres dat, wynik weryfikacji, region) z możliwością zapisywania widoków.
2.  **Missing Global Context**: Jako Global Owner, dashboard powinien pokazywać sumaryczny przychód i dystans ze wszystkich miast, a nie tylko aktywnego tenanta.

---

## 3. Szczegółowe błędy do naprawy (Quick Wins)

*   **Serializer Activity List**: Na liście aktywności czas trwania (`duration`) wyświetla się jako `---`, mimo że dane są w bazie. Należy poprawić `ActivitySerializer` w backendzie, aby pole `duration` było poprawnie wyliczane/zwracane.
*   **Sidebar Interactivity**: Linki `Leaderboards` oraz `Export Center` muszą zostać podpięte pod odpowiednie komponenty (obecnie są martwymi etykietami).
*   **Heatmaps Placeholder**: Sekcja Heatmaps wymaga implementacji warstwy mapy (np. MapLibre/Leaflet) zamiast statycznego tekstu.

---

## 4. Proponowana mapa drogowa (Roadmap)

1.  **Short-term (1-2 tygodnie)**: Naprawa błędów 404, ujednolicenie języka na angielski (domyślny), poprawa listy aktywności.
2.  **Medium-term (1-2 miesiące)**: Implementacja React Query, dodanie akcji masowych, budowa Global Dashboard dla Ownera.
3.  **Long-term (6 miesięcy)**: Pełny system powiadomień push o anomaliach, integracja z narzędziami BI (np. Metabase/Superset) dla głębokiej analityki.

---
*Raport sporządzony na podstawie audytu manualnego i analizy kodu źródłowego.*
