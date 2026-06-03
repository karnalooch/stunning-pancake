# Admin Panel — World-Class Dashboard Redesign

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Admin / Frontend Lead |
| **Last reviewed** | 2026-06-03 |
| **Index** | [ADMIN_INDEX.md](./ADMIN_INDEX.md) |
| **Version** | Admin v2.0 + Live Map / Simulator |

**Tech:** React 19 · Mantine v9 · Framer Motion · Zustand · TanStack Query

## Overview

The 4VELO Admin Panel has been redesigned with a world-class, premium UI system featuring full dark mode support, fluid animations, and a comprehensive design token system.

**Latest UI audit (routes, gaps, market-standard roadmap):** [UI_AUDIT_2026-06-02.md](./UI_AUDIT_2026-06-02.md)  
**P0 closure (2026-06-02):** audit §8 · post-deploy smoke → [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md)  
**P1 roadmap (paczki 1–6; 1a ✅, 1b core ✅ — operational gate przed Paczką 2 Sponsor):** [P1_ROADMAP.md](./P1_ROADMAP.md)  
**P2 roadmap (GPX F1–F6 + checklista §2.3, Auth/MFA):** [P2_ROADMAP.md](./P2_ROADMAP.md)  
**Railway prod verify:** [operations/RAILWAY_PRODUCTION_CHECKLIST.md](../operations/RAILWAY_PRODUCTION_CHECKLIST.md) · `scripts/railway-verify-production.ps1`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| UI Kit | Mantine v9 (Core, Forms, Hooks, Notifications) |
| Animations | Framer Motion 12 |
| Icons | Lucide React + Tabler Icons |
| Routing | React Router v7 (HashRouter) |
| State | Zustand 5 + React Query 5 |
| Build | Vite 6 |
| Shell | Electron (desktop wrapper) |

## Design System

### Color Tokens

All colors are defined as CSS custom properties in `admin/src/theme/globals.css` and respond automatically to the Mantine colour scheme (`data-mantine-color-scheme`).

**Brand:** Indigo gradient (`#6366F1 → #8B5CF6`) with animated gradient shift variant.

**Surface Palette:**
| Token | Light | Dark |
|-------|-------|------|
| `--surface` | `#FFFFFF` | `#1E293B` |
| `--surface-secondary` | `#F8FAFC` | `#0F172A` |
| `--surface-tertiary` | `#F1F5F9` | `#334155` |

**Status Colours:**
| Token | Light | Dark |
|-------|-------|------|
| `--success` | `#10B981` | `#34D399` |
| `--warning` | `#F59E0B` | `#FBBF24` |
| `--danger` | `#EF4444` | `#F87171` |

### Shadow Scale

6 levels: `xs`, `sm`, `md`, `lg`, `xl`, and `card` (border + shadow composite).

### Animations

All animations use CSS keyframes or Framer Motion:
- `fadeInUp` — staggered card entrance
- `shimmer` — skeleton loading
- `pulseDot` — live status indicators
- `gradientShift` — animated gradient text
- `float` — decorative floating elements

### Typography

- **Primary:** Inter (Google Fonts) — loaded via `@import` at top of globals.css
- **Monospace:** JetBrains Mono / Fira Code / Cascadia Code
- Features: `cv02`, `cv03`, `cv04`, `cv11` enabled for better number rendering

## Architecture

```
admin/src/
├── App.tsx                    # Root — MantineProvider, routing, auth gate
├── main.tsx                   # Entry — QueryClientProvider
├── api/                       # API client, admin API wrappers
├── core/
│   ├── auth/
│   │   ├── LoginPage.tsx      # Split-screen premium login
│   │   └── useAuth.ts         # Zustand auth store + RBAC
│   ├── components/
│   │   ├── PageHeader.tsx     # Reusable page header with gradient + breadcrumbs
│   │   └── StatCard.tsx       # Animated KPI card with trend indicators
│   ├── guards/
│   │   └── PermissionGuard.tsx # Route-level RBAC
│   └── Layout.tsx             # Collapsible sidebar + AppShell
├── modules/
│   ├── analytics/             # GlobalHeatmap, SystemIntelligence, CityAnalytics
│   ├── anti-cheat/           # Detection config + anomaly viewer
│   ├── dashboard/             # Main dashboard (stats, tenant table)
│   ├── public/               # Landing page
│   ├── settings/             # Admin settings
│   ├── sponsor/              # Sponsorship management
│   ├── tenants/              # White-label engine
│   └── users/                # User CRUD + audit log + impersonation
└── theme/
    ├── globals.css            # Design tokens, animations, utility classes
    └── index.ts               # Mantine theme config (indigo brand)
```

## Key Features

### Collapsible Sidebar
- Full width (260px) ↔ icon-only (72px) with CSS transition
- Grouped navigation: Overview / Management / Operations / System
- Active indicator — animated accent bar on left
- Tooltips in collapsed mode
- Dark/light mode toggle integrated in footer
- User profile with gradient avatar
- State persisted in `localStorage` (`admin-sidebar-collapsed`)

### Dashboard
- **Personalised greeting** — adapts to time of day
- **4 KPI cards** — staggered Framer Motion entrance, hover lift, gradient icon containers
- **Trend indicators** — auto-calculated from weekly delta (up/down/flat arrows)
- **Skeleton loading** — shimmer animation while data loads
- **Per-tenant table** — health badges (Healthy/Review/Critical), progress bars, animated rows
- **Quick stats** — verified count, pending review, total kcal burned
- **Role-based sections** — GLOBAL_OWNER sees full overview, TENANT_ADMIN sees city analytics, TENANT_MODERATOR sees worklist

### Login Page
- **Split-screen** layout (desktop only)
  - Left: gradient panel with logo, hero text, feature highlights, decorative blobs
  - Right: form card with animated error messages
- Animated entrance with Framer Motion
- Gradient CTA button with shadow + hover lift

### Dark Mode
- Full support via `data-mantine-color-scheme="dark"`
- All CSS variables remapped for dark
- Toggle available in sidebar footer (both expanded and collapsed states)
- Respects OS preference (`defaultColorScheme="auto"`)

### Mantine Theme Overrides
- Cards: elevated surface with border + shadow
- Tables: uppercase headers, dimmed labels, subtle dividers
- Modals/Drawers: frosted overlay, bordered header
- Buttons: gradient primary, rounded corners
- Tooltips: dark theme with arrow
- Badges: tight letter-spacing, rounded

## Navigation Structure

The sidebar menu is logically grouped under 6 core business sections to avoid redundancy, with permissions restricted by user role.

```
┌─────────────────────────────────┐
│ 4VELO Admin OS                  │
│ ─────────────────────────────── │
│ OVERVIEW                        │
│  📊  Dashboard                  │
│  📱  Smartphone Simulator       │
│                                 │
│ MANAGEMENT                      │
│  🏢  Tenants & Branding         │
│  👥  Users Manager (Drawer CRUD)│
│  🏢  Departments                │
│                                 │
│ OPERATIONS                      │
│  🏃  Activities                 │
│  🛡️  Anti-Cheat SOC Console     │
│  🏆  Events Manager CRUD        │
│                                 │
│ SPONSORSHIP & REWARDS           │
│  📍  Sponsor POI Map Editor     │
│  📊  Sponsorship Analytics      │
│  🎫  Vouchers & Rewards         │
│                                 │
│ ANALYTICS & FEEDBACK            │
│  📈  Department Analytics       │
│  🗺️  Global Heatmaps            │
│  💬  Beta Feedback Logs         │
│                                 │
│ SYSTEM                          │
│  ⚙️  Settings                   │
│  🛡️  RBAC permissions           │
│ ─────────────────────────────── │
│  🌙 Dark mode                   │
│  👤 Admin (Global Owner)  [⏻]  │
└─────────────────────────────────┘
```

Routes are strictly filtered at the router level by user role:

| Route / Module | GLOBAL_OWNER | TENANT_ADMIN | TENANT_MODERATOR | SPONSOR | ATHLETE |
|----------------|--------------|--------------|------------------|---------|---------|
| **Dashboard** | ✅ (Global) | ✅ (Tenant) | ✅ (Read-Only) | | |
| **Simulator** | ✅ | ✅ | | | |
| **Tenants & Branding** | ✅ | ✅ (Own Tenant)| | | |
| **Users Manager** | ✅ (All + Edit)| ✅ (Tenant + Edit)| ✅ (Read-Only) | | |
| **Activities** | ✅ | ✅ | ✅ | | |
| **Anti-Cheat SOC** | ✅ (All + Moderation)| ✅ (Tenant + Moderation)| ✅ (Read-Only) | | |
| **Events Manager** | ✅ (CRUD) | ✅ (Tenant CRUD) | ✅ (Read-Only) | | |
| **Sponsor POI Map** | ✅ (CRUD) | ✅ (Tenant CRUD) | | ✅ (Own CRUD) | |
| **Vouchers & Rewards**| ✅ (Manage) | | | ✅ (Manage) | |
| **System Settings** | ✅ | ✅ | | | |

---

## 🛠️ V3.0 Architecture & Roadmap Specification

For deep-dive details on high-performance pagination, MapLibre GL GPS tracking integrations, interactive 3D sponsorship voucher cards, and our upcoming AI Coach Customization Studio, please consult our dedicated specification document:
👉 **[ROADMAP_V3.md](./ROADMAP_V3.md)**


## Reusable Components

### `<StatCard />`
```tsx
<StatCard
  icon={<Users size={18} />}
  label="Total Athletes"
  value={stats.total_users.toLocaleString()}
  variant="indigo"
  loading={loading}
  trend={{ value: "+42", direction: "up", label: "this week" }}
  index={0}        // for stagger animation delay
/>
```
**Props:** `icon`, `label`, `value`, `trend`, `variant`, `loading`, `index`
**Variants:** `blue` | `indigo` | `violet` | `green` | `orange` | `red` | `cyan` | `pink`

### `<PageHeader />`
```tsx
<PageHeader
  title="Global Dashboard"
  subtitle="All platform instances overview"
  gradient={true}
  breadcrumbs={[
    { label: "Home", href: "/" },
    { label: "Dashboard" }
  ]}
/>
```
**Props:** `title`, `subtitle`, `gradient`, `breadcrumbs`, `children`

## Live Map & Simulator (`src/modules/analytics/`)

| Moduł | Opis |
|-------|------|
| `LiveMap.tsx` | MapLibre live map — GPU layers, LOD API, jeden popup DOM |
| `liveMapLayers.ts` | Klastry, ikony, etykiety, huby miast (symbol/circle) |
| `liveMapZoom.ts` | Tiery zoom + `detail=summary\|standard\|full` |
| `liveMapMarkers.ts` | Typy pozycji, `resolveActivityKind`, popup helpers |
| `SimulatorPage.tsx` | Batch + live orchestration (`waitForBatchComplete`) |
| `SimulationProgressBar.tsx` | Pasek postępu batch / wipe |

Runbook operacyjny: [operations/SIMULATOR.md](../operations/SIMULATOR.md). API: [API.md](../API.md) § Admin.

## Development

```bash
cd admin
npm install
npm run dev          # Start dev server
npm run build        # Production build (Vite)
npm run lint         # ESLint
npm run test         # Vitest
npm run test:e2e     # Playwright E2E
npm run electron:dev # Desktop app mode
```

### UI audit automation

```bash
ADMIN_URL=https://admin-production-083b.up.railway.app \
ADMIN_USER=global_owner ADMIN_PASS='…' \
node scripts/audit-admin-full.mjs   # → audit-screenshots/audit-report.json
node scripts/explore-admin.mjs      # → probe-screenshots/report.json
```

See [UI_AUDIT_2026-06-02.md](./UI_AUDIT_2026-06-02.md) for findings and P0–P3 priorities. After redeploy, run [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) before starting P1.

### Reliability / release audit

For practical reliability release gates and 409/lock/stuck-job incident handling, see:
[../reports/RELIABILITY_AUDIT_PLAYBOOK.md](../reports/RELIABILITY_AUDIT_PLAYBOOK.md)

## Design Decisions

1. **CSS variables over Mantine tokens** — Mantine's colour system is limited. Custom CSS variables give us full dark-mode control and consistency across components.
2. **Framer Motion over CSS transitions** — Complex staggered animations and hover lift effects are significantly easier with motion values.
3. **localStorage for sidebar state** — No need for Zustand or Context; the collapsed preference is user-specific and persistent across sessions.
4. **Component-per-card pattern** — `StatCard` is extracted to avoid duplication across dashboard modules and maintain consistent animation/gradient behaviour.
5. **Gradient brand over flat colour** — The indigo gradient gives a premium feel that flat colours cannot achieve, especially for login page branding and icon containers.