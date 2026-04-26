# PROJECT CONSTITUTION: "SPORT" (v2.1 Gold Master)

## 0. Żelazne Zasady (Core Directives)
Te zasady są nadrzędne wobec wszystkich innych wytycznych technicznych i operacyjnych:

1.  **Strategia "Power Couple" (Python + TypeScript)**: Rdzeń systemu opiera się na unifikacji stosu technologicznego.
    *   **Backend:** Python (Django/FastAPI) – siła analityczna i AI.
    *   **Frontend/Mobile:** TypeScript (React / React Native Expo 54) – spójność UI i współdzielenie logiki.
    *   Stos technologiczny: **Next.js 15, RN 0.81, Mantine v7, Skia, PowerSync, Django/FastAPI, Kubernetes (K8s)** stanowi nienaruszalny fundament silnika.

2.  **Zasada Izolacji Stosu Danych (Data Stack Isolation)**: Każdy moduł platformy SPORT musi komunikować się z warstwą danych wyłącznie poprzez standardowe API sieciowe i protokoły (np. PostgreSQL Wire Protocol). Zabrania się ścisłego wiązania (tight coupling) kodu źródłowego aplikacji z wewnętrznymi bibliotekami komponentów objętych licencją AGPL (np. Citus). Komponenty te muszą być traktowane jako niezależne usługi infrastrukturalne, co gwarantuje pełną ochronę własności intelektualnej kodu SPORT w każdym modelu dystrybucji (SaaS i On-Premise).

3.  **Zgodność z Prawem**: Cały projekt, od logiki backendu po interfejs użytkownika, musi być w 100% zgodny z obowiązującymi przepisami prawa (w szczególności RODO/GDPR oraz przepisami skarbowymi VAT OSS/JPK).

4.  **Prywatność i Bezpieczeństwo Ponad Wszystko**: Bezpieczeństwo transakcji finansowych (PCI DSS) oraz absolutna prywatność danych lokalizacyjnych użytkownika są priorytetem najwyższego rzędu. Każda funkcja musi być projektowana przez pryzmat *Privacy-by-Design* (Article 10).

5.  **Identytet Wizualny "Cyber-Monolith"**: Obowiązkowym schematem kolorystycznym platformy jest **Cyan (#00D1FF)** jako kolor podstawowy oraz **Purple (#B066FF)** jako kolor akcentowy. Wszystkie moduły white-label muszą respektować ten fundament wizualny.


## 0.1 Milestone Tracker
- **Milestone 6: Hyper-Performance Foundation (Completed: 2026-04-25)**: Ustanowienie stosu technologicznego 2025/2026 jako oficjalnego fundamentu silnika „SPORT”.
- **Milestone 7: Gold Master Alignment (Completed: 2026-04-26)**: Pełna unifikacja dokumentacji strategicznej z implementacją TypeScript. Usunięcie długu technologicznego związanego z legacy Flutter.
- **Milestone 8: Enterprise Cluster Orchestration (Completed: 2026-04-26)**: Wdrożenie pełnej orkiestracji Kubernetes (K8s) z automatycznym skalowaniem (HPA), samoleczeniem i izolacją bezpieczeństwa.

## 1. Mission and Identity
A B2B/B2C sports platform built 100% on **Permissive Open Source** foundations and a rigorous **Safety Constitution** (AI Quality Standards). The project aims to provide advanced telemetry, gamification, and social tools while maintaining full commercial freedom (White-Label) without the risk of copyleft (GPL) infection. Licensing for all frontend/mobile modules is **MIT**.
