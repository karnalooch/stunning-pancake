# ADR 007: AI Coaching Architecture

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../adr/007-ai-coaching-architecture.md) |
| **canonical_path** | docs/pl/adr/007-ai-coaching-architecture.md |
---

## Stan
Zaakceptowano (13.05.2026)

## Kontekst
Flagową funkcją jest „Inteligentny trener awatara”. Zapewnia informacje zwrotne w czasie rzeczywistym na podstawie wydajności. Korzystanie z czysto statycznego systemu szablonów sprawia wrażenie robota, podczas gdy korzystanie z systemu opartego wyłącznie na LLM jest zbyt wolne i potencjalnie zawodne/kosztowne.

## Decyzja
Wdrożyliśmy **Hybrydową strategię szablonów LLM** w `AvatarTrainerService`.

### Przepływ logiczny
1. **Faza wyzwalania**: Dane z czujnika (prędkość, tętno) wyzwalają zdarzenie coachingowe (np. „PACE_DROP”).
2. **Deduplikacja**: Jeśli identyczny wyzwalacz jest już przetwarzany przez LLM, nowe zdarzenie jest ignorowane, aby zapobiec „gadaniu”.
3. **Faza wykonania**:
    - **Wywołanie LLM**: System wysyła podpowiedź zawierającą (Osobowość + Kontekst + Zmienne wydajności) do LLM.
    - **Buforowanie**: Pomyślne odpowiedzi są buforowane na czas trwania sesji, aby zmniejszyć koszty interfejsu API.
    - **Wyłącznik automatyczny**: Jeśli wystąpią 3 kolejne awarie sieci lub przekroczenia limitu czasu (> 5 s), LLM zostanie globalnie pominięty na 60 sekund.
4. **Faza awaryjna**: Jeśli LLM zostanie pominięty (lub zawiedzie), z `WIADOMOŚCI[osobowość][kategoria] wybierany jest losowy szablon i interpolowany z bieżącymi zmiennymi.

### Szybka strategia
Podpowiedzi są ograniczone do **polskiego** i maksymalnie **150 znaków**. Dzięki temu otrzymana wiadomość będzie wygodnie mieściła się w dymkach powiadomień interfejsu użytkownika, a synteza głosu (przetwarzanie tekstu na mowę) będzie zwięzła.

## Konsekwencje
- **Pozytywny**: Wysoka niezawodność. Użytkownik zawsze otrzyma wiadomość, niezależnie od połączenia.
- **Pozytywne**: Efektywność kosztowa. Buforowanie i ograniczanie szybkości (maks. 1 wywołanie na 15 s) zapobiegają niekontrolowanym wydatkom API.
- **Wada**: Sporadyczne opóźnienie (~1-2 s) dla pierwszej wiadomości LLM w danej kategorii, chociaż kolejne identyczne wyzwalacze są albo buforowane, albo mają ograniczoną szybkość.

---

## Pełna wersja (kanoniczna)

Pełny tekst ADR (język źródłowy dokumentu): **[007-ai-coaching-architecture.md](../../adr/007-ai-coaching-architecture.md)**.

> Skrót PL — nie zastępuje pełnego ADR przy review architektury.
