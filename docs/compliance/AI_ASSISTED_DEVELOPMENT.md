# Rozwój wspomagany AI — 4VELO

| | |
|--|--|
| **Status** | Active — engineering governance |
| **Data** | 2026-09-28 |
| **Owner role** | Product / Engineering / Security |
| **lang** | pl |
| **translation** | [English](../en/compliance/AI_ASSISTED_DEVELOPMENT.md) |
| **canonical_path** | docs/compliance/AI_ASSISTED_DEVELOPMENT.md |

4VELO może używać ChatGPT, Codex i innych narzędzi generatywnego AI do
planowania, implementacji, testów, dokumentacji i review. Output AI jest
propozycją wymagającą weryfikacji, a nie dowodem poprawności.

Obowiązuje:

- człowiek definiuje zakres i kryteria akceptacji;
- diff przechodzi normalny review;
- AI nie może obniżać ani omijać testów, security gates i release gates;
- kod zewnętrzny i rozpoznawalnie zapożyczone fragmenty wymagają normalnego
  review licencji i pochodzenia;
- sekrety, produkcyjne dane użytkowników i niezanonimizowane logi nie powinny
  trafiać do osobistych narzędzi AI;
- przy danych poufnych lub produkcyjnych wymagane jest zatwierdzone środowisko
  i właściwe warunki przetwarzania;
- decyzje o użytkownikach, w szczególności zasady anti-cheat wpływające na
  nagrody, bany lub wykluczenia, pozostają zatwierdzane przez człowieka.

Aktualne warunki OpenAI dla Codex wskazują, że wygenerowany kod może podlegać
licencjom osób trzecich:
https://openai.com/policies/service-terms/

Art. 4 AI Act wymaga działań wspierających odpowiedni poziom kompetencji AI u
osób obsługujących i używających systemów AI:
https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:32024R1689

Samo użycie AI do tworzenia zwykłego kodu 4VELO nie jest traktowane jako
substytut dokumentacji technicznej, testów ani provenance.
