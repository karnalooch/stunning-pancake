# Kluczowe Ekrany Aplikacji Użytkownika (Dopamine Loops & UX)

Zgodnie z "Konstytucją SPORT", interfejs musi wspierać estetykę Glassmorphism oraz natychmiastową reaktywność (Legend-State). Poniżej znajduje się zestawienie kluczowych ekranów, które budują pętlę dopaminową użytkownika.

## 1. Dashboard "Centrum Dowodzenia" (Home)
To jest pierwszy ekran po zalogowaniu. Używamy tu układu Bento Grid.

- **Widget ACWR (Acute/Chronic Workload Ratio):** Wizualizacja Skia pokazująca ryzyko kontuzji (Zielony/Żółty/Czerwony).
- **Ostatnia Aktywność:** Karta z mini-mapą (MapLibre static) i statystykami.
- **Postęp Celu Tygodniowego:** Pierścień postępu z płynną animacją Framer Motion.
- **Szybki Start:** Pływający przycisk (FAB) "START" w kolorze Cyan (`#00D1FF`) z efektem poświaty.

## 2. HUD Sesji (Tracking Screen)
Najważniejszy ekran pod kątem technologicznym (Zasada 12: 60 FPS).

- **Mapa Full-Screen:** MapLibre Native v11 z warstwą "Dark Matter".
- **Dynamiczny HUD:** Konfigurowalne kafelki (Designer Mode) — użytkownik może przytrzymać i zamienić "Tempo" na "Przewyższenie".
- **Live Metrics:** Dane renderowane przez React Native Skia, aby ominąć mostek Reacta przy aktualizacjach co 1s.
- **Przycisk Blokady/Pauzy:** Zabezpieczony przed przypadkowym dotknięciem (Long Press).

## 3. Analiza Po Treningu (Activity Summary)
Moment "Aha!" i celebracja sukcesu.

- **Heatmapa Trasy:** Wizualizacja prędkości na śladzie GPS (od fioletu do cyjanu).
- **Karta Społecznościowa:** Przycisk "Generuj Kartę Instagram" z nałożonymi statystykami i mapą.
- **Werdykt Anti-Cheat:** Mała, zielona tarcza z napisem "Zweryfikowano" (buduje zaufanie do sprawiedliwości rankingu).
- **Punkty & Nagrody:** Licznik zdobytych punktów animowany w stylu slot-machine.

## 4. Rankingi Miejskie i Globalne (Leaderboards)
Szybkość dostępu dzięki Redis Sorted Sets.

- **Sticky "Me":** Twoja pozycja zawsze widoczna na dole ekranu, nawet podczas przewijania.
- **Filtry Terytorialne:** Przełącznik: Moja Firma / Moje Miasto / Globalnie.
- **Avatar Rank:** Miniatury zawodników z obwódkami zależnymi od rangi (np. neonowy cyjan dla Top 10).

## 5. Portfel Nagród (Rewards Marketplace)
Miejsce monetyzacji i realnej wartości.

- **Katalog Voucherów:** Kafelki sponsorów (np. "Grupetto Siedlce - Kawa za 100 pkt").
- **Kod QR:** Generowany dynamicznie po kliknięciu "Odbierz" (atomowa transakcja `SELECT FOR UPDATE` na backendzie).
- **Saldo Punktów:** Wielki, szklany widget na górze ekranu.

## 6. Strażnik Prywatności (Sovereign Settings)
Realizacja Artykułu 10 Konstytucji.

- **Mapa Stref:** Interaktywne definiowanie okręgów wokół Domu/Pracy.
- **Ghost Mode:** Przełącznik całkowitego ukrywania śladu (pozostawia tylko dystans w rankingu).
- **Eksport Danych (GDPR):** Jeden przycisk generujący paczkę JSON ze wszystkimi trasami.
