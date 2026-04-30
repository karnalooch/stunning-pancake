# ONBOARDING GUIDE — SPORT Platform

## 1. Setup Środowiska Deweloperskiego
Platforma wykorzystuje konteneryzację do zapewnienia spójności między środowiskami.

### Wymagania:
- Docker + Docker Compose.
- Python 3.12+, Node.js 20+.
- PowerShell (do skryptu `dev.ps1`).

### Szybki Start:
```powershell
# 1. Przygotowanie środowiska
.\setup-environment.ps1

# 2. Uruchomienie stosu deweloperskiego
.\dev.ps1
```

## 2. Onboarding Użytkownika (Wizard Flow)
Aplikacja mobilna prowadzi użytkownika przez 7-krokowy proces incepcji:
1. **Splash**: Animacja 60 FPS (HD-2D).
2. **Permissions**: GPS (Always), Motion, Bluetooth.
3. **Integrations**: Strava/Garmin OAuth.
4. **Biometrics**: Wzrost, waga, płeć (Auto-sync lub Manual).
5. **Anti-Cheat**: Kalibracja i akceptacja zasad uczciwości.
6. **Legal**: Akceptacja RODO i Regulaminu.
7. **Identity**: Generowanie Athlete QR Identity.

## 3. Proces Wdrażania Nowego Najemcy (Tenant)
1. Utworzenie rekordu w tabeli `Tenant` (Owner Panel).
2. Konfiguracja brandingu (Primary Color, Logo URL).
3. Automatyczne generowanie poddomeny (np. `city.sportapp.pl`).
4. Uruchomienie RLS dla nowego identyfikatora najemcy.
