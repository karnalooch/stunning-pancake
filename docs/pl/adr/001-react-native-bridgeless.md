# ADR 001: Wybór React Native (Bridgeless) zamiast Fluttera

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../adr/001-react-native-bridgeless.md) |
| **canonical_path** | docs/pl/adr/001-react-native-bridgeless.md |
---

## Status
Zaakceptowany (Zastępuje poprzednie założenia)

## Kontekst
W pierwotnej fazie projektu rozważano Fluttera ze względu na wysoką wydajność renderowania (Skia). Jednakże, ewolucja ekosystemu React Native (Nowa Architektura, Bridgeless Mode) oraz biblioteki takie jak `@shopify/react-native-skia` i `Legend-State` oferują teraz porównywalną, a w niektórych przypadkach wyższą wydajność dla aplikacji telemetrii sportowej.

## Decyzja
Wybieramy **React Native 0.83+** w trybie Bridgeless.

## Uzasadnienie
1. **Wydajność**: Integracja Skia pozwala na renderowanie HUD i mapy w 120 FPS bezpośrednio na GPU.
2. **Reaktywność**: `Legend-State` eliminuje narzut rerenderowania Reacta, co jest kluczowe przy danych GPS spływających co 1s.
3. **Ekosystem**: Lepsza integracja z natywnymi modułami map (MapLibre) oraz systemami płatności.
4. **Strategia**: Łatwiejsze współdzielenie typów (TypeScript) między frontendem a backendem (poprzez generatory typów).

## Konsekwencje
- Konieczność rygorystycznego pilnowania wątku UI (maks. 16ms).
- Używanie `Tamagui` dla zero-runtime stylizacji.
- Wykorzystanie `MMKV` dla ultra-szybkiego zapisu bufora GPS.


---

## Pełna wersja (kanoniczna)

Pełny tekst ADR (język źródłowy dokumentu): **[001-react-native-bridgeless.md](../../adr/001-react-native-bridgeless.md)**.

> Skrót PL — nie zastępuje pełnego ADR przy review architektury.
