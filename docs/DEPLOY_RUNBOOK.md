# RC v0.2 Deployment Runbook — Krok po Kroku

## 1. Railway Backend Redeploy

```bash
# Kod jest już na main. Railway automatycznie redeployuje.
# Jeśli nie — wejdź na railway.app → backend → Deploy → Redeploy.

# Po redeployu, przez Railway CLI lub Shell:
railway run python manage.py makemigrations activities
railway run python manage.py migrate
railway run python manage.py seed_activities --clear
```

## 2. Railway — Zmienne Środowiskowe (Env Vars)

Dodaj w Railway → Backend → Variables:

| Zmienna | Wartość | Konieczne? |
|---|---|---|
| `SENDGRID_API_KEY` | `SG.xxxx` z sendgrid.com | 🟡 Email działa bez, ale nie wysyła |
| `FROM_EMAIL` | `no-reply@twojadomena.pl` | 🟡 Tylko z SENDGRID |
| `STRAVA_CLIENT_ID` | Z strava.com/settings/api | 🟡 Bez tego Strava nie działa |
| `STRAVA_CLIENT_SECRET` | Z strava.com/settings/api | 🟡 |
| `GARMIN_CLIENT_ID` | Z developer.garmin.com | 🟢 Ma mock fallback |
| `GARMIN_CLIENT_SECRET` | Z developer.garmin.com | 🟢 Ma mock fallback |

## 3. Mobile APK Rebuild

```bash
cd mobile
eas build --platform android --profile preview
# Albo przez EAS dashboard: expo.dev → SPORT → Builds
```

## 4. Admin Panel — Testy Manualne

1. Otwórz `https://docker-backend-production-55c7.up.railway.app/api/admin/` (albo przez Railway domenę)
2. Zaloguj jako `global_owner` / `admin123`
3. **Dashboard** — powinien pokazywać per-tenant tabelę z danymi
4. **Users** — stwórz nowego usera, usuń, wyślij zaproszenie
5. **ModeratorWorklist** — powinny być ~20 pending ticketów (unverified activities)
6. **WhiteLabel Engine** — zmień kolor → Deploy → powinien pokazać zieloną notyfikację

## 5. Mobile App — Testy Manualne

1. Zainstaluj APK z EAS
2. Zaloguj jako `athlete_001` / `athlete_password_2026`
3. **TrackingScreen:**
   - Mapa powinna zająć ~90% ekranu z czarną+złotą ramką
   - Naciśnij START MISSION → HUD pokazuje dystans, pace, speed, HR
   - Nie dotykaj ekranu 3s → HUD powinien zniknąć
   - Tapnij mapę → HUD wraca
   - Naciśnij ABORT & SYNC
4. **Quest Log (History):** Aktywności z grade S/A/B/C/D
5. **Ranking:** TOP 3 podium z nazwami użytkowników, "My Rank" na dole
6. **Marketplace (Rewards):** XP balance, przyciski BUY
7. **Profile:** QR code, Strava/Garmin Connect, theme toggle

## 6. Weryfikacja Backend Testów

```bash
railway run python run_tests.py activities.test_admin users.test_admin core.test_email activities.test_wearables
```

## 7. Znane Ograniczenia

- Pixel-art assets są placeholderami (kolorowe kwadraty) — zastąp prawdziwymi
- Garmin bez kluczy używa mock tokena
- Instance Wizard "Deploy" pokazuje "Coming in v0.3"
- `@tremor/react` peer dependency warning — nieszkodliwe
