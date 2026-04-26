# ANALIZA LICENCJI: Zarządzanie Ryzykiem Prawnym

Ten dokument analizuje licencje komponentów użytych w projekcie SPORT pod kątem bezpieczeństwa komercyjnego.

## 1. Fundament Open Source
Platforma SPORT opiera się wyłącznie na komponentach z licencjami permisywnymi, co gwarantuje brak konieczności udostępniania kodu źródłowego modyfikacji (brak ryzyka wirusowego GPL).

| Komponent | Licencja | Zgodność |
| :--- | :--- | :--- |
| **Backend (Django/FastAPI)** | BSD/MIT | ✅ Pełna |
| **Frontend (React/Vite)** | MIT | ✅ Pełna |
| **Mobile (React Native)** | MIT | ✅ Pełna |
| **Mapy (MapLibre)** | BSD | ✅ Pełna |
| **Baza (PostgreSQL)** | PostgreSQL | ✅ Pełna |

## 2. Izolacja PostGIS (GPL)
PostGIS jest licencjonowany na GPL, jednak jako oddzielna usługa bazodanowa połączona standardowym protokołem SQL, nie nakłada obowiązku udostępniania kodu aplikacji. SPORT utrzymuje ścisłą izolację między logiką biznesową a rozszerzeniami bazodanowymi.

## 3. PowerSync i Skalowanie
PowerSync używa licencji typu "Source-Available". Jest darmowy dla małych i średnich wdrożeń, jednak przy skali enterprise (np. obsługa całego kraju) może wymagać licencji komercyjnej.

---
*Ostatnia aktualizacja: 2026-04-26*
