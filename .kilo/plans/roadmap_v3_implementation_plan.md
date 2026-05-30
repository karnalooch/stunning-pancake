# 🏆 4VELO Admin Portal v3.0 — Comprehensive Implementation Plan

This document maps out the phased execution strategy for delivering **ROADMAP V3** features for the 4VELO Platform (React + Mantine + Django). It also introduces two advanced administrative modules designed to give the `GLOBAL_OWNER` total control over all cities, features, and system infrastructure.

---

## 🏛️ 1. Execution Phases & Milestones

We will implement ROADMAP V3 in 5 structured, incremental phases to ensure zero regression, full Type-safety, and strict compliance with Row-Level Security (RLS).

```
┌────────────────────────────────────────────────────────┐
│ Phase 1: Core Schema & API Extensions (Backend)        │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ Phase 2: MapLibre GL Routing & POI Editors (Frontend)  │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ Phase 3: Live Smartphone Simulator & White-Label       │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ Phase 4: Anti-Cheat SOC & Moderation Console           │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ Phase 5: Premium Extensions (AI Coach, 3D, ESG)        │
└────────────────────────────────────────────────────────┘
```

### Phase 1: Core Schema & API Extensions (Backend)
1. **Tenant Schema Enhancements**: Expand `Tenant.config_json` schema to include:
   * AI Coach configurations: `ai_coach_personality`, `ai_coach_custom_prompt`, trigger thresholds.
   * ESG factors: `co2_savings_factor` (default 0.21 kg/km), `fuel_savings_factor` (default 0.07 l/km).
   * Active Module flags: `modules_enabled: { ai_coach: bool, esg_portal: bool, vouchers_3d: bool }`.
2. **POI ViewSet Upgrade**: Shift `POIViewSet` to inherit from `ModelViewSet`. Add writing permissions limited to `GLOBAL_OWNER` and the designated `SPONSOR` user.
3. **Activity Detailed Telemetry Endpoint**: Expand `/activities/sessions/<pk>/detail/` payload to supply not only `route_coords` but also associated velocity/elevation array streams (`velocities`, `altitudes`).

### Phase 2: MapLibre GL Routing & POI Editors (Frontend)
1. **Activity Detail Polyline Overlay**:
   * Implement MapLibre GL instance inside `ActivityDetail.tsx`.
   * Overlay GPS path utilizing neon gradient colors (neon-cyan for verified, neon-orange for suspicious).
2. **Telemetry Sparkline & Hover Synchronization**:
   * Render custom Mantine-compatible micro-charts showing speed/altitude profiles.
   * Synchronize hover events on the chart with a moving cursor marker on the MapLibre GPS map.
3. **POI Map Editor on Sponsor Dashboard**:
   * Embed MapLibre GL instance in Sponsor View.
   * Add click-to-create POI forms and marker drag-and-drop mechanics to modify latitude/longitude on backend.

### Phase 3: Live Smartphone Simulator & White-Label
1. **Real-time CSS Variables Binding**:
   * Wire the color inputs in `WhiteLabelEngine.tsx` to update CSS variables dynamically.
2. **Premium Smartphone Mockup Wrapper**:
   * Code a beautiful CSS-only phone wrapper complete with glossy bezel, reflection, and dynamic island.
   * Embed simulated dashboard screen and preview switcher.
3. **Backend Branding Sync**:
   * Integrate branding saving and loading with the `/users/branding/<tenant_id>/update/` API.

### Phase 4: Anti-Cheat SOC & Moderation Console
1. **BRouter Comparison Layer**:
   * In `AntiCheat.tsx` drawer, render overlapping red (raw trajectory) and blue (snapped BRouter path) MapLibre layers.
2. **ML daily timeline charts**:
   * Implement bar charts summarizing the count of daily anomaly captures.
3. **One-Click Moderation Buttons**:
   * Wire buttons (Ban, Warning, Discard) to call corresponding backend action endpoints.

### Phase 5: Premium Extensions
1. **AI Coach Customizer (ADR 007)**: Personality cards, prompt length limiters (150 chars), trigger sliders, and simulated wave-animated audio preview sandbox.
2. **3D Interactive Card Preview**: CSS perspective hover transforms and moving holo-gloss glares for sponsor reward cards.
3. **ESG Dashboard**: CO₂/fuel offset metrics, green commuting density maps, and printable ESG reports.

---

## ⚡ 2. New Premium Management & Control Ideas (Proposed)

To provide the `GLOBAL_OWNER` with state-of-the-art management tools, we propose implementing two advanced control centers:

### Idea #1: Central Feature Control Tower & Plan Quotas
An elite control panel where the global administrator can activate modules and limit resources per City/Tenant in real time, transforming 4VELO into a true enterprise multi-tenant SaaS platform.

* **Tenant Quotas Manager**:
  * Set physical caps on active users (`max_users`).
  * Set budgets for sponsor rewards (`voucher_budget`).
  * Configure API request throttles per tenant.
* **Granular Feature Toggles**:
  * Slider-controlled rollout: easily toggle advanced modules (AI Coach, 3D Vouchers, ESG metrics) per tenant.
  * *UI Implementation:* A beautiful grid of neon switch toggles in `Settings` visible only to `GLOBAL_OWNER`.

### Idea #2: Live Infrastructure & Citus Sharding Diagnostics Monitor
An interactive DevOps dashboard showing real-time health, memory, queues, and database shard allocation directly inside the Admin Portal, preventing future startup or connection crashes before they occur.

* **Citus Sharding Visualizer**:
  * Utilizes core API (`/api/infra/health/citus/`) to map sharded tables (`activities_activity`, `telemetry_raw`) across PostgreSQL workers.
  * Renders database nodes as interactive cards with status lights.
* **Celery & Redis Queue Dashboard**:
  * Live progress rings showing task queue length (critical, default, notifications, simulation).
  * Sparklines tracking Redis hits and active websocket links.
