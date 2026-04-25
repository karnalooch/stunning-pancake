# AI Workflow & Tooling (CLI Companion)

Ten dokument opisuje standardy współpracy agenta AI ze środowiskiem deweloperskim, ze szczególnym uwzględnieniem zewnętrznych narzędzi analitycznych.

## 1. Gemini CLI (Heavy Duty Analysis)
W przypadku złożonych zadań (architektura, głęboki audyt kodu, refaktoryzacja), agent Antigravity może delegować pracę do zewnętrznej instancji **Gemini CLI** (wersja 0.39.1+), aby uzyskać wynik 1:1 do integracji.

*   **Ścieżka binarna**: `C:\Users\akarn\AppData\Roaming\npm\gemini.cmd`
*   **Model**: `models/gemini-3.1-pro-preview` (Heavy Duty Analysis)
*   **Workflow**:
    1.  Przygotowanie promptu z kontekstem zadania.
    2.  Wywołanie przez terminal: `C:\Users\akarn\AppData\Roaming\npm\gemini.cmd -m models/gemini-3.1-pro-preview -p "PROMPT_TUTAJ"`
    3.  Pobranie wyniku i implementacja w kodzie.

## 2. CLI Companion
Projekt korzysta z wtyczki **CLI Companion**, która wspomaga interakcję między agentem a terminalem systemowym, umożliwiając sprawną wymianę informacji i automatyzację zadań.

## 3. Standardy Wykonania
- **Proste zadania**: Rozwiązywane bezpośrednio przez agenta Antigravity w edytorze.
- **Złożone zadania**: Wysyłane do Gemini CLI w celu uzyskania wysokiej jakości analizy strategicznej.
- **Wynik**: Zawsze dążymy do otrzymania wyniku gotowego do wdrożenia 1:1.

---
*Ostatnia aktualizacja: 2026-04-25*
