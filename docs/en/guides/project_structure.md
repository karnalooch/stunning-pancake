# PROJECT STRUCTURE: SPORT PLATFORM (MILESTONE 9 - GOLD MASTER)

```text
stunning-pancake/
├── .github/
│   └── workflows/
│       └── ci.yml              ← Automated testing (Ruff, Pytest, ESLint)
│
├── backend/                    ← Django Core (Sovereign Engine)
│   ├── core/                   ← System settings & Plugin Registry
│   ├── activities/             ← The "Signal Processing" Heart (Anti-Cheat)
│   ├── events/                 ← Competitions & Leaderboards
│   ├── users/                  ← Identity & RBAC
│   └── Dockerfile              ← Non-root production image
│
├── admin/                      ← Owner Command Center (Next.js 15)
│   ├── src/
│   │   ├── modules/            ← Business Domains (Analytics, Anti-Cheat)
│   │   └── core/               ← App Shell & Auth Logic
│   └── Dockerfile              ← Nginx-hardened production image
│
├── mobile/                     ← Athlete App (Expo 54 / RN 0.81)
│   ├── src/                    ← Shared business logic
│   └── app.json                ← Expo configuration
│
├── infrastructure/             ← Cloud-Native Orchestration
│   └── kubernetes/             ← K8s manifests (Owner-centric)
│       └── base/               ← Deployment, Service, Ingress, HPA
│
├── docs/                       ← Knowledge Base (Constitution, Audits)
│
├── dev.ps1                     ← Automated Development Engine
├── setup-environment.ps1       ← Disaster Recovery & Bootstrap
└── skaffold.yaml               ← Continuous Delivery Config
```

### Key Architectural Decisions (v2.1):
1. **Container Sovereignty**: Every component runs as a non-privileged user (UID 1001/101).
2. **K8s First**: Docker-compose is deprecated in favor of Kubernetes (Kind/Podman).
3. **Agentic Ready**: Integrated `geminicli` for continuous code evolution and security auditing.
4. **Data Isolation**: Citus/PostgreSQL handled as infrastructure services, protecting the core SPORT IP.
