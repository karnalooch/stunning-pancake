# ADR 002: Unistyles v3 Initialization & Hook Migration

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../adr/002-unistyles-v3-initialization.md) |
| **canonical_path** | docs/pl/adr/002-unistyles-v3-initialization.md |
---

## Stan
Zaakceptowano (13.05.2026)

## Kontekst
Podczas sekwencji uruchamiania aplikacji mobilnej napotkano krytyczną awarię: `[TypeError: 0, _reactNativeUnistyles.useStyles nie jest funkcją]` i `[Błąd: Unistyles: Jeden z Twoich arkuszy stylów próbuje pobrać motyw, ale żaden motyw nie został jeszcze wybrany.]`. 
Problem ten wynikał z dwóch czynników:
1. **Podnoszenie modułu ES**: Wywołania `StyleSheet.create(...)` na poziomie modułu w komponentach ekranu zostały ocenione w fazie importu, *zanim* możliwe było wykonanie `StyleSheet.configure()` w głównym pliku komponentu.
2. **Ważne zmiany w Unistyles v3**: Biblioteka `react-native-unistyles` została zaktualizowana do wersji 3, co całkowicie usunęła zaczep `useStyles` na rzecz `useUnistyles` i zmieniła sposób interakcji `StyleSheet.create` z komponentami.

## Decyzja
1. **Izolacja Bootstrap**: Wyodrębniliśmy `StyleSheet.configure()` do dedykowanego pliku instalacyjnego (`src/theme/unistylesSetup.ts`). Plik ten jest importowany jako efekt uboczny na samą górę pliku `index.ts` („import './src/theme/unistylesSetup';`), gwarantując jego działanie, zanim jakiekolwiek drzewa komponentów lub arkusze stylów na poziomie modułów zostaną ocenione przez pakiet Metro.
2. **Migracja API**: Przeprowadziliśmy migrację wszystkich komponentów interfejsu użytkownika i ekranów z przestarzałego API Unistyles v2 do API v3. 
   - Zastąpiono `useStyles(stylesheet)` przez `useUnistyles()`.
   - Dostęp do arkusza stylów bezpośrednio, zamiast poprzez obiekt zwracany przez hak.

## Konsekwencje
- **Pozytywne**: Całkowite wyeliminowanie awarii związanych ze stylizacją startową. Pakiet React Native inicjuje się deterministycznie.
- **Pozytywne**: Zgodność z najnowszą wersją `react-native-unistyles` (v3+), obsługująca przyszłe funkcje i kompatybilność z architekturą React 19 / Fabric.
- **Negatywny/Ograniczenie**: Programiści muszą pamiętać *nie* o umieszczaniu `StyleSheet.configure()` w standardowych cyklach życia komponentów. Musi ściśle pozostać w izolowanym pliku instalacyjnym.

## Wzorzec użycia (v3)```tsx
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

const stylesheet = StyleSheet.create(theme => ({
    container: { backgroundColor: theme.colors.background }
}));

export const MyComponent = () => {
    // Only access theme/runtime if needed. Styles are attached directly to the stylesheet object.
    const { theme } = useUnistyles(); 
    return <View style={stylesheet.container} />;
};
```


---

## Pełna wersja (kanoniczna)

Pełny tekst ADR (język źródłowy dokumentu): **[002-unistyles-v3-initialization.md](../../adr/002-unistyles-v3-initialization.md)**.

> Skrót PL — nie zastępuje pełnego ADR przy review architektury.
