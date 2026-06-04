# ADR 004: Persistent Storage & Offline-First (MMKV)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../adr/004-persistent-storage-mmkv.md) |
| **canonical_path** | docs/pl/adr/004-persistent-storage-mmkv.md |
---

## Stan
Zaakceptowano (13.05.2026)

## Kontekst
Aplikacja sportowa wymaga wydajnego, synchronicznego dostępu do danych lokalnych (ustawienia użytkownika, mapy offline, aktywności w pamięci podręcznej). Tradycyjny „AsyncStorage” jest zbyt wolny do częstego buforowania telemetrii, a jego asynchroniczny charakter powoduje złożoność zadań w tle.

## Decyzja
Używamy **MMKV** („react-native-mmkv”) jako naszego podstawowego mechanizmu przechowywania klucz-wartość.

### Implementacja: wzorzec „leniwego przechowywania”.
Aby uniknąć awarii typu „JSI Runtime Not Ready” – szczególnie podczas inicjowania zadania w tle Androida lub gdy aplikacja jest uruchamiana za pomocą głębokiego łącza – we wszystkich usługach implementujemy wzorzec leniwego akcesora.```typescript
let _storage: MMKV | null = null;
function getStorage() {
  if (!_storage) {
    try {
      _storage = new MMKV({ id: 'app-buffer' });
    } catch (e) {
      // Fallback for Remote Debugging (non-JSI environment)
      return { set: () => {}, getString: () => null, ...mockStorage };
    }
  }
  return _storage;
}
```### Wykorzystanie strategiczne
- **Buforowanie telemetrii**: GpsSyncManager dołącza punkty do ciągu `gps_buffer` w MMKV. Dzięki temu żadne dane nie zostaną utracone, jeśli proces aplikacji zostanie przerwany pomiędzy partiami sieciowymi.
- **Bezpieczeństwo w tle**: Używając MMKV w wywołaniach zwrotnych `expo-task-manager`, osiągamy trwałość bezpieczną dla wątków, która jest znacznie bardziej niezawodna niż `AsyncStorage` lub `SQLite` w stanach tła z małą ilością pamięci.

## Konsekwencje
- **Pozytywne**: Niesamowicie szybkie utrzymywanie danych (~30 razy szybsze niż AsyncStorage).
- **Pozytywny**: Niezawodność w zadaniach w tle (Expo Task Manager).
- **Negatywny**: Tarcie rozwojowe. Ponieważ MMKV jest modułem JSI C++, nie można go używać z „Remote Debuggerem” (Chrome). Programiści muszą używać „Flippera” lub „React Native Debugger” z włączoną obsługą nowej architektury/JSI lub polegać na dziennikach konsoli z urządzenia.

---

## Pełna wersja (kanoniczna)

Pełny tekst ADR (język źródłowy dokumentu): **[004-persistent-storage-mmkv.md](../../adr/004-persistent-storage-mmkv.md)**.

> Skrót PL — nie zastępuje pełnego ADR przy review architektury.
