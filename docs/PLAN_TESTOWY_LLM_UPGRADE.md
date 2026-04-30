# 🧪 PLAN TESTOWY — Po zmianie modelu językowego (LLM Upgrade)
# Projekt: SPORT  |  Data: 2026-04-30

> **Kontekst**: Zastąpienie statycznych szablonów tekstowych w `AvatarTrainerService` 
> oraz modelu GPT-4o w `SystemIntelligence` (Admin) lepszym modelem językowym (LLM).

---

## 📱 MOBILE — AvatarTrainerService (Inteligentny Awatar-Trener)

### 1. Testy Jednostkowe (Unit Tests)

#### 1.1 Spójność osobowości (Personality Consistency)
Dla każdej z 3 osobowości — **DRILL_SERGEANT**, **MOTIVATOR**, **ANALYST** — zweryfikuj:
- [ ] `DRILL_SERGEANT` utrzymuje tonację wojskową, bezpośrednią, wymagającą
- [ ] `MOTIVATOR` utrzymuje tonację wspierającą, pozytywną, celebratywną
- [ ] `ANALYST` utrzymuje tonację analityczną, merytoryczną, opartą na danych
- [ ] Styl językowy jest spójny we wszystkich kategoriach triggerów dla danej osobowości
- [ ] Każda osobowość używa charakterystycznego słownictwa (np. DRILL_SERGEANT: "mission", "soldier"; ANALYST: "telemetry", "baseline")

#### 1.2 Wszystkie 9 kategorii komunikatów
- [ ] `SESSION_START` — start misji
- [ ] `SESSION_END` — zakończenie misji
- [ ] `PACE_DROP` — spadek tempa >20%
- [ ] `LOW_BATTERY` — bateria <20%
- [ ] `GPS_LOST` — dokładność >50m
- [ ] `HR_ZONE_UP` — wejście w wyższą strefę tętna
- [ ] `HR_ZONE_DOWN` — zejście do niższej strefy tętna
- [ ] `PERSONAL_BEST` — nowy rekord życiowy
- [ ] `FIRST_ACTIVITY` — pierwsza aktywność dnia

#### 1.3 Poprawność interpolacji zmiennych (Template Variables)
- [ ] `{pct}` — procent baterii (np. "18%")
- [ ] `{avgSpeed}` — średnia prędkość w km/h (np. "12.4 km/h")
- [ ] `{dropPct}` — procent spadku tempa (np. "27")
- [ ] `{zone}` — strefa tętna 1-5
- [ ] `{hr}` — aktualne tętno BPM
- [ ] `{dist}` — dystans w km (np. "5.23")
- [ ] `{acc}` — dokładność GPS w metrach
- [ ] `{est}` — szacowany pozostały czas pracy

#### 1.4 Limit długości wiadomości
- [ ] PopUpDialog ma `maxWidth: 220` — wiadomości LLM nie wychodzą poza dialog box
- [ ] Dłuższe wiadomości są przycinane lub skracane do akceptowalnej długości
- [ ] Efekt typewriter (40ms/znak) kończy się w rozsądnym czasie (<5s dla max długości)

#### 1.5 Język polski
- [ ] Wszystkie komunikaty generowane są w języku **polskim**
- [ ] Prompt constraint: "Odpowiadaj zawsze po polsku"
- [ ] Brak mieszania języków (PL/EN) w jednym komunikacie

#### 1.6 Fallback
- [ ] Gdy LLM API jest niedostępne → system przełącza się na hardcoded templates
- [ ] Gdy LLM zwraca błąd → fallback do szablonów
- [ ] Gdy LLM timeout (>5s) → fallback do szablonów
- [ ] Użytkownik NIE widzi różnicy w działaniu (graceful degradation)

---

### 2. Testy Integracyjne z TriggerEngine

#### 2.1 Kolejka priorytetowa
- [ ] Priorytety zachowane: CRITICAL (4) > HIGH (3) > MEDIUM (2) > LOW (1)
- [ ] Wiadomości LLM z wyższym priorytetem przerywają/przesuwają niższe
- [ ] Kolejność wiadomości w ramach tego samego priorytetu: FIFO

#### 2.2 Cooldown i deduplikacja
- [ ] Min. 8s odstępu między dialogami (COOLDOWN_MS)
- [ ] Ten sam trigger ID zablokowany na 60s (DEDUP_WINDOW_MS)
- [ ] Jeśli LLM generuje nowe ID, nie konfliktują z istniejącymi

#### 2.3 Nieprzepełnienie kolejki
- [ ] Opóźnienie LLM nie powoduje kumulacji >10 wiadomości w kolejce
- [ ] Jeśli kolejka jest pełna, najniższy priorytet jest usuwany

---

### 3. Testy E2E — TrackingScreen

#### 3.1 Pełen cykl sesji treningowej
- [ ] START → stan `OBSERVING` → komunikat `SESSION_START`
- [ ] Podczas treningu → stan `COACHING` → komunikaty coachingowe
- [ ] Osiągnięcie rekordu → stan `CELEBRATING` → `PERSONAL_BEST`
- [ ] STOP → stan `IDLE` → komunikat `SESSION_END`

#### 3.2 Scenariusze triggerów
- [ ] **Niska bateria** (<20%): alert, tylko raz na sesję (lowBatteryAlerted)
- [ ] **Utrata GPS** (accuracy >50m): alert → recovery (<20m) → reset alertu
- [ ] **Spadek tempa** (>20% poniżej średniej, check co 30s): alert + auto-reset po 2 min
- [ ] **Zmiana strefy tętna**: wejście/wyjście, odpowiedni komunikat UP/DOWN
- [ ] **Rekord życiowy**: aktualizacja PB, stan CELEBRATING
- [ ] **Kamienie milowe**: 1km, 5km, 10km, 21.1km, 42.2km — każdy wyzwala osobny trigger
- [ ] **Pierwsza aktywność dnia**: tylko raz, flaga firstActivityOfDay

#### 3.3 Stan urządzenia
- [ ] W tle: activity w tle nie przerywa komunikatów
- [ ] Lock screen: notyfikacja GPS działa równolegle z komunikatami
- [ ] Przełączanie aplikacji (app switching) nie resetuje stanu kolejki

---

### 4. Testy UI — PopUpDialog

#### 4.1 Efekt Typewriter
- [ ] Prędkość: 40ms na znak
- [ ] Kursor `_` miga poprawnie
- [ ] Przy bardzo długich wiadomościach — efekt kończy się przed timeoutem dialogu (domyślnie 5s)

#### 4.2 Dopasowanie tekstu
- [ ] Wiadomość mieści się w `maxWidth: 220`
- [ ] Brak przepełnienia (overflow) tekstu poza dialog box
- [ ] Dla dłuższych tekstów — rozsądne zawijanie wierszy

#### 4.3 Postaci (Character Sprites)
- [ ] `runner` — komunikat biegowy → sprite runner_sprite.png
- [ ] `cyclist` — (przyszłe) → sprite cyclist_sprite.png
- [ ] `ghost` — alerty systemowe/krytyczne → sprite ghost_sprite.png
- [ ] `elite` — rekordy, milestones → sprite elite_sprite.png
- [ ] Prawidłowe przypisanie sprite'a do typu komunikatu z LLM

#### 4.4 Animacje
- [ ] Spring entry: damping=14, stiffness=100 — postać "wskakuje" z dołu
- [ ] Floating idle: ±8px, okres 2s, łagodne "pływanie"
- [ ] Exit: spring 400px w dół
- [ ] Opacity: płynne zanikanie przy wyjściu

#### 4.5 Solar Mode
- [ ] Tryb wysokiego kontrastu (12:1) — czytelność komunikatów
- [ ] Kolory akcentowe (#D4A373, #FF6B35) pozostają widoczne
- [ ] Białe tło nie prześwituje przez dialog box

---

## 🖥️ ADMIN — SystemIntelligence AI Dashboard

### 5. Testy Panelu Admina

#### 5.1 Zmiana etykiety modelu
- [ ] Tekst "GPT-4o analyzed platform-wide heuristics" zaktualizowany na nowy model
- [ ] Dokumentacja zgodności modelu w kodzie (komentarz)

#### 5.2 Spójność danych analitycznych
- [ ] **Integrity Alert**: Detekcja anomalii — czy nowy model poprawnie identyfikuje GPS spoofing?
- [ ] **Growth Insight**: Analiza zaangażowania — czy rekomendacje są sensowne?
- [ ] **Global Strategy**: Sugestie strategiczne — czy są konkretne i wykonalne?
- [ ] Wszystkie liczby/procenty w analizach są poprawne (brak zmyślonych danych)

#### 5.3 Halucynacje
- [ ] Nowy model NIE generuje fałszywych alertów (false positives)
- [ ] Nowy model NIE pomija realnych zagrożeń (false negatives)
- [ ] Rekomendacje nie zawierają sprzecznych informacji

#### 5.4 Formatowanie UI
- [ ] Tekst LLM poprawnie renderuje się w komponentach Mantine (Card, Text, Badge)
- [ ] Długie odpowiedzi nie łamią layoutu kart
- [ ] Markdown/HTML z LLM (jeśli dotyczy) jest bezpiecznie renderowany

---

## ⚡ PERFORMANCE

### 6. Testy Wydajnościowe

#### 6.1 Latencja
- [ ] P95 < **500ms** dla zapytań LLM w kontekście mobilnym (real-time coaching)
- [ ] P99 < **2000ms** — powyżej → timeout + fallback
- [ ] Cache odpowiedzi dla powtarzalnych kontekstów (np. ten sam typ triggera)

#### 6.2 Timeout i retry
- [ ] Timeout na zapytanie LLM: **5 sekund**
- [ ] Max retries: **1** (nie powtarzaj — fallback od razu)
- [ ] Circuit breaker: po 3 timeoutach z rzędu → fallback na 60s

#### 6.3 Zużycie zasobów (mobile)
- [ ] Dodatkowe wywołania sieciowe nie zwiększają zużycia baterii o >5%
- [ ] Brak wycieków pamięci przy powtarzalnych zapytaniach LLM
- [ ] Streamowanie odpowiedzi LLM (jeśli dostępne) dla szybszego pierwszego tokena

#### 6.4 Rate limiting i koszty
- [ ] Cache odpowiedzi LLM na sesję (unikaj duplikatów)
- [ ] Limit zapytań: max 1 na 15 sekund w kontekście tego samego triggera
- [ ] Budżet tokenów na sesję: monitorowanie kosztów API

---

## 🔄 REGRESSION

### 7. Testy Regresyjne

#### 7.1 Mobile — Core functionality
- [ ] GPS tracking: start/stop, batch upload, retry (Exponential Backoff)
- [ ] `GpsSyncManager`: startTracking, stopTracking, setResolution, background task
- [ ] `GpsSyncManager` callback → TrackingScreen stats update (co 2s)
- [ ] `TriggerEngine`: push, dismiss, clear, destroy — wszystkie metody bez zmian
- [ ] `MilestoneTracker`: 5 kamieni milowych, reset, progress
- [ ] `PopUpDialog`: animacje, sprites, typewriter — renderowanie bez zmian

#### 7.2 Mobile — Wszystkie ekrany
- [ ] TrackingScreen (Home) — HUD, mapa, metryki
- [ ] ActivitiesScreen (History) — lista aktywności
- [ ] LeaderboardScreen (Ranking) — rankingi
- [ ] RewardsScreen — nagrody, vouchery, QR kody
- [ ] ProfileScreen — profil, integracje, QR identity
- [ ] OnboardingScreen — flow onboardingu

#### 7.3 Admin — Wszystkie moduły
- [ ] Dashboard + SystemIntelligence
- [ ] Anti-Cheat (moderacja)
- [ ] Users (zarządzanie użytkownikami)
- [ ] White-Label Engine (branding tenantów)
- [ ] Sponsor Dashboard
- [ ] Instance Wizard (deployment nowych instancji)

#### 7.4 Backend — Bez zmian
- [ ] Anti-Cheat ML (IsolationForest) — NIEZALEŻNY od LLM
- [ ] Integracje: Matrix (komunikator), Stripe (płatności), Traccar (telemetria)
- [ ] API: REST endpoints, WebSocket, autoryzacja JWT
- [ ] RLS (Row Level Security) — izolacja tenantów
- [ ] Celery tasks: retrain_ml_model (ML pipeline)

---

## 📋 CHECKLISTA DO WDRORZENIA (Deployment Checklist)

| Lp. | Czynność | Status |
|:---|:---|:---|
| 1 | Nowy klucz API do LLM w `.env` (mobile + backend) | ⬜ |
| 2 | Aktualizacja etykiety modelu w `SystemIntelligence.tsx` | ⬜ |
| 3 | Testy jednostkowe AvatarTrainerService z mockiem LLM | ⬜ |
| 4 | Testy integracyjne TriggerEngine z mockiem LLM | ⬜ |
| 5 | Testy E2E TrackingScreen — pełna sesja | ⬜ |
| 6 | Testy UI PopUpDialog z różnymi długościami tekstu | ⬜ |
| 7 | Testy Solar Mode dla komunikatów | ⬜ |
| 8 | Testy fallbacku (wyłączone API LLM) | ⬜ |
| 9 | Testy wydajnościowe (latencja, bateria) | ⬜ |
| 10 | Code review — bezpieczeństwo (prompt injection?) | ⬜ |
| 11 | Monitoring Sentry — nowe metryki dla LLM | ⬜ |
| 12 | Dokumentacja w `docs/` — opis integracji LLM | ⬜ |

---

## 🎯 KLUCZOWE RYZYKA I ICH ROZWIĄZANIA

| Ryzyko | Impact | Prawd. | Rozwiązanie |
|:---|:---|:---|:---|
| **Halucynacje LLM** (fałszywe dane, liczby) | HIGH | MED | Walidacja wyjścia, filter na zmyślone liczby, fallback |
| **Zbyt długie wiadomości** (nie mieszczą się w UI) | MED | HIGH | `max_tokens=80`, truncate po 220px, testy wizualne |
| **Opóźnienia API** (>2s lag w real-time) | HIGH | LOW | Timeout 5s, fallback, circuit breaker |
| **Koszty API** (niekontrolowane zużycie) | MED | MED | Rate limiting, cache, budżet tokenów/sesję |
| **Zmiana języka** (PL → EN) | HIGH | LOW | Prompt constraint, testy językowe |
| **Utrata spójności osobowości** (wszystkie 3 brzmią tak samo) | MED | MED | Testy A/B, prompt engineering per personality |
| **Prompt injection** (atak przez user input) | CRIT | LOW | Sanityzacja inputu, brak user input w prompcie |
| **Regresja TriggerEngine** (kolejka się zacina) | HIGH | LOW | Full regression suite, unit tests kolejki |

---

*Dokument wygenerowany: 2026-04-30 | Do aktualizacji po wdrożeniu nowego modelu językowego.*
