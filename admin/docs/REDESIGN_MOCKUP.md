# 4VELO Admin OS — Redesign Mockup v2.0

## 🎨 Design Philosophy

> "Clean, modern, data-dense but breathable. Every pixel serves a purpose."

### Inspirations
- **Vercel Dashboard** — clean data density
- **Linear** — keyboard-first, minimal chrome
- **Stripe Dashboard** — beautiful data visualization
- **Raycast** — command palette, quick actions

---

## 📐 Layout Wireframes

### Desktop (1280px+)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ☰  4VELO Admin OS                                    🔔  👤  ️  │  ← Top bar (56px)
├──────────┬──────────────────────────────────────────────────────────┤
│          │                                                          │
│  📊 Dash │  Good morning, Owner 👋                                  │
│  🏢 Tenants │  Global platform overview — all tenants combined      │
│  👥 Users │                                                          │
│  🏗️ Depts │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  🛡️ Anti  │  │  12,847  │ │  48,291  │ │  847.2km │ │   94.2%  │  │
│  🎁 Sponsor│  │ Athletes │ │Activities│ │ Distance │ │ Verified │  │
│  📈 Analytics│  │  +234 ↑  │ │  +1,847↑ │ │  +42.1 ↑ │ │  127 ⚠  │  │
│  ⚙️ Settings│  └────────── └──────────┘ ──────────┘ └──────────┘  │
│          │                                                          │
│          │  ┌────────────────────────────────────────────────────┐  │
│          │  │  Per-Tenant Breakdown                    6 tenants │  │
│          │  ├────────────────────────────────────────────────────┤  │
│          │  │  Tenant        Users  Activities  Distance  Health │  │
│          │  │  ● Siedlce     4,231   18,492     234.1km   ✅    │  │
│          │  │  ● Warsaw      3,847   12,847     189.3km   ✅    │  │
│          │  │  ● Kraków      2,104    8,291     142.7km   ⚠️    │  │
│          │  │  ● Gdańsk      1,847    5,847      98.2km   ✅    │  │
│          │  │  ● Wrocław     818      2,814      82.9km   ❌    │  │
│          │  └────────────────────────────────────────────────────┘  │
│          │                                                          │
│          │  ┌──────────────────────┐ ┌──────────────────────────┐  │
│          │  │   System Intel     │ │  🗺️ Live Activity Map    │  │
│          │  │                      │ │                          │  │
│          │  │  "Platform health:   │ │     ●  ●                 │  │
│          │  │   94.2% verified     │ │   ●    ●  ●              │  │
│          │  │   127 pending        │ │  ●  ●      ●             │  │
│          │  │   3 anomalies"       │ │    ●  ●  ●   ●           │  │
│          │  │                      │ │                          │  │
│          │  └──────────────────────┘ └──────────────────────────┘  │
│          │                                                          │
│  ────────│                                                          │
│          │  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  👤 Admin │  │ ✅ 48,164│ │ ⚠️ 127   │ │ 🔥 2.4M  │                 │
│  Global   │  │ Verified │ │ Pending  │ │ kcal     │                 │
│  Owner    │  └──────────┘ └──────────┘ └──────────┘                 │
│          │                                                          │
│  🌙 Dark │  [Department Analytics] [User Map] [Activity Timeline]   │
│          │                                                          │
└────────────────────────────────────────────────────────────────────┘
   260px                        Content area (fluid)
```

### Tablet (768px - 1024px)

```
┌─────────────────────────────────────────────────────────┐
│  ☰  4VELO Admin OS                        🔔  👤  ️  │
├──────┬──────────────────────────────────────────────────┤
│      │                                                  │
│ 📊   │  Good morning, Owner 👋                          │
│ 🏢   │                                                  │
│ 👥   │  ┌────────── ┌──────────┐                      │
│ 🏗️   │  │  12,847  │ │  48,291  │                      │
│ 🛡️   │  │ Athletes │ │Activities│                      │
│ 🎁   │  └──────────┘ └──────────                      │
│    │                                                  │
│ ⚙️   │  ┌────────────────────────────────────────────┐  │
│      │  │  Per-Tenant Breakdown                      │  │
│      │  │  Siedlce    4,231   18,492   234.1km  ✅   │  │
│      │  │  Warsaw     3,847   12,847   189.3km  ✅   │  │
│      │  │  Kraków     2,104    8,291   142.7km  ⚠️   │  │
│      │  └────────────────────────────────────────────┘  │
│      │                                                  │
│      │  ┌──────────────────────┐                        │
│      │  │  🧠 System Intel     │                        │
│      │  │  Platform: 94.2%     │                        │
│      │  └──────────────────────┘                        │
│      │                                                  │
│ ──── │                                                  │
│      │                                                  │
│ 👤   │                                                  │
│ Admin│                                                  │
│      │                                                  │
│ 🌙   │                                                  │
│      │                                                  │
└──────┴──────────────────────────────────────────────────┘
  72px              Content area (fluid)
```

### Mobile (< 768px)

```
┌─────────────────────────────────┐
│  ☰  4VELO              🔔  👤  │  ← Top bar
├─────────────────────────────────┤
│                                 │
│  Good morning, Owner 👋         │
│  Global platform overview       │
│                                 │
│  ┌──────────┐ ┌──────────┐     │
│  │  12,847  │ │  48,291  │     │
│  │ Athletes │ │Activities│     │
│  │  +234 ↑  │ │  +1,847↑ │     │
│  └──────────┘ └──────────     │
│                                 │
│  ┌──────────┐ ┌──────────┐     │
│  │  847.2km │ │   94.2%  │     │
│  │ Distance │ │ Verified │     │
│  │  +42.1 ↑ │ │  127 ⚠  │     │
│  └──────────┘ └──────────     │
│                                 │
│  ┌────────────────────────────┐ │
│  │  Per-Tenant Breakdown      │ │
│  │  ● Siedlce  4,231  ✅      │ │
│  │  ● Warsaw   3,847  ✅      │ │
│  │  ● Kraków   2,104  ⚠️      │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌────────────────────────────┐ │
│  │  🧠 System Intelligence    │ │
│  │  Platform health: 94.2%    │ │
│  └────────────────────────────┘ │
│                                 │
├─────────────────────────────────┤
│  📊  🏢  👥  🛡️  ️            │  ← Bottom nav
└─────────────────────────────────┘
```

---

## 🎨 Color Palette

### Primary Brand Colors

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Primary          Secondary         Accent                  │
│  ┌─────┐          ┌─────┐          ┌─────                 │
│  │     │  #6366F1 │     │  #8B5CF6 │     │  #06B6D4       │
│  │     │  Indigo  │     │  Violet  │     │  Cyan          │
│  └─────┘          └─────┘          └─────┘                 │
│                                                             │
│  Success          Warning           Danger                  │
│  ┌─────          ┌─────┐          ┌─────┐                 │
│  │     │  #10B981 │     │  #F59E0B │     │  #EF4444       │
│  │     │  Emerald │     │  Amber   │     │  Red           │
│  └─────┘          └─────          └─────┘                 │
│                                                             │
│  Info             Purple            Pink                    │
│  ┌─────┐          ┌─────          ┌─────┐                 │
│  │     │  #3B82F6 │     │  #A855F7 │     │  #EC4899       │
│  │     │  Blue    │     │  Purple  │     │  Pink          │
│  └─────┘          └─────┘          └─────┘                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Surface Colors (Light Mode)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Background         Surface            Elevated             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │               │  │               │  │               │   │
│  │  #F8FAFC      │  │  #FFFFFF      │  │  #FFFFFF      │   │
│  │  Slate 50     │  │  White        │  │  + shadow     │   │
│  │               │  │               │  │               │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│                                                             │
│  Sidebar            Border             Border Subtle        │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │               │  │               │  │               │   │
│  │  #FFFFFF      │  │  #E2E8F0      │  │  #F1F5F9      │   │
│  │  White        │  │  Slate 200    │  │  Slate 100    │   │
│  │               │  │               │  │               │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Surface Colors (Dark Mode)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Background         Surface            Elevated             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │               │  │               │  │               │   │
│  │  #0F172A      │  │  #1E293B      │  │  #243447      │   │
│  │  Slate 900    │  │  Slate 800    │  │  Slate 750    │   │
│  │               │  │               │  │               │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│                                                             │
│  Sidebar            Border             Border Subtle        │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │               │  │               │  │               │   │
│  │  #1E293B      │  │  #334155      │  │  #1E293B      │   │
│  │  Slate 800    │  │  Slate 700    │  │  Slate 800    │   │
│  │               │  │               │  │               │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧩 Component Library

### Stat Card (New Design)

```
┌─────────────────────────────────────────┐
│  📊                          +12.5% ↑   │  ← Trend badge (top-right)
│                                         │
│  Total Athletes                         │  ← Label (text-secondary, 13px)
│  12,847                                 │  ← Value (text-primary, 28px, bold)
│                                         │
│  ─────────────────────────────────────  │  ← Sparkline area
│  ▁▂▃▅▄▆▇█▇▆▅▃▂▁                       │     (mini chart showing 7-day trend)
│                                         │
│  +234 this week                         │  ← Footer (text-tertiary, 12px)
└─────────────────────────────────────────┘
```

### Department Card

```
┌─────────────────────────────────────────┐
│  🏗️  Dział IT                  47 users │  ← Header with icon + count
│  ─────────────────────────────────────  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  👤 Jan Kowalski    Senior Dev   │  │  ← User row
│  │  👤 Anna Nowak      Frontend     │  │
│  │  👤 Piotr Wiśniewski  Backend    │  │
│  │  ... and 44 more                  │  │  ← Expandable
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Activities    1,247     ✅ 94%   │  │  ← Stats row
│  │  Distance      847.2km            │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [View Details] [Edit] [Delete]         │  ← Action buttons
└─────────────────────────────────────────┘
```

### User Map View

```
┌─────────────────────────────────────────────────────────────┐
│  🗺️  Live User Map                              🔍  ⚙️  📊  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                      ●                                      │
│                   ●     ●                                   │
│              ●              ●                               │
│           ●    ●    ●    ●    ●                             │
│        ●    ●    ●    ●    ●    ●                          │
│     ●    ●    ●    ●    ●    ●    ●                        │
│        ●    ●    ●    ●    ●                               │
│           ●    ●    ●    ●                                 │
│              ●    ●    ●                                   │
│                   ●    ●                                   │
│                      ●                                      │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Legend:  ● Active  ● Idle  ● Offline                 │  │
│  │  Filter:  [All Tenants ▼] [All Departments ▼]         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Activity Timeline

```
┌─────────────────────────────────────────────────────────────┐
│  📅  Activity Timeline                          📊  🔍      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Today                                                      │
│  ├── 14:32  🏃  Anna Nowak — Run 5.2km (28:14) ✅         │
│  ├── 13:15  🚴  Jan Kowalski — Bike 23.4km (1:12:34) ✅   │
│  ├── 11:47  🏃  Piotr Wiśniewski — Run 3.1km (18:42) ⚠️   │
│  ├── 10:22  🚶  Maria Zielińska — Walk 2.8km (32:15) ✅   │
│  └── 09:05  🏃  Tomasz Lewandowski — Run 8.7km (42:18) ✅ │
│                                                             │
│  Yesterday                                                  │
│  ├── 18:45  🚴  Anna Nowak — Bike 15.2km (48:22) ✅       │
│  ├── 16:30  🏃  Jan Kowalski — Run 10.1km (52:14) ✅      │
│  └── ...                                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Notifications Center

```
┌─────────────────────────────────────────────────────────────┐
│  🔔  Notifications                              Mark all ✅ │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Today                                                      │
│  ├── 🚨  Anomaly detected: User #4827 — teleport 2.3km    │
│  │     2 minutes ago                          [Review]     │
│  ├── ✅  Activity approved: Anna Nowak — Run 5.2km        │
│  │     15 minutes ago                                      │
│  ├── 📊  Weekly report ready for Siedlce tenant           │
│  │     1 hour ago                            [View]        │
│  ├── 👤  New user registered: Tomasz Nowak                │
│  │     2 hours ago                                         │
│  └──   Milestone: Warsaw reached 10,000 activities!     │
│        3 hours ago                                         │
│                                                             │
│  Yesterday                                                  │
│  ├── ...                                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📱 Responsive Behavior

### Breakpoints

| Breakpoint | Width | Sidebar | Navigation | Content |
|------------|-------|---------|------------|---------|
| `xs` | < 640px | Hidden | Bottom nav (5 items) | Single column |
| `sm` | 640px - 768px | Hidden | Bottom nav (5 items) | 2 columns |
| `md` | 768px - 1024px | Collapsed (72px) | Sidebar icons only | 2-3 columns |
| `lg` | 1024px - 1280px | Full (260px) | Sidebar with labels | 3-4 columns |
| `xl` | > 1280px | Full (280px) | Sidebar with labels | 4+ columns |

### Mobile Bottom Navigation

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                     Content Area                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───┐│
│  │    📊    │ │    🏢    │ │    👥    │ │    🛡️    │ │ ⋯ ││
│  │ Dashboard│ │ Tenants  │ │  Users   │ │ Anti-Cheat│ │More│
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 🆕 New Features

### 1. Command Palette (⌘K / Ctrl+K)
```
┌─────────────────────────────────────────────────────────────┐
│  🔍  Search or type a command...                            │
├─────────────────────────────────────────────────────────────┤
│  ACTIONS                                                    │
│  ├── 📊  Go to Dashboard                                    │
│  ├── 👥  Go to Users                                        │
│  ├── 🏗️  Go to Departments                                  │
│  ├── 🛡️  Go to Anti-Cheat                                   │
│                                                             │
│  QUICK ACTIONS                                              │
│  ├── ➕  Create new tenant                                  │
│  ├── 👤  Create new user                                    │
│  ├── 🏗️  Create new department                              │
│  ├── 📊  Export analytics                                   │
│                                                             │
│  RECENT                                                     │
│  ├── 📄  Siedlce Analytics Report                           │
│  ├── 👤  Anna Nowak — User Profile                          │
│  └── 🏗️  Dział IT — Department Details                      │
└─────────────────────────────────────────────────────────────┘
```

### 2. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘/` / `Ctrl+/` | Keyboard shortcuts help |
| `G` then `D` | Go to Dashboard |
| `G` then `U` | Go to Users |
| `G` then `T` | Go to Tenants |
| `G` then `A` | Go to Anti-Cheat |
| `N` then `U` | New user |
| `N` then `T` | New tenant |
| `N` then `D` | New department |
| `/` | Focus search |
| `?` | Keyboard shortcuts help |

### 3. Real-time Updates

- **WebSocket connection** for live data
- **Toast notifications** for important events
- **Badge counters** on nav items
- **Live map** with user positions

### 4. Department Analytics

```
┌─────────────────────────────────────────────────────────────┐
│  🏗️  Dział IT — Analytics                      📊  🔍  ⚙️  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │    47    │ │  1,247   │ │  847.2km │ │   94.2%  │      │
│  │  Users   │ │Activities│ │ Distance │ │ Verified │      │
│  │   +3 ↑   │ │  +89 ↑   │ │  +42 ↑   │ │   12 ⚠  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Activity by Type (Last 30 days)                      │  │
│  │                                                       │  │
│  │  🏃 Run     ████████████████████░░░░  68%            │  │
│  │  🚴 Bike    ████████████░░░░░░░░░░░░  22%            │  │
│  │  🚶 Walk    ████░░░░░░░░░░░░░░░░░░░░   8%            │  │
│  │  ♿ Other   ██░░░░░░░░░░░░░░░░░░░░░░   2%            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Top Performers                                       │  │
│  │                                                       │  │
│  │  🥇 Jan Kowalski      142.3km   47 activities        │  │
│  │  🥈 Anna Nowak        128.7km   42 activities        │  │
│  │  🥉 Piotr Wiśniewski  115.2km   38 activities        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 New Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `maplibre-gl` | Interactive maps | ~200KB |
| `recharts` | Charts & graphs | ~150KB |
| `@mantine/dates` | Date pickers | ~50KB |
| `@mantine/carousel` | Image carousels | ~30KB |
| `cmdk` | Command palette | ~15KB |
| `date-fns` | Date utilities | ~40KB |

**Total added**: ~485KB (gzipped: ~120KB)

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] New color palette & design tokens
- [ ] Updated Layout component (responsive)
- [ ] Mobile bottom navigation
- [ ] Command palette
- [ ] Keyboard shortcuts

### Phase 2: Dashboard 2.0 (Week 2)
- [ ] New stat cards with sparklines
- [ ] Activity feed
- [ ] Quick actions
- [ ] Department overview

### Phase 3: Map & Analytics (Week 3)
- [ ] MapLibre integration
- [ ] Live user positions
- [ ] Department analytics
- [ ] Activity timeline

### Phase 4: Polish (Week 4)
- [ ] Notifications center
- [ ] Loading states
- [ ] Error boundaries
- [ ] Performance optimization
- [ ] Accessibility audit

---

## 📊 Before vs After

| Metric | Before | After |
|--------|--------|-------|
| **Layout** | Fixed sidebar | Responsive (mobile/tablet/desktop) |
| **Navigation** | Sidebar only | Sidebar + bottom nav + command palette |
| **Stat Cards** | Basic numbers | Sparklines, trends, animations |
| **Maps** | None | MapLibre with live positions |
| **Charts** | None | Recharts with interactive graphs |
| **Keyboard** | None | Full keyboard navigation |
| **Mobile** | Not supported | Full mobile support |
| **Notifications** | Basic toasts | Notification center with history |
| **Search** | None | Command palette with fuzzy search |

---

## ✅ Checklist

- [ ] Design approved
- [ ] Color palette finalized
- [ ] Component library defined
- [ ] Responsive breakpoints set
- [ ] New dependencies approved
- [ ] Implementation phases agreed
- [ ] Timeline confirmed

---

*Last updated: 2026-05-15*
*Version: 2.0.0-draft*
