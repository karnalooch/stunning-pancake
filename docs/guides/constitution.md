# PROJECT CONSTITUTION: "SPORT" (v2.1 Gold Master)

## 0. Żelazne Zasady (Core Directives)
Te zasady są nadrzędne wobec wszystkich innych wytycznych technicznych i operacyjnych:

1.  **Strategia "Power Couple" (Python + TypeScript)**: Rdzeń systemu opiera się na unifikacji stosu technologicznego.
    *   **Backend:** Python (Django/FastAPI) – siła analityczna i AI.
    *   **Frontend/Mobile:** TypeScript (React / React Native Expo 54) – spójność UI i współdzielenie logiki.
    *   Stos technologiczny: **Next.js 15, RN 0.81, Mantine v7, Skia, PowerSync, Django/FastAPI, Kubernetes (K8s)** stanowi nienaruszalny fundament silnika.

2.  **Zasada Izolacji Stosu Danych (SaaS Integrity):** Citus i PostgreSQL są traktowane jako zewnętrzne usługi systemowe. Kod platformy SPORT (Backend/Owner) pozostaje w 100% zamknięty i chroniony przed "infekcją" AGPL.

3.  **Zasada Suwerenności Ownera (Sovereign Control):** Najwyższym poziomem dostępu jest **Platform Owner** (Ty). Zarządzanie systemem odbywa się przez dedykowany `Owner Panel`, odseparowany od ról administracyjnych miast.

4.  **Zgodność z Prawem**: Cały projekt, od logiki backendu po interfejs użytkownika, musi być w 100% zgodny z obowiązującymi przepisami prawa (w szczególności RODO/GDPR oraz przepisami skarbowymi VAT OSS/JPK).

5.  **Prywatność i Bezpieczeństwo Ponad Wszystko**: Bezpieczeństwo transakcji finansowych (PCI DSS) oraz absolutna prywatność danych lokalizacyjnych użytkownika są priorytetem najwyższego rzędu. Każda funkcja musi być projektowana przez pryzmat *Privacy-by-Design* (Article 10).

6.  **Identytet Wizualny "Cyber-Monolith"**: Obowiązkowym schematem kolorystycznym platformy jest **Cyan (#00D1FF)** jako kolor podstawowy oraz **Purple (#B066FF)** jako kolor akcentowy. Wszystkie moduły white-label muszą respektować ten fundament wizualny.
7.  **Zasada Agentic Engineering (AI-First Development)**: Projekt jest rozwijany we współpracy z autonomicznymi subagentami. Narzędzie `geminicli` jest nienaruszalnym elementem ekosystemu, służącym do automatyzacji, audytów i ewolucji kodu w czasie rzeczywistym.
8.  **Standard Hybrydowej Analizy (Heavy Duty Workflow)**: W przypadku złożonych zadań architektonicznych lub refaktoryzacji, agent deleguje pracę do zewnętrznej instancji **Gemini CLI** (model: `gemini-3.1-pro-preview`). Wyniki z CLI muszą być integrowane 1:1, zachowując spójność logiczną silnika SPORT.
9.  **Protokół Milestone Integrity**: Każde zakończenie Kamienia Milowego (Milestone) MUSI zostać sfinalizowane przez subagenta w trzech krokach: (1) Pełna aktualizacja dokumentacji (docs/), (2) Commit zmian, (3) Push do repozytorium zdalnego.


### Status Kamieni Milowych (v2.1):
- [x] **Unifikacja Mobile:** Expo 54 + RN 0.81 (Zakończone)
- [x] **Orkiestracja K8s:** Triple-Redundant Backend + Sovereign Owner Panel (Zakończone)
- [x] **Security Fortress & Recovery:** 0 podatności + Skrypt Bootstrap (Zakończone)
- [ ] **Global Rollout:** Pierwsza instancja miejska w klastrze (W toku)


## 0.2 Disaster Recovery (Odzyskiwanie Systemu)
W przypadku utraty środowiska pracy, proces odtworzenia pełnej mocy deweloperskiej jest zautomatyzowany:
1. **Klonowanie:** Pobierz repozytorium z kodem.
2. **Bootstrap:** Uruchom `.\setup-environment.ps1` (zainstaluje Podmana, K8s, Skaffolda).
3. **Klaster:** Uruchom Podman Desktop, a następnie `kind create cluster --name kind-cluster`.
4. **Start:** Uruchom `.\dev.ps1` – system sam zbuduje obrazy i postawi infrastrukturę.

## 1. Mission and Identity
A B2B/B2C sports platform built 100% on **Permissive Open Source** foundations and a rigorous **Safety Constitution** (AI Quality Standards). The project aims to provide advanced telemetry, gamification, and social tools while maintaining full commercial freedom (White-Label) without the risk of copyleft (GPL) infection. Licensing for all frontend/mobile modules is **MIT**.
