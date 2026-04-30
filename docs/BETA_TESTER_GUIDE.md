# 🧪 SPORT v0.1.0-beta.1 — Przewodnik Beta Testera

## 🔐 Dostęp

Jesteś w zamkniętej becie platformy SPORT.  
**Wersja**: `0.1.0-beta.1` (2026-04-30)

### Dane logowania
- **Admin Dashboard**: `http://localhost:3001` — `global_owner` / `admin123`
- **API**: `http://localhost:8000`

---

## 🚀 Uruchomienie lokalne

```bash
# 1. Skopiuj zmienne środowiskowe
cp .env.example .env
# Wypełnij .env swoimi wartościami (klucz OPENAI_API_KEY jest wymagany dla LLM)

# 2. Uruchom platformę
docker-compose up --build -d

# 3. Seeduj bazę
docker-compose exec backend python manage.py migrate
docker-compose exec backend python seed_data.py
```

## 📱 Mobile App

```bash
cd mobile
npm install
npx expo start        # Development
npm run build:preview:android  # APK build
```

Wymagana zmienna: `EXPO_PUBLIC_API_URL` (backend URL) — proxy LLM automatycznie włączony.

---

## 🧠 Co testować — AI/LLM

### Mobile — Avatar Trainer
1. **Rozpocznij sesję treningową** — oczekiwany komunikat od Awatara-Trenera
2. **Symuluj niski poziom baterii** (<20%) — alert CRITICAL
3. **Symuluj utratę GPS** (accuracy >50m) — alert, potem odzyskanie
4. **Zmiana strefy tętna** — komunikat HR_ZONE_UP / HR_ZONE_DOWN
5. **Pobicie rekordu** — stan CELEBRATING + komunikat
6. **Zmiana osobowości** trenera (DRILL_SERGEANT / MOTIVATOR / ANALYST) — różny ton
7. **Wyłącz API LLM** (lub timeout) — fallback do statycznych szablonów

### Admin — System Intelligence
1. **Dashboard → System Intelligence** — 3 sekcje: Integrity Alert, Growth Insight, Global Strategy
2. **Bez klucza API** — fallback do danych demo
3. **Z kluczem API** — dynamiczne insighty z LLM
4. **Sprawdź badge** z nazwą modelu

### Ogólne
- [ ] Wszystkie komunikaty w języku **polskim**
- [ ] Brak mieszania PL/EN w jednym komunikacie
- [ ] Wiadomości nie wychodzą poza dialog box (maxWidth: 220)
- [ ] Efekt typewriter działa płynnie (40ms/znak)
- [ ] Animacje postaci (spring entry, floating idle, exit)

---

## 🐛 Zgłaszanie błędów

Format zgłoszenia:
```
Wersja: 0.1.0-beta.1
Komponent: [mobile | admin | backend]
Opis: [krótki opis]
Kroki: [jak odtworzyć]
Oczekiwane: [co powinno się stać]
Rzeczywiste: [co się stało]
```

---

## ⚠️ Znane ograniczenia

| Problem | Obejście |
|:---|:---|
| `@tremor/react` peer dependency conflict | `npm install --legacy-peer-deps` w admin |
| Firebase Crashlytics — dev fallback to console | Na produkcji wymaga `google-services.json` |
| LLM API key potrzebny na serwerze | Ustaw `OPENAI_API_KEY` w `.env` |
| Brak E2E testów mobile | Testuj manualnie na urządzeniu |

---

## 📦 Komponenty

| Komponent | Tech | Port |
|:---|:---|:---|
| Backend API | Django + DRF | 8000 |
| Telemetry | FastAPI | 8001 |
| Global Admin | Vite + React | 3001 |
| Tenant Admin | Vite + React | 3002 |
| Moderator | Vite + React | 3003 |
| Landing Page | Nginx | 3000 |
| DB | TimescaleDB | 5432 |
| Redis | Redis 7 | 6379 |
| Traccar | Traccar | 8082 |

---

*W razie pytań — kontakt przez kanał beta testerów.*
