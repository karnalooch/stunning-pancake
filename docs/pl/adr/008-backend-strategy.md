# ADR 008: Backend Integration Strategy (Power Couple)

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../adr/008-backend-strategy.md) |
| **canonical_path** | docs/pl/adr/008-backend-strategy.md |
---

## Stan
Zaakceptowano (13.05.2026)

## Kontekst
Platforma SPORT musi obsługiwać zarówno pozyskiwanie danych telemetrycznych o wysokiej częstotliwości, jak i złożoną logikę biznesową (użytkownicy, działania, tabele wyników, coaching AI).

## Decyzja
Przyjęliśmy **Strategię „Para Mocy”**:

### Podstawowe filary
1. **Ekosystem Pythona (Backend)**: Django jest naszym źródłem prawdy o danych użytkowników i bezpieczeństwie. Wykorzystujemy jego ORM do złożonych relacji i jego gotowość do sztucznej inteligencji do orkiestrowania modeli Gemini/GPT.
2. **Ekosystem TypeScript (Frontend)**: React Native (mobile) i React (Admin) obsługują wszystkie interakcje użytkownika.
3. **LLM Proxying**: Klienci mobilni NIGDY nie wywołują API OpenAI/Gemini bezpośrednio w środowisku produkcyjnym. Wszystkie żądania są kierowane przez proxy Pythona (`/api/llm/proxy/`). Dzięki temu możemy:
    - Obracaj klucze API bez wypychania aktualizacji aplikacji.
    - Zaimplementuj filtrowanie treści po stronie serwera.
    - Wstrzyknij tajne monity systemowe, które nie powinny być ujawniane w pakiecie mobilnym.
4. **Segregacja telemetrii**: Dane telemetryczne (GPS, HR) są przesyłane do wysokoprzepustowej usługi FastAPI zoptymalizowanej pod kątem TimescaleDB, zapobiegając spowolnieniu głównego biznesowego API Django przez duże obciążenia.

## Konsekwencje
- **Pozytywny**: Zwiększone bezpieczeństwo. Klucze API są ściśle po stronie serwera.
- **Pozytywny**: Integralność danych. Udostępnione schematy JSON zapewniają, że obiekt „Ride” wygląda identycznie w Pythonie i TypeScript.
- **Wadą**: koszty ogólne DevOps. Wdrożenie zarówno monolitu Django, jak i strumienia telemetrycznego FastAPI wymaga solidnej orkiestracji kontenerów (Docker Compose/Kubernetes).

---

## Pełna wersja (kanoniczna)

Pełny tekst ADR (język źródłowy dokumentu): **[008-backend-strategy.md](../../adr/008-backend-strategy.md)**.

> Skrót PL — nie zastępuje pełnego ADR przy review architektury.
