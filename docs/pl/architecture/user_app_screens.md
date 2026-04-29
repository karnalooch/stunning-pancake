# Ekrany Aplikacji Mobilnej (Cyber-Monolith V3)

Niniejszy dokument opisuje architekturę wizualną i funkcjonalną kluczowych ekranów aplikacji SPORT. Interfejs musi wspierać estetykę Glassmorphism oraz natychmiastową reaktywność (Legend-State).

## 1. Ekran Główny: Dashboard (The Hub)
Centrum dowodzenia sportowca. Skupienie na aktualnych postępach i motywacji.
- **Header:** Dynamiczne powitanie, status synchronizacji (PowerSync), avatar z rangą.
- **Bento Grid Stats (Skia):**
  - Kafelki z tygodniowym dystansem, spędzonym czasem i spalonymi kaloriami.
  - Wykres trendu objętości (12 tygodni) renderowany w Skia.
- **Active Challenge Card:** Najważniejsze trwające wydarzenie miejskie/korporacyjne z paskiem postępu.
- **Quick Action Button:** Wielki, pulsujący przycisk "START" z efektem glassmorphismu.
- **Dopamine Feed:** Mini-lista ostatnich odznak lub sukcesów znajomych z klanu.

## 2. Ekran Sesji: Tracking (The Engine)
Najbardziej wydajny ekran. Personalizowany HUD nałożony na mapę wektorową.
- **MapLayer (MapLibre v11):**
  - Ciemny motyw "Dark Matter".
  - Ścieżka rysowana w czasie rzeczywistym z poświatą (Glowing Track).
- **Hyper-Edit HUD (Tamagui):**
  - Użytkownik może przytrzymać metrykę, aby ją zmienić (Tempo, Prędkość, Wysokość, Tętno).
  - Technologia: Legend-State aktualizuje te wartości bez rerenderowania całej mapy (60+ FPS).
- **Control Drawer:** Wysuwany dół z przyciskiem Pause/Stop (zabezpieczony przed przypadkowym dotknięciem - Long Press).
- **Privacy Indicator:** Ikona informująca, czy użytkownik znajduje się obecnie w Strefie Prywatności (GPS nie jest wtedy logowany do serwera).

## 3. Ekran Społeczności: Leaderboards & Social
Miejsce rywalizacji i komunikacji. Multi-tenant context (Miasto/Klub).
- **Segmented Control:** Przełącznik między "Miasto", "Klub", "Global".
- **Rankings List:**
  - Wykorzystanie FlashList dla płynnego przewijania tysięcy pozycji.
  - Moja pozycja zawsze przypięta na dole (Sticky).
- **Matrix Chat Entry:** Skrót do czatu klanowego (E2EE) z ostatnią wiadomością.
- **Event Map:** Miniatura mapy z "Hotspotami", gdzie aktualnie trenuje najwięcej osób (deck.gl).

## 4. Ekran Historii: Activities & Analytics
Archiwum i weryfikacja. Dowód integralności tras.
- **List View:** Filtrowanie według sportu (Bieg/Rower).
- **Status Badges:**
  - Verified (Zielony)
  - Flagged (Pomarańczowy - podejrzenie oszustwa)
  - Processing (Szary)
- **Activity Detail (Expandable):**
  - Mini-mapa trasy.
  - Statystyki biomechaniczne (V-max check, cadency).
  - Przycisk "Share to Social" (generowanie karty graficznej z mapą).

## 5. Ekran Nagród: Marketplace (The Vault)
Grywalizacja zamieniona na realną wartość.
- **Points Ledger:** Stan punktów "SPORT" z animacją licznika.
- **Voucher Cards:** Lista dostępnych nagród od sponsorów (np. "Darmowa Kawa", "Zniżka 20%").
- **QR Vault:** Miejsce, gdzie przechowywane są już odebrane kody do pokazania w sklepie.
- **Sponsor POI:** Mapa pobliskich punktów, gdzie można odebrać nagrody.

## 6. Ekran Profilu i Ustawień (The Fortress)
Zarządzanie tożsamością i prywatnością.
- **Biometric Identity:** Status Passkeys/FaceID.
- **Privacy Zones Manager (V2):**
  - Interaktywna mapa do definiowania stref (Dom, Praca).
  - Suwak promienia maskowania.
- **Device Sync:** Zarządzanie połączeniem z Garmin/Apple Health.
- **Tenant Context:** Informacja o tym, pod jakie miasto/korporację podpięty jest profil (Branding wstrzykiwany dynamicznie).

---

## Detale Techniczne UI (Cyber-Monolith V3)
- **Kolory:** Tło: `#050505`, Primary: `#00D1FF` (Cyan), Accent: `#B066FF` (Purple).
- **Typografia:** Inter (Variable Font) dla maksymalnej czytelności.
- **Efekty:** BackdropFilter (blur) na wszystkich panelach nakładanych na mapę.
- **Haptyka:** Delikatne wibracje przy start/stop sesji oraz przy zdobywaniu punktów.
