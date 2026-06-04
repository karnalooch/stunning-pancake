# 🗺️ Portal administracyjny 4VELO v3.0 Plan działania i specyfikacja architektoniczna

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../admin/ROADMAP_V3.md) |
| **canonical_path** | docs/pl/admin/ROADMAP_V3.md |
---

| | |
|--|--|
| **Stan** | ✅Aktywny |
| **Rola właściciela** | Administrator / Lider Frontendu |
| **Ostatnia recenzja** | 2026-06-03 |
| **Publiczność** | Inżynierowie frontendu, backendu |
| **Indeks** | [ADMIN_INDEX.md](./ADMIN_INDEX.md) |

W tym dokumencie określono projekty architektoniczne dla **Portalu administratora/właściciela 4VELO (React 19 + Mantine v9)** — informacje dotyczące inżynierii backendu i frontendu.

---

## 🏛️ 1. Zreorganizowana architektura nawigacji (pasek boczny z 6 sekcjami)

Nawigacja na pasku bocznym w `Layout.tsx` została przebudowana w celu wyeliminowania zbędnych list menu i logicznego grupowania elementów według domeny biznesowej.```mermaid
graph TD
    A[Admin Portal Sidebar] --> B[1. Overview]
    A --> C[2. Management]
    A --> D[3. Operations]
    A --> E[4. Sponsorship & Rewards]
    A --> F[5. Analytics & Feedback]
    A --> G[6. System Settings]

    B --> B1[Dashboard]
    B --> B2[Smartphone Simulator]

    C --> C1[Tenants & Branding]
    C --> C2[Users Manager Drawer]
    C --> C3[Departments]

    D --> D1[Activities]
    D --> D2[Anti-Cheat SOC Console]
    D --> D3[Events Manager CRUD]

    E --> E1[Sponsor POI Dashboard]
    E --> E2[Sponsorship Analytics]
    E --> E3[Rewards & Vouchers]

    F --> F1[Department Performance]
    F --> F2[Global Heatmaps]
    F --> F3[Beta Feedback Logs]

    G --> G1[System Settings]
    G --> G2[RBAC Permissions]
    G --> G3[Feature Flags]
    G --> G4[Leaderboards]
    G --> G5[Export Center]
    G --> G6[API Playground]
```### Domeny biznesowe:
1. **Przegląd**: najważniejsze wizualne podsumowania. Konsoliduje **Globalny pulpit nawigacyjny** i **Symulator smartfona**.
2. **Zarządzanie**: Jednostki systemowe wysokiego poziomu, w tym **Najemcy i Branding**, nowy **Menedżer użytkowników** i **Działy**.
3. **Operacje**: Podstawowe przedmioty sportowe na co dzień: **Aktywności**, **Konsola SOC zapobiegająca oszustwom** i **Menedżer wydarzeń CRUD**.
4. **Sponsorowanie i nagrody**: Specjalistyczny portal dla sponsorów B2B, zarządzający **POI sponsorów (Edytor map)**, **Analiza sponsoringu** i **Kupony**.
5. **Analiza i opinie**: Narzędzia analizy biznesowej przeznaczone tylko do odczytu, w tym **Wykresy wydajności działów**, **Globalne mapy cieplne** i **Dzienniki opinii z wersji beta**.
6. **Ustawienia systemu**: Administracja niskiego poziomu: **Ustawienia systemu**, **Menedżer RBAC**, **Flagi funkcji**, **Tabele wyników**, **Centrum eksportu** i interaktywny **API Playground**.

---

## 👥 2. Moduł użytkowników o wysokiej wydajności i edytor profili szuflad

### Wydajność po stronie klienta
Aby utrzymać responsywność 60 klatek na sekundę przy **500+ użytkownikach**, wdrażamy **paginację w pamięci** i optymalizację renderowania przy użyciu wysokowydajnych `<Table>` i `<Pagination>` firmy Mantine:
* **Początkowy ładunek**: pobierz wszystkich użytkowników w jednym zoptymalizowanym żądaniu JSON.
* **Filtrowanie klienta**: Dopasuj wyszukiwanie (nazwa użytkownika, adres e-mail, rola, najemca) i filtruj wyłącznie w pamięci przy użyciu standardowych struktur tablicowych.
* **Okno paginacji**: Renderuj tylko 15–20 wierszy na raz w DOM. Zmniejsza to opóźnienie renderowania z $>1,5 $s do $<50$ms.

### Edytor profili szuflad (GLOBAL_OWNER i TENANT_ADMIN)
Gdy administrator kliknie wiersz użytkownika, otwiera się zaawansowana przesuwana „<Szuflada>”. Posiada dwa tryby: tryb telemetryczny tylko do odczytu i tryb edycji.

#### Modyfikowalne pola:
* **Tożsamość podstawowa**: Nazwa użytkownika i adres e-mail.
* **Przypisanie roli**: Lista rozwijana (GLOBAL_OWNER, TENANT_ADMIN, TENANT_MODERATOR, SPONSOR, ATHLETE). *Edycja roli jest ograniczona przez reguły RBAC (np. TENANT_ADMIN nie może utworzyć GLOBAL_OWNER).*
* **Blokada konta („is_active”)**: Niestandardowy przełącznik przełączający premium. Przełączenie wywołuje punkt końcowy `/users/<pk>/update/`, aby natychmiast zablokować/odblokować dostęp.
* **Informacje o profilu niestandardowym**: Dodano obsługę edycji niestandardowych **obrazów awatarów** (adres URL lub przesyłanie plików) i tekstu **opisu biografii**.
* **Podpanel resetowania hasła**: Interaktywne pole hasła ze standardowymi wskaźnikami walidacji, wywołujące funkcje resetowania hasła zaplecza.

---

## 🏆 3. Pulpit CRUD wydarzeń

Konwertowanie listy zdarzeń tylko do odczytu na pełny pakiet administracyjny z ochroną na poziomie wiersza (RLS) dla wielu dzierżawców.

### Projekt komponentu:
* **Żywe odznaki stanu**:
  - `PROJEKT`: Szary
  - `OPUBLIKOWANE`: Cyjan
  - `AKTYWNY`: Żywa zieleń
  - `UKOŃCZONO`: Indygo
  - `ANULOWANY`: Czerwony
* **Pole automatycznego generowania ślimaka**:
  - Wpisanie w polu „Tytuł” automatycznie wyświetli komunikat przyjazny dla SEO (np. *"Tour de Warszawa"* $\rightarrow$ `"tour-de-warszawa"`).
* **Zakres dla wielu dzierżawców**:
  - `GLOBAL_OWNER` może edytować wszystkie wydarzenia.
  - `TENANT_ADMIN` jest ograniczony do wydarzeń w ich mieście/najemcy.
  - Po utworzeniu nowe wydarzenie automatycznie dziedziczy identyfikator dzierżawy zalogowanego administratora.
* **Interaktywne selektory dynamiczne**:
  - ** Lista najemców przeciwnika**: W przypadku meczów „INTER_TENANT” (miasto kontra miasto), selektor najemców przeciwnika dynamicznie wysyła zapytania do listy baz danych `/users/tenants/`, aby wypełnić aktywne wybory miast, umożliwiając łatwe konfiguracje dopasowywania.
  - **Dynamiczny selektor bitew klubowych**: Wysyła zapytania do klubów w dzierżawcy w celu zapełnienia pól bitew klubowych.
  - **Obszar tekstowy obszaru GeoJSON**: Proste okno JSON z wbudowaną walidacją schematu (sprawdzanie poprawności współrzędnych geometrii wielokąta).

---

## 🏃 4. Inspektor tras aktywności GPS i telemetria prędkości

Zastępuje statyczną, niefunkcjonalną grafikę aktywności w pełni interaktywnym narzędziem do wyznaczania tras, wykorzystującym MapLibre GL.### Architektura:
* **Warstwa mapy wektorowej**: Osadza kontener MapLibre GL ładujący ciemną mapę bazową OpenFreeMap (`tiles.openfreemap.org/styles/dark`).
* **Nakładka trajektorii trasy**:
  - Wykreśla współrzędne `route_coords`.
  - Koduje wektor ścieżki kolorami w oparciu o status weryfikacji: zweryfikowane działania są wyróżnione jasnym, świecącym neonowym cyjanem, podczas gdy niezweryfikowane lub oflagowane działania są podświetlone gorącym pomarańczowo/czerwonym, aby zwrócić uwagę operatorów SOC.
* **Telemetria profilu prędkości / wysokości**:
  - Wykorzystuje mikrowykres telemetrii wizualnej, wyświetlający prędkość (km/h) i wysokość (w metrach) na dystansie biegu.
  - Najechanie kursorem na wykres prędkości powoduje dynamiczne przesuwanie świecącego kursora kropkowego wzdłuż ścieżki GPS MapLibre, pokazując dokładną lokalizację geograficzną, w której wystąpiły skoki prędkości lub zmiany wysokości.

---

## 🏢 5. Symulator na żywo smartfona z białą marką

Wysokiej klasy edytor wizualny pokazujący branding najemców w czasie rzeczywistym.```
┌─────────────────────────────────┐      ┌───────────────────────────┐
│  🎨 White-Label Config Panel    │      │   📱 Interactive Phone    │
│  ─────────────────────────────  │      │   ┌───────────────────┐   │
│  City Name: [ Warszawa        ] │      │   │ 🔋 12:00    📶 5G │   │
│                                 │      │   │ ───────────────── │   │
│  Primary Color:   [ #6366F1 ]   │ ───> │   │   Warszawa 4VELO  │   │
│  Secondary Color: [ #8B5CF6 ]   │      │   │   [ Start Ride ]  │   │
│                                 │      │   │   [ Leaders  ]    │   │
│  Logo Upload:     [ Choose  ]   │      │   │                       │   │
│  Splash Image:    [ Choose  ]   │      │   │   (Vibrant Theme)     │   │
└─────────────────────────────────┘      └───────────────────────────┘
```### Techniczny przebieg prac:
1. Kiedy po lewej stronie modyfikowane są dane wejściowe marki, wartości są aktualizowane w stanie reakcji.
2. Symulowany iframe/kontener smartfona po prawej stronie subskrybuje zmiany, dynamicznie aktualizując zmienne CSS („--kolor podstawowy”, „--kolor dodatkowy”) w czasie rzeczywistym.
3. Administrator może przełączać widok symulatora pomiędzy:
   - *Mobilny pulpit nawigacyjny*: Podgląd aktywnych tras, kart KPI i niestandardowych logo miast.
   - *Pasek nawigacyjny portalu*: Podgląd marki najemcy w nagłówkach nawigacji na pulpicie.

---

## 🛡️ 6. Konsola Security Operations Center (SOC).

Ulepszony pakiet moderacji Anti-Cheat przeznaczony do wysokowydajnej diagnostyki anomalii.

### Funkcje:
* **Oś czasu diagnostyki ML**: Interaktywny dzienny wykres słupkowy pokazujący częstotliwość anomalii wykrytych przez silnik ML.
* **POPULARNY KOMPONENT PORÓWNAWCZY GPS**:
  - Otwiera MapLibre GL.
  - Rysuje dwie nakładające się polilinie: **przesłane współrzędne** (na czerwono) i **przerwana ścieżka topologiczna BRoutera** (na niebiesko).
  - Podświetla skoki prędkości, nielegalne skoki wysokości i teleportacje geofence bezpośrednio na mapie.
* **Panel szybkiej moderacji**: Klawisze skrótu lub przyciski umożliwiające natychmiastowe blokowanie, zatwierdzanie lub oznaczanie kont ostrzeżeniem.

---

## ⏳ 7. Przyszłe rozszerzenia planu działania Premium (faza 2)

Następujące trzy moduły są w pełni zaprojektowane i przygotowane do wdrożenia w kolejnej fazie 2:

### 7.1 🤖 Studio dostosowywania awatarów 3D i trenerów AI (ADR 007)
Specjalistyczny interfejs administracyjny do dostrajania flagowego **Inteligentnego trenera awatara** opisanego w `ADR 007`.

* **Ustawienia modelu**:
  - `ai_coach_personality`: („ZEN”, „ŚCISŁY”, „PRZYJAZNY”, „MISTRZ”)
  - `ai_coach_custom_prompt`: Niestandardowa instrukcja systemowa ograniczona ściśle do **150 znaków** (wymuszona przez licznik znaków frontendu w czasie rzeczywistym), aby zachować zwięzłość zamiany tekstu na mowę.
  - `ai_coach_hr_threshold`: Suwak zakresu dla wyzwalaczy alertów tętna.
  - `ai_coach_pace_drop_threshold`: Suwak zakresu dla spadków tempa.
* **Syntezator kształtu fali głosu**:
  - Pole tekstowe, w którym administratorzy mogą wpisać monity testowe i nacisnąć „Syntezuj głos”. Symuluje wygenerowane dane wyjściowe za pomocą animowanego komponentu płótna.

### 7.2 🎫 Konfigurator projektu kuponu sponsorskiego B2B i podgląd interaktywnej karty 3D
Wizualny edytor płótna dla partnerów detalicznych (Sponsorów) do oznaczania swoich kuponów z nagrodami.

* **Kontrola obszaru roboczego**: Selektory kolorów tła, selektor typografii, wybór szablonu kodu kreskowego i przesyłanie logo sponsora.
* **Podgląd 3D z nachyleniem i najechaniem**:
  - Wyrenderowana karta podglądu wykorzystuje transformacje perspektywy 3D CSS („perspektywa(1000px) obrótX(...) obrótY(...)`) do dynamicznego pochylania w oparciu o współrzędne kursora.
  - Nałożona błyszcząca warstwa gradientu przesuwa się w kierunku przeciwnym do kierunku pochylenia, tworząc wysokiej jakości odbicie połysku karty holograficznej.

### 7.3 🍃 Portal ESG Green City i kalkulator kompensacji emisji dwutlenku węgla
Dedykowany pulpit nawigacyjny dotyczący zrównoważonego rozwoju, pokazujący wskaźniki ekologiczne przedstawicielom miast.

* **Infografiki**:
  - **Kalkulator przesunięcia CO₂**: $Odległość \times 0,21\text{ kg CO}_2\text{/km}$ uniknięto.
  - **Oszczędność paliwa**: w porównaniu do zużycia paliwa (odległość $\razy 0,07 $ litrów/km).
  - **Aktywne zdrowie**: agregator społeczności spalonych kalorii.
* **Zielona mapa cieplna MapLibre**:
  - Mapa cieplna gęstości od zieleni do cyjanu przedstawiająca trasy dojazdów do pracy, na których występuje największe ograniczenie emisji dwutlenku węgla, umożliwiając urbanistom optymalizację infrastruktury rowerowej.
