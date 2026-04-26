# STRUKTURA PROJEKTU: PLATFORMA SPORT (KAMIEN MILOWY 9 - GOLD MASTER)

```text
stunning-pancake/
├── .github/
│   └── workflows/
│       └── ci.yml              ← Automatyczne testy (Ruff, Pytest, ESLint)
│
├── backend/                    ← Rdzeń Django (Silnik Suwerenności)
│   ├── core/                   ← Ustawienia systemu i Rejestr Wtyczek
│   ├── activities/             ← Serce "Przetwarzania Sygnałów" (Anti-Cheat)
│   ├── events/                 ← Zawody i Rankingi
│   ├── users/                  ← Tożsamość i RBAC (Role-Based Access Control)
│   └── Dockerfile              ← Obraz produkcyjny non-root
│
├── admin/                      ← Centrum Dowodzenia Właściciela (Next.js 15)
│   ├── src/
│   │   ├── modules/            ← Domeny Biznesowe (Analityka, Anti-Cheat)
│   │   └── core/               ← App Shell i Logika Uwierzytelniania
│   └── Dockerfile              ← Utwardzony obraz produkcyjny Nginx
│
├── mobile/                     ← Aplikacja Sportowca (Expo 54 / RN 0.81)
│   ├── src/                    ← Współdzielona logika biznesowa
│   └── app.json                ← Konfiguracja Expo
│
├── infrastructure/             ← Orkiestracja Cloud-Native
│   └── kubernetes/             ← Manifesty K8s (skoncentrowane na Właścicielu)
│       └── base/               ← Deployment, Service, Ingress, HPA
│
├── docs/                       ← Baza Wiedzy (Konstytucja, Audyty)
│   ├── pl/                     ← Dokumentacja w języku polskim
│   └── en/                     ← Dokumentacja w języku angielskim
│
├── dev.ps1                     ← Zautomatyzowany Silnik Deweloperski
├── setup-environment.ps1       ← Disaster Recovery i Bootstrap
└── skaffold.yaml               ← Konfiguracja Continuous Delivery (zastępowana przez dev.ps1)
```

### Kluczowe Decyzje Architektoniczne (v2.1):
1. **Suwerenność Kontenerów**: Każdy komponent działa jako użytkownik bez uprawnień (UID 1001/101).
2. **K8s First**: Docker-compose jest wygaszany na rzecz Kubernetes (Kind/Podman).
3. **Agentic Ready**: Zintegrowany `geminicli` dla ciągłej ewolucji kodu i audytu bezpieczeństwa.
4. **Izolacja Danych**: Citus/PostgreSQL traktowane jako usługi infrastrukturalne, chroniące własność intelektualną (IP) SPORT.
