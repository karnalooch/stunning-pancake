# PROJECT CONSTITUTION: "SPORT"

## 1. Mission and Identity
A B2B/B2C sports platform built 100% on **Permissive Open Source** foundations and a rigorous **Safety Constitution** (AI Quality Standards). The project aims to provide advanced telemetry, gamification, and social tools while maintaining full commercial freedom (White-Label) without the risk of copyleft (GPL) infection.

## 2. Tech Canon (Permissive Stack)
Strictly selected components to ensure business security:
- **Telemetry Core**: Traccar (Apache 2.0).
- **Mobile Tracking**: OpenTracks (ISC).
- **Validation and Map-Matching**: BRouter (MIT).
- **Map Visualization**: MapLibre GL (BSD-2/MIT).
- **Communication**: Matrix (Apache 2.0).
- **Gamification**: Redis (BSD-3-Clause).
- **Interfaces**: Flutter (BSD-3).

## 3. Visual Vision (UX/UI Manifesto)
The interface must inspire trust and motivate activity.
- **Aesthetic**: Dark mode, glassmorphism, dynamic gradients.
- **Data Visualization**: High-performance vector maps, interactive telemetry charts.
- **Projects**: Management Panel (Admin Panel) as a command center with Live view.

### User Application (Android/iOS)
#### Active Session View
![User App Mockup](./assets/user_app_mockup.png)

#### Community and Clans (Matrix Chat)
![Community View](./assets/community_view_mockup.png)

#### Privacy Zones Configuration
![Privacy Zones](./assets/privacy_zones_mockup.png)

#### Rewards and Sponsors Marketplace
![Rewards Marketplace](./assets/rewards_marketplace_mockup.png)

### Management Panel (Web/Windows)
#### Main Dashboard
![Admin Panel Mockup](./assets/admin_panel_mockup.png)

#### Anti-Cheat Verification (Deep Dive)
![Anti-Cheat Detail](./assets/anticheat_detail_mockup.png)

#### City Analytics (Heatmaps)
![City Analytics](./assets/city_analytics_mockup.png)

## 4. System Architecture
### Offline-First Model
The mobile app treats the local database (SQLite) as the single source of truth during an activity. Synchronization with the server occurs asynchronously (batching), minimizing battery consumption.

### Anti-Cheat System
Every GPX track is topologically validated by the BRouter engine. The system detects GPS "drifting" and cheating attempts (e.g., driving a car instead of running) through physical parameter analysis and OpenStreetMap topology.

### Leaderboards and Gamification
The use of **Sorted Sets** in Redis allows for instantaneous recalculation of rankings for millions of users with minimal overhead.

## 5. Privacy and Security
- **Privacy Zones**: Dynamic track masking near sensitive locations (home, work).
- **E2EE**: End-to-end encryption via the Matrix protocol.
- **Anonymization**: Variable-radius vector clipping triangulation.

## 6. Operational Standards (AI Toolkit)
The project applies strict **[Safety Constitution](./ai_toolkit_constitution.md)** rules, including:
- Article I: Safety First (no data loss, no blind execution).
- Article VI: Repair Discipline (no dead code, immediate bug fixes).
- Planning before implementation and evidence-based verification before task completion.

## 7. Commercial Model
- **B2B (Corporate Wellness)**: SaaS model with full client branding.
- **B2C (Freemium)**: Advanced training plans and premium maps.
- **Sponsors POI**: Dynamic partner points on the map with a voucher system.

## 8. Coding and Documentation Standards

To ensure the "SPORT" project is maintainable and readable for any professional developer, we strictly adhere to the following standards:

### 8.1 Python (Backend)
- **Tooling**: We use **Ruff** as our unified linter and formatter (replaces flake8, isort, black, and pyupgrade). Configuration is centralized in `pyproject.toml`.
- **Typing**: Strict type hints are required for all public APIs and core business logic. Use `mypy` or `pyright` for static analysis. Prefer `list[str]` over `typing.List[str]`.
- **Data Models**: Use **Pydantic v2** or **dataclasses** for structured data. Avoid raw dictionaries for complex objects.
- **Testing**: **pytest** is our standard testing framework. Follow the Arrange-Act-Assert (AAA) pattern.
- **Docstrings**: Use **Google Style** docstrings for all functions, classes, and modules.

### 8.2 TypeScript (Frontend/Mobile)
- **Tooling**: **ESLint** (Flat Config) for code quality and **Prettier** for formatting.
- **Type Safety**: `strict: true` must be enabled in `tsconfig.json`. Avoid `any` at all costs; use `unknown` if the type is truly uncertain.
- **Runtime Validation**: Use **Zod** for schema validation at the system boundaries (API responses, form inputs).
- **Naming Conventions**: 
  - Variables/Functions: `camelCase`
  - Classes/Types/Interfaces: `PascalCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Files/Folders: `kebab-case` (e.g., `user-profile-service.ts`)
- **Documentation**: Use **JSDoc** for all public functions and interfaces.

### 8.3 Documentation and Architecture
- **Architecture Decisions**: Major architectural changes must be documented using **ADR** (Architecture Decision Records) in the `docs/adr/` directory.
- **Project Docs**: All internal documentation must be written in **Markdown** and kept in the `docs/` folder.
- **Comments**: Code should be self-documenting. Use comments only to explain "Why" something is done, not "What" is done.

### 8.4 Git and Workflow
- **Commit Messages**: Follow **Conventional Commits** (e.g., `feat:`, `fix:`, `docs:`, `refactor:`).
- **PR Rules**: All PRs must pass linting, type checking, and tests before merging. 

## 9. Internationalization (i18n)
- **Primary Language**: English (Code, Commits, Documentation).
- **User Interface**: Multi-language support (i18n) with **Polish** as the default locale for end-users.
