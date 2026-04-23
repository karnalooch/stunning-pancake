# PROJECT STRUCTURE (MONOREPO)

```text
SPORT/
├── backend/            # Python (Django/FastAPI) logic
├── mobile/             # Flutter application
├── web/                # React/Next.js Admin Panel
├── shared/             # Shared assets, schemas, and icons
├── docs/               # Documentation and visual mockups
│   └── assets/         # UI/UX Mockups (PNG)
├── scripts/            # Deployment and maintenance scripts
└── docker-compose.yml  # Infrastructure stack
```

## Module Responsibilities
- **backend**: Handles API, authentication, PostGIS data processing, and integration with Traccar/BRouter.
- **mobile**: User-facing app for session recording, maps, and social features.
- **web**: Administrator dashboard for city/corporate management and anti-cheat verification.
- **shared**: Common interface definitions and design tokens.
