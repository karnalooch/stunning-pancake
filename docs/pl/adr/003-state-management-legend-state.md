# ADR 003: State Management with Legend State

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../adr/003-state-management-legend-state.md) |
| **canonical_path** | docs/pl/adr/003-state-management-legend-state.md |
---

## Stan
Zaakceptowano (13.05.2026)

## Kontekst
Standardowe biblioteki zarządzania stanem React (Redux, Context API, MobX) często cierpią z powodu nadmiernego ponownego renderowania, szczególnie w aplikacjach krytycznych pod względem wydajności, takich jak tracker sportowy, gdzie dane telemetryczne są aktualizowane co sekundę. W typowej aplikacji React aktualizacja wartości „szybkości” może spowodować ponowne renderowanie całego dashboardu. Potrzebowaliśmy rozwiązania, które zapewni:
1. **Drobnoziarnista reaktywność**: Tylko określony komponent lub nawet określone pole tekstowe powinno zostać zaktualizowane w przypadku zmiany fragmentu danych.
2. **Minimalny schemat**: Łatwy do zdefiniowania i wykorzystania stan bez skomplikowanych działań i reduktorów.
3. **Głęboka obserwowalność**: Możliwość obserwacji zagnieżdżonych obiektów i tablic bez pogorszenia wydajności.
4. **Wydajność synchroniczna**: Aktualizacje stanu z zerowym opóźnieniem wymagane do uzyskania informacji zwrotnej z czujnika w czasie rzeczywistym.

## Decyzja
Wybraliśmy **Legend State** (`@legendapp/state`) jako główny silnik zarządzania stanem.

### Podstawowa implementacja
- **Usługi jako obserwowalne**: Wszystkie usługi globalne (np. `AvatarTrainerService`, `ThemeService`) hermetyzują swój stan w `obserwowalnych` obiektach.
- **Dostęp bezpośredni**: Preferujemy bezpośrednie wywołania `.set()` i `.get()` w obrębie usług, unikając narzutu związanego z dyspozytorami akcji.
- **Stan obliczeniowy**: Używamy `.get()` w funkcjach `obliczonych`, aby w sposób reaktywny uzyskać złożone wskaźniki (np. średnie tempo).

### Przykład: reaktywny składnik metryczny```tsx
import { observer } from '@legendapp/state/react';
import { avatarTrainer } from '@/services/AvatarTrainerService';

// This component ONLY re-renders when speedMs changes.
export const SpeedMetric = observer(() => {
    const speed = avatarTrainer.state.speedMs.get();
    return <Text>{(speed * 3.6).toFixed(1)} km/h</Text>;
});
```## Konsekwencje
- **Pozytywny**: Wysoka wydajność podczas aktywnego śledzenia jazdy. HUD może aktualizować dane z częstotliwością co najmniej 10 Hz bez wpływu na responsywność interfejsu użytkownika.
- **Pozytywne**: Produktywność programistów. Dodanie nowego fragmentu stanu to pojedyncza linia kodu w obserwowalnym.
- **Negatywny/Ryzyko**: „Wzorzec Obserwatora” wymaga od programistów zawinięcia komponentów w `observer()`. Zapomnienie o tym prowadzi do cichych awarii (stan jest aktualizowany, ale interfejs użytkownika pozostaje nieaktualny).
- **Strategia**: Użyj globalnej flagi `enableLegendStateReact()`, aby w razie potrzeby włączyć automatyczne śledzenie w małych komponentach, chociaż dla przejrzystości preferowane jest wyraźne określenie `obserwator`.

---

## Pełna wersja (kanoniczna)

Pełny tekst ADR (język źródłowy dokumentu): **[003-state-management-legend-state.md](../../adr/003-state-management-legend-state.md)**.

> Skrót PL — nie zastępuje pełnego ADR przy review architektury.
