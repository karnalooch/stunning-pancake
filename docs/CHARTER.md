# KONSTYTUCJA PROJEKTU (PROJECT CHARTER) — SPORT v0.1.0-beta.2

> "Kontrakt ze samym sobą: Suwerenność poprzez kod, wydajność poprzez dyscyplinę."

## 1. Uzasadnienie Biznesowe
SPORT to wysokowydajna platforma grywalizacji sportowej B2B/B2C. Rozwiązuje problem niskiego zaangażowania w wyzwania miejskie i korporacyjne poprzez dostarczenie telemetrii czasu rzeczywistego, zaawansowanego systemu Anti-Cheat oraz immersyjnego interfejsu HD-2D.

**Propozycja wartości:** 
- Dla Miast/Korporacji: Gotowy ekosystem do aktywizacji mieszkańców/pracowników z pełnym brandingiem (White-Label).
- Dla Sportowców: Immersyjna gra w świecie rzeczywistym z gwarancją uczciwości wyników.

## 2. Cele i KPI (SMART)
- **Wydajność**: Stabilna obsługa ruchu beta testerów (Django + Redis).
- **UX**: Płynne 60 FPS w aplikacji mobilnej przy renderowaniu HUD (Skia GPU).
- **Weryfikacja**: 4-warstwowy system Anti-Cheat (Kinematic Gate → V-max → BRouter → Viterbi HMM).
- **Dostępność**: Solar Mode (kontrast 12:1) umożliwiający pracę w pełnym słońcu.

## 3. Wysokopoziomowy Zakres (MVP vs Full)
### W zakresie (In-Scope):
- Mobilny tracking GPS (iOS/Android).
- Silnik walidacji tras (BRouter/OSM) — warstwy 1-2 na produkcji.
- Panel Admina (Mantine v9 + Tremor) do moderacji i BI.
- System nagród (Voucher Marketplace).
- Integracje Wearable (Garmin/Strava) — stub, do implementacji.

### Poza zakresem (Out-of-Scope):
- Własny sprzęt wearable (wyłącznie integracje).
- Systemy płatności inne niż Stripe (na etapie MVP).
- Pełna obsługa sportów stacjonarnych (np. siłownia).

## 4. Rejestr Ryzyk i Ciągłość
- **Techniczne**: Przerwy w dostawie GPS (rozwiązanie: Offline-First SQLite).
- **Prawne**: RODO/GDPR (rozwiązanie: Privacy Zones v2, maskowanie na urządzeniu).
- **Operacyjne**: Awaria bazy (rozwiązanie: Replikacja + Runbooki odzyskiwania).

## 5. Strategia Technologiczna
- **Rdzeń**: Django (REST API) + FastAPI (telemetria — dev only).
- **Mobile**: React Native (Expo, Tamagui, Skia, Legend-State).
- **Data**: PostgreSQL + PostGIS + Redis.

## 6. Manifest Wizualny (SSOT: `docs/VISUAL_MANIFESTO.md`)

Platforma SPORT odrzuca klasyczne UI na rzecz immersyjnej estetyki **HD-2D Gaming Fusion**, łączącej trzy style retro-gamingowe:

| Inspiracja | Co wnosimy |
|---|---|
| **Octopath Traveler** | Miękki bloom, kinowe oświetlenie, efekt tilt-shift, dynamiczne cieniowanie, floating idle animations |

### Zasady żelazne:
- **Radius: 0** — żadnych zaokrągleń. Wszystko prostokątne.
- **Outline: 1px solid black** — każdy element ma czarny obrys.
- **Shadow: 4px offset, blur 0** — twarde cienie, bez rozmycia.
- **Font**: Press Start 2P (pixel-perfect).
- **Animacje**: Spring physics (damping 14, stiffness 100), typewriter 40ms/znak, floating idle ±8px.
- **Kontrast**: Solar Mode 12:1 — czytelność w pełnym słońcu.

---

Czym jest ta aplikacja?

To jest aplikacja sportowa z elementami grywalizacji, która zbiera dane telemetryczne (GPS, czujniki) od użytkowników, przetwarza je i prezentuje w formie wizualnej, zbliżonej do gier komputerowych. System umożliwia organizację wydarzeń sportowych online oraz zbieranie danych, które mogą być analizowane i wizualizowane.

Jakie są główne funkcje?

Zbieranie i przetwarzanie danych telemetrycznych (GPS, czujniki).
Organizację wydarzeń sportowych online.
Wizualizację danych w formie graficznej.
System może również obejmować analizę tych danych i prezentację wyników w atrakcyjnej formie.
