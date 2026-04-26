# ⚖️ KONSTYTUCJA PLATFORMY SPORT (v2.1 Gold Master)
> "Sovereignty through Code. Performance through Discipline."

## 1. MISJA I TOŻSAMOŚĆ (Mission & Identity)
Platforma SPORT to wysokowydajny ekosystem B2B/B2C zbudowany na fundamentach **Permissive Open Source** (MIT/Apache 2.0). Naszym celem jest dostarczenie precyzyjnej telemetrii, grywalizacji i narzędzi społecznościowych przy zachowaniu pełnej wolności komercyjnej (White-Label) i absolutnej prywatności użytkownika.

---

## 2. FILARY INŻYNIERYJNE (The Core Directives)

### I. Strategia Technologiczna ("Power Couple")
*   **Zasada 1:** Rdzeń to unifikacja: **Python (Backend)** + **TypeScript (Frontend/Mobile)**. Nienaruszalny stos: Next.js 15, RN 0.81, Mantine v7, Skia, Django/FastAPI, Kubernetes.
*   **Zasada 2 (Izolacja SaaS):** Baza danych (PostgreSQL/Citus) to usługa zewnętrzna. Kod SPORT pozostaje czysty i chroniony przed infekcją copyleft (GPL).
*   **Zasada 3 (Suwerenność Ownera):** Najwyższy poziom to **Platform Owner**. Zarządzanie przez odizolowany `Owner Panel`, nadrzędny wobec administracji miast.

### II. Bezpieczeństwo i Prawo
*   **Zasada 4 (Zgodność):** 100% zgodności z RODO/GDPR oraz przepisami skarbowymi (VAT OSS/JPK).
*   **Zasada 5 (Privacy-by-Design):** Bezpieczeństwo finansowe (PCI DSS) i prywatność lokalizacji są priorytetem najwyższego rzędu (Article 10).

### III. Jakość i Wydajność (Enterprise Standard)
*   **Zasada 10 (Cloud-Native Parity):** Lokalny klaster (Kind/Podman) = Produkcja (1:1). Rygorystyczne limity zasobów.
*   **Zasada 11 (Ewolucja API):** Obowiązek kompatybilności wstecznej i semantycznego wersjonowania.
*   **Zasada 12 (Mandat 60 FPS):** Telemetria i wykresy MUSZĄ działać na GPU (Skia). Maksymalny czas wątku UI: 16ms.
*   **Zasada 13 (Zero-Regression QA):** Naprawa błędu wymaga testu reprodukującego ZANIM powstanie poprawka.

---

## 3. AGENTIC WORKFLOW & PROTOKOŁY

### IV. Współpraca z AI (Agentic Engineering)
*   **Zasada 7 (AI-First):** Narzędzie **Gemini CLI** (alias: `geminicli`, binarka: `gemini.cmd`) jest nienaruszalnym elementem ekosystemu. 
    *   *Path (Windows):* `C:\Users\akarn\AppData\Roaming\npm\gemini.cmd`.
    *   *Usage:* Używane do audytów, generowania raportów i ewolucji kodu.
*   **Zasada 8 (Heavy Duty Analysis):** Złożone zadania delegowane do **Gemini CLI** (model: `gemini-3.1-pro-preview`). Integracja wyników 1:1.

### V. Zarządzanie Postępem (The Milestone Loop)
*   **Zasada 9 (Protocol):** Każdy Milestone MUSI zakończyć się następującą sekwencją:
    1.  **Audit:** Uruchomienie `gemini -p "Analyze state... and generate report"` dla bieżącego etapu.
    2.  **Documentation:** Wpis do `docs/audits/code_and_docs_audit.md` oraz aktualizacja planu implementacji.
    3.  **Commit:** `git commit -m "milestone: ..."` z jasnym odniesieniem do wersji.
    4.  **Push:** Synchronizacja ze zdalnym repozytorium.

### VI. Disaster Recovery (Plan Ratunkowy)
W przypadku awarii sprzętu:
1. **Bootstrap:** Uruchom `.\setup-environment.ps1` (instalacja narzędzi).
2. **Klaster:** `kind create cluster --name kind-cluster`.
3. **Start:** `.\dev.ps1` (automatyczna odbudowa świata).

---

## 4. ESTETYKA "CYBER-MONOLITH"
Obowiązkowy fundament wizualny:
*   **Primary:** Cyan (#00D1FF)
*   **Accent:** Purple (#B066FF)
*   **Style:** Mica/Fluent, Glassmorphism, Spring Animations.

---

## 5. REJESTR KAMIENI MILOWYCH (Milestone Tracker)
- [x] **v2.1 Gold Master (K8s & Security):** Pełna orkiestracja + Audyt 0-podatności. (Zakończone)
- [x] **Enterprise Quality Standards:** Mandat 60 FPS + Zero-Regression QA. (Zakończone)
- [ ] **Global Rollout:** Pierwsza instancja miejska w klastrze. (W toku)
