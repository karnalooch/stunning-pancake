# ADR 006: Hybrid Design System (Stitch Theme)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../adr/006-design-system-stitch.md) |
| **canonical_path** | docs/pl/adr/006-design-system-stitch.md |
---

## Stan
Zaakceptowano (13.05.2026)

## Kontekst
Celem projektu jest uzyskanie wyjątkowej estetyki „STITCH”: połączenia wysokiej klasy nowoczesnego designu w kolorze Solar White/Forest Green z elementami retro pixel-art (przyciski Arcade, obramowania pikseli).

## Decyzja
Używamy **React Native Unistyles** jako naszego silnika motywów.

### Zasady projektowania
- **Paleta „Stitch”**: Baza w kolorze Solar White (`#f8faf0`) z leśną zielenią (`#3b6a24`) jako głównym kolorem akcji. 
- **Typografia**: 
    - **Space Grotesk**: Używany do wszystkich elementów interfejsu użytkownika, etykiet i tytułów, aby zapewnić nowoczesny i wydajny wygląd.
    - **VT323 (czcionka pikselowa)**: Używana wyłącznie do wskaźników wyświetlanych w czasie rzeczywistym na HUD-ie, aby wzmocnić estetykę gier retro/arkadowych.
- **Specyfika HUD**: Podczas aktywnego śledzenia używana jest dedykowana podpaleta o wysokim kontraście („hudBackground”, „hudMetric”). Tła zmieniają się w głęboką zieleń/czerń („#0d1b0f”), aby zmaksymalizować czytelność w warunkach zewnętrznych.

### Komponenty doskonałe w pikselach
Komponenty takie jak `ArcadeButton` implementują logikę „Pixel Border”:
- Podwójna granica: wewnętrzna granica dla efektu 3D, zewnętrzna granica dla wrażenia arkadowego.
- Twarde cienie: unikamy rozmyć gaussowskich na rzecz przesuniętych bloków jednolitego koloru (`#191d17`), aby zachować charakter „ściegu”.

## Konsekwencje
- **Pozytywne**: Unikalna tożsamość marki, która wyróżnia się na tle ogólnych aplikacji fitness.
- **Pozytywne**: Wydajny silnik stylizacji z obsługą dynamicznego przełączania motywów.
- **Ograniczenie**: Estetyka „pikselowa” wymaga dokładnych testów na ekranach o wysokiej rozdzielczości, aby upewnić się, że linie nie wyglądają na rozmazane (rozwiązano to za pomocą skalowania Unistyles uwzględniającego proporcje pikseli).

---

## Pełna wersja (kanoniczna)

Pełny tekst ADR (język źródłowy dokumentu): **[006-design-system-stitch.md](../../adr/006-design-system-stitch.md)**.

> Skrót PL — nie zastępuje pełnego ADR przy review architektury.
