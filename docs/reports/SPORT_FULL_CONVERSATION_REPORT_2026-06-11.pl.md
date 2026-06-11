# SPORT / 4VELO — pełny raport rynkowy i GTM

| | |
|--|--|
| **Status** | Active (snapshot strategiczny) |
| **Data** | 2026-06-11 |
| **Owner role** | Product / Strategy |
| **Audience** | Founder, Product, Sales, Strategy |
| **lang** | pl |
| **translation** | [English](../en/reports/SPORT_FULL_CONVERSATION_REPORT_2026-06-11.en.md) |
| **canonical_path** | docs/reports/SPORT_FULL_CONVERSATION_REPORT_2026-06-11.pl.md |

---

## 0. Cel dokumentu

Scalony, kompletny raport z sesji strategicznej dotyczącej platformy **4VELO / SPORT**. Łączy:

- research konkurencji (PL i Europa),
- sygnały społecznościowe (Reddit, Wykop, Facebook),
- benchmark **Aktywnych Miast**,
- analizę istniejącego kodu 4VELO,
- strategię sprzedaży do klubów i firm (modele 1vs1 i ligi),
- rekomendacje produktowe i go-to-market.

Zakres jest punktem odniesienia do dalszych decyzji produktowych i sprzedażowych. Większość liczb rynkowych pochodzi z materiałów publicznych, prasy lokalnej i społeczności — nie z zastrzeżonych danych konkurencji.

---

## 1. Kontekst produktu 4VELO

Platforma **multi-tenant B2B/B2C**: tracking GPS, anti-cheat, white-label, rywalizacje miejskie i korporacyjne, panel operatora.

### Specjalizacja produktowa (decyzja strategiczna)

4VELO koncentruje się **wyłącznie** na trzech dyscyplinach outdoor z weryfikacją GPS:

- **rower**,
- **bieganie**,
- **nordic walking**.

Nie rozszerzamy katalogu do 18 dyscyplin (jak Aktywne Miasta) ani do wellness opartego wyłącznie na krokach (jak Activy). Głęboka obsługa anti-cheat, routingu i scoringu dla tych trzech aktywności jest ważniejsza niż szerokość katalogu.

Potwierdzone cechy w repozytorium i dokumentacji:

- multi-tenant + white-label (`Tenant`, branding i konfiguracja per tenant, `config_json`, toggle heatmap),
- silnik eventowy pod wiele formatów rywalizacji (`ACCUMULATIVE`, `CHECKPOINT`, `ROUTE_MATCH`, `INTER_TENANT`, `CLUB_BATTLE`),
- kluby i pojedynki bezpośrednie (`Club`, `ClubMembership`, `ClubChallenge`),
- normalizacja wyniku (fair scoring przy różnych rozmiarach grup),
- działy/zespoły w tenantach (`Department`) jako baza pod ligi firmowe,
- anti-cheat (4 warstwy) i data-resilience (MMKV/outbox, NetInfo recovery),
- symulacje skali (`simulate_active_cities.py`, testy 10k–300k),
- integracje Strava + Garmin,
- plany overhaul paneli GLOBAL_OWNER i TENANT_ADMIN (kierunek control plane),
- "game vibe" w aplikacji mobilnej (questy, grades, LLM coach).

Wniosek bazowy: **backend jest dużo bardziej dojrzały niż warstwa mobile UX dla klubów i lig oraz niż pakiet sprzedażowy (GTM).**

---

## 2. Segmenty konkurencji

| Segment | Przykłady | Na czym konkurują |
|---------|-----------|-------------------|
| Wyzwania fitness / wellness | YuMuuv, Wellhub Challenges, StepJockey | Integracja z wearables, gamifikacja, wyzwania zespołowe |
| Wyzwania społecznościowe / kolektywne | MileStack, Baton, Movva, Stride | Cele grupowe, leaderboardy, 1v1 ze stawką |
| Miejskie / municipal | Aktywne Miasta, STADTRADELN, Love to Ride, Naviki, Geovelo, Da's zo gefietst, Liikkuen | Km dla miasta/gminy, heatmapy, kampanie sezonowe |
| Corporate wellness | Activy, MoveSpring, Tappa, Wellstep, Step Up | Kroki, zespoły, raport HR |
| Polska warstwa rywalizacji | Stravit, Mistrzowie Rywalizacji | Rywalizacje na bazie Strava, medale, B2B |
| Kluby / fan engagement | Clupik, HUDDLE | Zarządzanie klubem, rozgrywki, komunikacja |
| White-label enterprise | dacadoo, District Technologies, Wellness360 | API, multi-tenant, ubezpieczyciele/korporacje |

---

## 3. Sygnały społecznościowe (Reddit / Wykop / Facebook)

### Reddit i fora anglojęzyczne

1. **Oszustwa w firmowych wyzwaniach krokowych** — temat numer jeden. Głośny przypadek: współpracowniczka zgłasza ~65 000 kroków w dzień pracy (ręcznie przeliczone inne aktywności na "kroki"); organizator nie zdyskwalifikował, więc oszustka wygrała. Komentarze: "nikogo to nie obchodziło", frustracja uczciwych uczestników.
2. **Strava** — skargi na paywall i ceny subskrypcji, problemy sync, ubijanie aplikacji w tle (Android/MIUI).
3. **Corporate apps** (MoveSpring, YuMuuv) — problemy sync (Apple Health, reconnect OAuth).

### Wykop (PL)

- problemy z aplikacjami działającymi w tle (GPS, bateria),
- **Stravit.app** jako tańsza polska alternatywa rywalizacji na Strava (B2B taniej niż ~50 zł/os.),
- sceptycyzm wobec modeli "zarabiaj za chodzenie".

### Facebook (PL)

- scamy subskrypcyjne i fałszywe "konkursy sportowe",
- społeczności wyzwań działające na Excelu + grupach FB/Discord (np. wirtualne biegi z medalami).

### Wniosek

Największą bolączką nie jest brak funkcji, lecz **brak zaufania do wyników** (oszustwa, brak egzekucji zasad) oraz **niestabilność trackingu**. "Fair play + przejrzyste zasady + stabilność" to większa wartość niż kolejna warstwa marketingu.

---

## 4. Benchmark: Aktywne Miasta (Polska)

| | |
|--|--|
| Właściciel | Miasto Bydgoszcz (projekt samorządowy, niekomercyjny) |
| App | Android + iOS, bezpłatna |
| Geneza | Aktywna Bydgoszcz → Rowerowa Stolica Polski (2019) → Aktywne Miasta (2021) |
| Pozycja | Najbliższy polski odpowiednik 4VELO w segmencie rywalizacji miast/gmin |

### Funkcjonalności

- 18 dyscyplin, GPS, mapa, czas, dystans, kalorie, wykresy,
- integracja Garmin Connect,
- rywalizacje: Rowerowa Stolica Polski (czerwiec), Aktywny Wrzesień, gry miejskie; gminy od 2023,
- motywacja: monety → rabaty partnerów, odznaki, rekordy,
- społeczność: share do social, zaproszenia,
- dla JST: rankingi miast/gmin, mapy ciepła, portal www.

### Problemy (udokumentowane)

| Problem | Dowód / skala |
|---------|----------------|
| Przeciążenie serwera przy szczycie | RSP: ~150k włączeń app, serwer padł w długi weekend; 1000+ reklamacji o brakujące km (Express Bydgoski) |
| Utrata danych po reinstalacji | Reinstalacja = brak odzysku tras |
| App w tle / GPS | Wzorzec jak Strava na Androidzie (MIUI) — ubijanie procesu |
| Wyciek danych 2021 | Serwer zewnętrznego podwykonawcy; e-mail, miasto, statystyki (Gazeta Pomorska) |
| Słaba komunikacja incydentów | Mail do spamu, brak widocznego komunikatu w app |
| Anti-cheat | Brak publicznej polityki; ryzyko nadużyć przy nagrodach |
| Zależność od jednego miasta | Infrastruktura i marka = Bydgoszcz |
| Ograniczone integracje | Brak Strava/Apple Health jako standardu |

### Wniosek

AM potwierdza popyt i skalę segmentu, ale ujawnia luki: **odporność pod peak, jawny fair-play model, enterprise'owa operacyjność, white-label.**

---

## 5. Krajobraz europejski

### 5.1 European Cycling Challenge (ECC) — archiwum, geneza AM

- Start Bologna 2012, format maj, miasto vs miasto, GPS przez Naviki/Cycling365.
- Szczyt 2016: 52 miasta, 18 krajów, 46k uczestników, 4 mln km; **Gdańsk** 2× mistrz.
- Brak aktywnego ECC od ~2017; Bydgoszcz wycofała się i zbudowała własne AM/RSP.
- Lekcja: udowodniony popyt na ligę miast, upadek na braku trwałej platformy operatorskiej — miejsce dla white-label SaaS.

### 5.2 STADTRADELN / CITY CYCLING (Niemcy → Europa)

- Operator: Climate Alliance (Klima-Bündnis), tysiące gmin globalnie.
- Format: 21 dni, zespoły zbierają km dla gminy.
- IT dla JST: substrony gmin, dedykowana app, RADar! (zgłaszanie problemów na trasach), BIKE Monitor (heatmapy/analiza).
- Problemy: GPS w tle (FAQ "wyłącz oszczędzanie baterii"), data breach 2022 (błąd ACL, koordynatorzy gmin mogli pobrać dane innych gmin), złożoność RODO (współadministratorzy), jedna marka, tylko rower, model kampanii a nie produktu całorocznego.
- Najdojrzalszy model B2G pod rower, słabszy jako platforma sportowa i white-label.

### 5.3 Love to Ride (UK → globalnie)

- 750k+ użytkowników, 250+ regionów, 12 krajów.
- Model B2G "Ride 365" (4 kampanie/sezon), własna app + Strava/Garmin/MapMyRide, route rating dla council, partner kit (gotowe posty SM, raporty).
- Problemy: sync Strava do 24h opóźnienia, brak sync indoor, reconnect OAuth, auto-log nie działa na części urządzeń (OPPO, drain baterii), UI/UX, brak anti-cheat, jedna marka globalna.
- Najlepszy go-to-market B2G i integracje w segmencie rowerowym; słaby native reliability i fair play przy nagrodach.

### 5.4 Naviki Contests (Niemcy / EU)

- Konkurs wewnątrz appki nawigacyjnej Naviki; konfiguracja per gmina (GIS shapefile, grupy, kategorie).
- Anti-fraud: progi prędkości (max śr. 25 km/h, max 50 km/h, max 100 km) — podstawowy, GPS spoof nadal możliwy.
- Onboarding B2B manualny, tylko rower, zależność od ekosystemu Naviki.

### 5.5 Geovelo + Mai à Vélo (Francja)

- Krajowy challenge Mai à Vélo (maj), communautés (gmina/firma/szkoła) w appce nawigacyjnej.
- Problemy: dwa systemy równolegle (Geovelo + STADTRADELN = chaos), focus rower, brak game/anti-cheat.

### 5.6 Da's zo gefietst (Holandia, 2025+)

- Krajowa app (6 prowincji + ministerstwo) zastępująca regionalne; auto-tracking, punkty/nagrody, team challenges.
- Smart-city: priorytet na światłach, dashboard mobilności dla gmin.
- Najnowocześniejszy model EU pod dane miejskie + zachowanie; NL-only, rower, brak gamifikacji sportowej.

### 5.7 Liikkuen läpi vuoden (Finlandia)

- Sieć gmin, 3 kampanie/sezon, ranking gmin real-time, multi-sport outdoor, papierowa karta dla seniorów.
- Najbliższy funkcjonalnie AM (multi-sport + liga gmin), ale regionalny i prostszy technologicznie.

### 5.8 Healthy Cities (PL / LUX MED)

- Czerwiec, min. 6000 kroków/dzień, miasto + firma równolegle, narracja proekologiczna.
- Tylko kroki, jedna marka, słaby anti-cheat, sezon 1 miesiąc.

### 5.9 Corporate wellness (kontekst B2B)

| Platforma | Funkcje | Problemy |
|-----------|---------|----------|
| MoveSpring | Kroki, zespoły, Google Fit | Sync Apple Health, reconnect |
| Activy (PL) | Kroki, CO₂, charytatywność | Cena B2B, słaby anti-cheat |
| YuMuuv | Multi-activity, 47 języków, wearables | Wąski wellness, brak native rewards |
| Tappa (SE) | Wirtualne trasy Norden | Firmowe, nie miejskie |
| dacadoo (CH) | White-label, 18 języków, 120+ aktywności | Enterprise sales cycle, nie JST |

---

## 6. Macierz porównawcza funkcji

| Funkcja | AM | STADTRADELN | Love to Ride | Naviki | Geovelo | Da's zo gefietst | Liikkuen | 4VELO |
|---------|:--:|:-----------:|:------------:|:------:|:-------:|:----------------:|:--------:|:-----:|
| Miasto vs miasto | ✓ | ✓ | ○ | ○ | ✓ | ○ | ✓ | ✓ |
| Rower + bieg + NW | ✗ | ✗ (rower) | ✗ (rower) | ✗ | ✗ | ✗ | ✗ | ✓ |
| Własny GPS tracking | ✓ | ✓ | ○ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Strava sync | ✗ | ✗ | ✓ | ✗ | ? | ✗ | ✗ | ✓ |
| Garmin | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Heatmapy dla JST | ✓ | ✓ | ○ | ✓ | ○ | ✓ | ○ | ✓ |
| White-label | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Anti-cheat tech | ✗ | ✗ | ✗ | △ | ✗ | ✗ | ✗ | ✓ |
| Scale tested 100k+ | ✗ | ? | ? | ✗ | ✗ | ? | ✗ | ✓ |
| Gamifikacja ARPG | ✗ | ✗ | △ | ✗ | ✗ | △ | ✗ | ✓ |
| Multi-tenant admin | ✗ | △ | △ | ✗ | ✗ | △ | ✗ | ✓ |
| LLM coach | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Nagrody / monety | ✓ | △ | ✓ | ✗ | ✗ | ✓ | △ | ✓ |
| RODO / audit | △ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (RLS) |

Legenda: ✓ silne · ○ częściowe · △ podstawowe · ✗ brak

---

## 7. Powtarzalne problemy branży i reakcje rynku

| Problem | Kto go ma | Typowa reakcja | Skuteczność |
|---------|-----------|----------------|-------------|
| Peak load / pad serwera | AM, ECC (hist.) | Ręczne odzyskiwanie, przebudowa infra | Niska — reaktywna |
| GPS w tle (Android) | AM, STADTRADELN, Strava, Love to Ride | FAQ "wyłącz oszczędzanie baterii" | Średnia — obciąża usera |
| Sync wearables | Love to Ride, MoveSpring | Reconnect OAuth, 24h delay | Średnia |
| Wyciek / ACL danych | AM 2021, STADTRADELN 2022 | UODO, mail, zamknięcie luki | Jednorazowa, zaufanie spada |
| Oszustwa w rankingach | Wszystkie bez tech anti-cheat | Regulamin, community flag | Niska przy nagrodach |
| Fragmentacja appek | FR (Geovelo+STADTRADELN), ECC | Dwa systemy równolegle | Słaba UX |
| Jedna obca marka | STADTRADELN, Love to Ride, HC | Gmina akceptuje lub buduje własną | Polityczna, nie tech |
| Sezonowość | Większość | Kampanie 21–31 dni | OK dla PR, słabe dla retention |
| Seniorzy / inkluzja | Liikkuen | Papierowa karta | Dobra nisza |

---

## 8. Luki rynkowe (przewaga 4VELO)

Żaden gracz nie łączy jednocześnie:

1. white-label multi-tenant SaaS,
2. rower + bieg + nordic walking (3 dyscypliny GPS) + gamifikacja,
3. techniczny anti-cheat (4 warstwy),
4. odporność mobilna i scale-tested backend,
5. konsola operatora multi-tenant (impersonation, health, audit).

Najbliżsi: STADTRADELN (skala B2G, ale DE-centric, jedna marka, rower), Love to Ride (dojrzały B2G, rower), Da's zo gefietst (dane miejskie, NL-only), Liikkuen (multi-sport + liga gmin, regionalny).

### Pozycjonowanie 4VELO względem wymagań rynku

| Wymaganie rynku | Odpowiedź 4VELO |
|-----------------|-----------------|
| Liga miast / tenantów | Multi-tenant, `simulate_active_cities.py`, CityHub (plan) |
| Peak RSP-like load | Simulator 10k–300k, Celery, Redis |
| Utrata GPS w tle | MMKV buffer, outbox, NetInfo recovery |
| Fair rankings | 4-warstwowy anti-cheat + BRouter |
| Strava/Garmin ekosystem | OAuth + sync (lepiej niż AM) |
| White-label dla JST | Remote Asset Injection, per-tenant branding |
| RODO / izolacja | PostgreSQL RLS |
| Dane dla operatora | Control plane (health, audit) — overhaul |
| Retention / engagement | Game vibe, quest grades, LLM coach |
| B2G marketing kit | **Luka do zbudowania** |

---

## 9. Sprzedaż klubom i firmom (1vs1 i ligi)

### 9.1 Dwa modele sprzedaży — nie jeden

| | Firmy (B2B wellness / HR) | Kluby sportowe |
|--|---------------------------|----------------|
| Buyer | HR, wellbeing, CSR | Prezes/sekretarz klubu, kapitan |
| Jednostka rywalizacji | Dział, oddział, cała firma | Klub, drużyna, kategoria wiekowa |
| Format | Liga wewnętrzna lub firma vs firma | Klub vs klub, liga sezonowa |
| Metryka | km znormalizowane (rower / bieg / NW) | km, segmenty, checkpointy, mecze |
| Konkurencja | Activy, YuMuuv, MoveSpring, Step Up | Stravit, Clupik, ligi amatorskie (Excel) |
| Atut 4VELO | Anti-cheat + white-label + działy w adminie | Anti-cheat + game vibe + 1v1 w API |
| Ryzyko | "Mamy już Activy na kroki" | "Mamy WhatsApp + Strava" |

Nie mieszać w jednym pitchu: firma kupuje integrację i raport HR; klub kupuje prestiż, sprawiedliwość wyników i prostotę dla członków.

### 9.2 Co już istnieje w backendzie

- **`Tenant`** ([backend/users/models.py](../../backend/users/models.py)) — white-label dla firmy/organizatora ligi (kolory, logo, `max_users`, heatmapy, Stripe).
- **`Department`** ([backend/users/departments.py](../../backend/users/departments.py)) — działy/klasy/zespoły jako baza ligi wewnątrz firmy (typy: department, class, faculty, team, district).
- **`ClubChallenge`** ([backend/clubs/models.py](../../backend/clubs/models.py)) — pojedynek 1v1 klub vs klub; zwycięzca po znormalizowanym wyniku `total_km * complexity_factor / active_members`.
- **API klubów** ([backend/clubs/views.py](../../backend/clubs/views.py)) — `/api/clubs/`, join/leave, `/api/clubs/challenges/`.
- **Typy eventów** ([backend/events/models.py](../../backend/events/models.py)) — `ACCUMULATIVE`, `CHECKPOINT`, `ROUTE_MATCH`, `INTER_TENANT` (miasto/firma vs firma), `CLUB_BATTLE`.
- **Normalizacja** ([backend/events/services.py](../../backend/events/services.py)) — `EventProgressService` + `EventNormalizationService` (`Score = Total Group KM × Complexity Factor / Active Participants`).
- **Anti-cheat + moderacja** — differentiator dla lig z nagrodami/prestiżem.

### 9.3 Co jest słabe (UX/mobile)

- `ClubsDirectoryScreen` ([mobile/src/screens/ClubsDirectoryScreen.tsx](../../mobile/src/screens/ClubsDirectoryScreen.tsx)) — placeholder (tytuł + subtitle).
- `CityHubScreen` ([mobile/src/screens/CityHubScreen.tsx](../../mobile/src/screens/CityHubScreen.tsx)) — istnieje (City Wars UI), wymaga spięcia z live API.
- Mockupy STITCH (Clubs, ClubDetail, ClubChallenges, MyClubs, Global Leaderboard) — Faza 2 w planie mobile.

### 9.4 Mapowanie formatów na produkt

**Model A — 1vs1 (pojedynek)**

| Scenariusz | Mechanizm |
|------------|-----------|
| Klub A vs Klub B (30 dni) | `ClubChallenge` lub `Event` typu `CLUB_BATTLE` |
| Firma X vs Firma Y | `Event` typu `INTER_TENANT` + `opponent_tenant_id` |
| Dział marketingu vs IT | `Event` scoped do tenanta + ranking per `department_id` |
| Dwóch znajomych | Mniejszy event / challenge prywatny (cienkie UI "invite link") |

**Model B — Liga (wielu uczestników)**

| Scenariusz | Mechanizm |
|------------|-----------|
| 8 klubów, sezon jesień | Jeden `Event` ACCUMULATIVE + tabela klubów (agregacja per club_id) |
| 12 firm w grupie HR | Multi-tenant: każda firma = tenant, event federujący organizatora |
| 20 działów w korporacji | Jeden tenant, leaderboard per department |
| Play-off 1v1 po fazie grupowej | Faza 1 ACCUMULATIVE → Faza 2 pary `ClubChallenge` |

Luka w backendzie: brak jawnego modelu "League season" (tura, meczówka, awans). Dziś składa się z `Event` + `ClubChallenge`. Na start wystarczy, ale dla enterprise warto jeden byt "Sezon" w UI admina.

**Model C — Hybryda (najczęstsza u firm)**

- Faza grupowa: suma km działów,
- finał: 2 najlepsze działy 1v1 w ostatnim tygodniu.
- Naturalny upsell czasowy (2 eventy lub 1 event z fazami w `config_json`).

### 9.5 Konkurencja w segmencie

| Gracz | 1v1 / ligi | GPS / anti-cheat | White-label | Przewaga 4VELO |
|-------|------------|------------------|-------------|----------------|
| Activy / YuMuuv | Firmowe ligi kroków | Słabe | Co-branding | GPS + fair play przy nagrodach |
| Stravit | Rywalizacje na Strava | Brak | Nie | Własny tracking + admin + anti-cheat |
| MoveSpring / Step Up | Kroki, zespoły | Brak | Ograniczony | Sport "prawdziwy", nie shake-phone |
| Brakto / Volo | Turnieje firmowe (offline) | Nie dotyczy | Tak | Cyfrowy tracking + weryfikacja |
| Clupik / HUDDLE | Kluby, rozgrywki, komunikacja | Nie focus | Tak | Gamifikacja + telemetry |
| Movva / Stride | 1v1 ze stawką | Słabe | Nie | B2B bez hazardu, z moderacją |

Nisza 4VELO: **zweryfikowane ligi rower / bieg / nordic walking dla firm i klubów, gdzie wynik ma znaczenie** (nagroda, puchar, awans).

### 9.6 Problemy segmentu klub/firma

1. Oszustwa (shake-phone w firmie, GPS w aucie w klubie) — bez anti-cheat HR traci wiarygodność.
2. Niesprawiedliwy scoring (duży dział zawsze wygrywa) — normalizacja musi być zrozumiała ("średnia km na aktywnego").
3. Adopcja — kapitan nie chce kolejnej appki; Strava sync + prosty invite link.
4. Kapitan / admin ligi — ktoś musi zakładać mecze; bez self-serve UI pisze do supportu.
5. Sezonowość — liga 6 tygodni, potem churn; potrzeba "następnego sezonu" w 1 klik.
6. RODO w firmie — DPO pyta o GPS pracowników; tryb służbowy vs prywatny lub jasna zgoda.
7. Kluby amatorskie — często bez budżetu SaaS; model "organizator płaci" (firma/sponsor/federacja), członkowie free.

### 9.7 Pakiety sprzedażowe

1. **Firma — liga wewnętrzna**: 1 tenant, do 500 pracowników, N działów, 1 sezon (~6 tyg.), ranking działów + normalizacja, raport HR. Cena flat/sezon (Activy ~750 EUR / 45 dni jako punkt odniesienia; u 4VELO wyżej dzięki GPS+anti-cheat).
2. **Firma vs firma**: 2 tenanty (lub 1 organizer + 2 uczestników), `INTER_TENANT`, wspólny regulamin, osobne brandingi. Idealne: spółki siostrzane, klienci-partnerzy, targi.
3. **Klub — sezon 1v1**: kluby jako `Club` (tenant opcjonalny, np. miasto-sponsor), do 5 pojedynków równolegle lub liga 6–10 klubów. Niższa cena, wyższy wolumen; upsell: federacja płaci za ligę okręgową.
4. **Organizator ligi** (agencja HR, federacja): multi-tenant pod jednym GO, white-label "Liga Biegaczy Małopolski". Długoterminowy sweet spot — jak STADTRADELN, ale płatny B2B i **rower + bieg + nordic walking** (nie ogólny multi-sport).

### 9.8 Pitch w jednym zdaniu

- **Dla firmy:** "Liga rower / bieg / nordic walking działów lub firm z wynikami, którym HR może zaufać — bo oszustwa odcinamy, a mały zespół ma szansę dzięki fair scoring."
- **Dla klubu:** "Klub vs klub jak w Rowerowej Stolicy, ale dla waszego klubu biegowego, rowerowego lub NW — własna liga, medale w appce, bez ręcznego zbierania screenów ze Stravy."

### 9.9 Różnica vs sprzedaż do miast

| | Miasta (JST) | Firmy / kluby |
|--|--------------|---------------|
| Decyzja | Burmistrz, referat sportu | HR / zarząd klubu |
| Skala | 10k+ użytkowników, peak | 50–2000 typowo |
| Peak load | Krytyczny (RSP) | Umiarkowany |
| GTM | Kampania sezonowa, PR | Sezon kwartalny, ROI wellbeing |
| Produkt | CityHub, heatmapy, gminy | Clubs, departments, 1v1, raport HR |
| Konkurencja | AM, STADTRADELN | Activy, Stravit, Excel |

Jedna platforma — tenant może być miastem, firmą lub organizatorem ligi; zmienia się packaging i UI entry point, nie core backend.

---

## 10. Co warto wiedzieć (kontekst strategiczny)

1. Rynek nie kupuje "appki sportowej" — kupuje pakiet (kampania + marketing + raport + dane). Bez B2G playbooka 4VELO wygrywa na slajdach, przegrywa w przetargu.
2. Peak load to udowodniony killer (AM padł przy ~150k sesjach). Simulator warto sprzedawać jako dowód (raport load test + SLA).
3. RODO po incydentach AM/STADTRADELN: DPIA, podprocesorzy, komunikat in-app (nie tylko mail), szablon umowy współadministrowania.
4. Anti-cheat to USP tylko jeśli widoczny — potrzebna publiczna polityka (wzorzec: strona Anti-Cheat Policy).
5. ECC nie żyje, ale formuła ligi miast (maj/czerwiec) wciąż oczekiwana — okno na "następcę z lepszą tech".
6. Fragmentacja integracji to norma — przewaga "działa od razu" (Strava + Garmin + native GPS w jednym flow).
7. Sezonowość vs retention — game vibe + questy + CityHub muszą być spięte z kalendarzem sezonu.

---

## 11. Co wdrożyć — priorytety

### Tier 0 — zanim pierwszy kontrakt (GTM, głównie dokumentacja)

1. Pakiet "start kampanii" dla tenanta (plakaty, regulamin, FAQ GPS/bateria, harmonogram).
2. Publiczna strona Anti-Cheat / Scoring Policy.
3. Runbook peak event + jednostronicowy raport z symulacji.
4. Szablon DPIA / lista podprocesorów per tenant.
5. Komunikacja incydentów in-app.
6. Pitch deck / one-pager PL (i EN).

### Tier 1 — produkt mobilny (vs AM, Love to Ride)

1. CityHub na live API (nie mocki), sync z sezonem.
2. Onboarding "wybierz miasto / dział / zespół" (prostota jak AM).
3. Wizard "problemy z GPS" w appce (zielone/czerwone checki jak Activy).
4. Share do social z gotową grafiką.
5. Push: ranking miasta, quest, koniec sezonu (retention).
6. Offline / słaby zasięg (MMKV outbox jako przewaga).

### Tier 1b — minimum do pierwszej płatnej ligi (klub/firma, 6–8 tyg.)

- Mobile: Club Detail + join + challenge accept; "Moja liga" / Battle screen (Ty vs Oni, pasek, countdown); invite flow (link/kod); push "klub przegrywa o 12 km, zostały 3 dni".
- Admin: kreator sezonu (nazwa, daty, typ 1v1/liga, sport, normalizacja, publikacja); zaproszenie przeciwnika (PENDING → ACTIVE jak `ClubChallenge`); raport końca sezonu (PDF: ranking, fair-play flags, uczestnictwo %).
- Trust: publiczna polityka scoringu.

### Tier 2 — panel TENANT_ADMIN (dopracowanie)

1. Eksport "raport dla burmistrza/HR" (PDF/CSV: km, uczestnicy, heatmapa, CO₂).
2. Heatmapy jako wartość premium dla tenanta.
3. Workflow "opublikuj sezon / zamknij sezon".
4. Playwright smoke jako TENANT_ADMIN.
5. Moderacja w 3 kliknięcia — zmierzyć cel <60s w produkcji.

### Tier 2b — skalowanie sprzedaży B2B

- SSO / SCIM (duże firmy), liga wielofirmowa (organizer tenant), department leaderboard w mobile, rola "kapitan", integracja kalendarza (Outlook/Google).

### Tier 3 — GLOBAL_OWNER / platforma

1. Action Inbox (pending + anti-cheat + infra + sim).
2. Tenant Command Center (sparklines, churn signals).
3. Impersonation + audit.
4. Feature flags GO-only.
5. Prod vs sim nigdy na jednym dashboardzie.

### Tier 3b — kluby sportowe (hardcore)

- Eventy CHECKPOINT / ROUTE_MATCH (biegi klubowe z POI), segmenty KOM ("segment wars"), Matrix chat klubu (provisioning już jest).

### Czego świadomie NIE wdrażać na start

- Dyscypliny poza **rower / bieg / nordic walking** (np. 18 dyscyplin jak AM, wellness tylko na krokach).
- Move-to-earn / crypto (sceptycyzm, ryzyko regulacyjne).
- Własna sieć społecznościowa (export/leaderboard wystarczy).
- Konkurowanie ze Stravą jako tracker (pozycja "hub + fair league + white-label").
- Pełny bracket play-off i płatności entry fee w app (regulacja konkursów/hazardu) — dopiero później.

---

## 12. Rekomendowana kolejność (90 dni)

1. Sales kit JST (one-pager, DPIA template, sim report, anti-cheat policy).
2. CityHub + sezon end-to-end (mobile + tenant publish workflow).
3. GPS wizard + push retention (mobile).
4. Raport burmistrza/HR + heatmap export (tenant admin).
5. GO Action Inbox + tenant health (jeśli multi-tenant rośnie).
6. Piloty: 1 firma wewnętrzna (4 działy, 6 tyg.) + 1 klub 1v1 (dwa kluby, 30 dni); potem liga wielofirmowa.

---

## 13. Podsumowanie strategiczne

Technicznie 4VELO jest **przed rynkiem** (anti-cheat, outbox, multi-tenant, sim, model `Club`/`ClubChallenge`/`Event` INTER_TENANT/CLUB_BATTLE, departamenty, normalizacja). Komercyjnie jest **za** Love to Ride / STADTRADELN / Activy w gotowości kampanii i narracji.

Największa dźwignia teraz:

- domknięcie **mobile clubs/battle/leaderboard** spiętego z istniejącym API,
- **self-serve kreator sezonu + invite** w adminie,
- **raport końcowy** (HR/burmistrz/kapitan),
- publiczne **trust story** (anti-cheat, scoring, stabilność, peak proof).

To czyni produkt łatwym do kupienia przez HR i zarządy klubów — bez budowania backendu od zera.

---

## 14. Źródło i zakres

Dokument powstał ze scalenia pełnej sesji strategicznej (research konkurencji, sygnały społecznościowe, benchmark Aktywnych Miast, analiza kodu 4VELO, strategia sprzedaży klub/firma). Materiał rynkowy oparty na źródłach publicznych; analiza produktu oparta na repozytorium SPORT. **Aktualizacja 2026-06-11:** specjalizacja produktowa ograniczona do roweru, biegania i nordic walking. Dokument towarzyszący: [exec one-pager](./SPORT_EXEC_ONE_PAGER_2026-06-11.pl.md) i [delivery checklist 90 dni](./SPORT_DELIVERY_CHECKLIST_90D_2026-06-11.pl.md).
