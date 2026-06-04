# Document

| | |
|--|--|
| **Status** | ✅ Active |
| **Owner role** | Documentation maintainer |
| **Last reviewed** | 2026-06-04 |
| **Audience** | Zobacz dokument kanoniczny |
| **lang** | pl |
| **translation** | [English](../../admin/README.md) |
| **canonical_path** | docs/pl/admin/README.md |
---

| | |
|--|--|
| **Stan** | ✅Aktywny |
| **Rola właściciela** | Administrator / Lider Frontendu |
| **Ostatnia recenzja** | 2026-06-03 |
| **Indeks** | [ADMIN_INDEX.md](./ADMIN_INDEX.md) |
| **Wersja** | Administrator v2.0 + Mapa na żywo / Symulator |

**Tech:** React 19 · Mantine v9 · Framer Motion · Zustand · Zapytanie TanStack

## Przegląd

Panel administracyjny 4VELO został przeprojektowany, dodając światowej klasy system premium UI z pełną obsługą trybu ciemnego, płynnymi animacjami i kompleksowym systemem tokenów projektowych.

**Najnowszy audyt interfejsu użytkownika (trasy, luki, plan działania zgodny ze standardami rynkowymi):** [UI_AUDIT_2026-06-02.md](../../admin/UI_AUDIT_2026-06-02.md)  
**Zamknięcie P0 (2026-06-02):** audyt §8 · dym po wdrożeniu → [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md)  
**Mapa drogowa P1 (paczki 1–6; 1a ✅, 1b rdzeń ✅ — brama operacyjna przed Paczką 2 Sponsor):** [P1_ROADMAP.md](./P1_ROADMAP.md)  
**Plan działania P2 (GPX F1–F6 + lista kontrolna §2.3, Auth/MFA):** [P2_ROADMAP.md](./P2_ROADMAP.md)  
**Weryfikacja produktu kolejowego:** [operations/RAILWAY_PRODUCTION_CHECKLIST.md](../../operations/RAILWAY_PRODUCTION_CHECKLIST.md) · `scripts/railway-verify-production.ps1`

## Stos technologii

| Warstwa | Technologia |
|-------|-----------|
| Ramy | Reaguj 19 + TypeScript |
| Zestaw interfejsu użytkownika | Mantine v9 (rdzeń, formularze, haki, powiadomienia) |
| Animacje | Framer Motion 12 |
| Ikony | Lucide React + Ikony Tablera |
| Trasowanie | Reaguj na router v7 (HashRouter) |
| stan | Zustand 5 + Zapytanie Reagujące 5 |
| Zbuduj | Wit 6 |
| Powłoka | Elektron (opakowanie na pulpit) |

## System projektowania

### Żetony kolorów

Wszystkie kolory są zdefiniowane jako niestandardowe właściwości CSS w `admin/src/theme/globals.css` i automatycznie odpowiadają schematowi kolorów Mantine (`data-mantine-color-scheme`).

**Marka:** Gradient indygo (`#6366F1 → #8B5CF6`) z animowanym wariantem przesunięcia gradientu.

**Paleta powierzchniowa:**
| Znak | Światło | Ciemny |
|-------|-------|------|
| `--powierzchnia` | `#FFFFFF` | `#1E293B` |
| `--powierzchnia-wtórna` | `#F8FAFC` | `#0F172A` |
| `--powierzchniowy trzeciorzędowy` | `#F1F5F9` | `#334155` |

**Kolory stanu:**
| Znak | Światło | Ciemny |
|-------|-------|------|
| `--sukces` | `#10B981` | `#34D399` |
| `--ostrzeżenie` | `#F59E0B` | `#FBBF24` |
| `-niebezpieczeństwo` | `#EF4444` | `#F87171` |

### Skala cienia

6 poziomów: `xs`, `sm`, `md`, `lg`, `xl` i `card` (kompozyt obramowania + cienia).

### Animacje

Wszystkie animacje wykorzystują klatki kluczowe CSS lub Framer Motion:
- `fadeInUp` — rozłożone wejście karty
- `shimmer` — ładowanie szkieletu
- `pulseDot` — wskaźniki stanu na żywo
- `gradientShift` — animowany tekst gradientowy
- „pływak” — dekoracyjne elementy pływające

### Typografia

- **Podstawowy:** Inter (Czcionki Google) — ładowany przez `@import` na górze globals.css
- **Monospace:** JetBrains Mono / Kod Fira / Kod Cascadia
- Funkcje: włączone `cv02`, `cv03`, `cv04`, `cv11` dla lepszego renderowania liczb

## Architektura```
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
```## Kluczowe funkcje

### Składany pasek boczny
- Pełna szerokość (260px) ↔ tylko ikona (72px) z przejściem CSS
- Nawigacja grupowa: Przegląd / Zarządzanie / Operacje / System
- Wskaźnik aktywności — animowany pasek akcentujący po lewej stronie
- Podpowiedzi w trybie zwiniętym
- Przełącznik trybu ciemnego/jasnego zintegrowany w stopce
- Profil użytkownika z awatarem gradientowym
- Stan utrwalony w `localStorage` (`zwinięty pasek boczny administratora`)

### Pulpit nawigacyjny
- **Spersonalizowane powitanie** — dostosowuje się do pory dnia
- **4 karty KPI** — naprzemienne wejście Framer Motion, winda po najechaniu, pojemniki z ikonami gradientu
- **Wskaźniki trendu** — obliczane automatycznie na podstawie tygodniowej delty (strzałki w górę/w dół/płaskie)
- **Ładowanie szkieletu** — animacja migotania podczas ładowania danych
- **Tabela według najemcy** — plakietki zdrowotne (Zdrowy/Recenzja/Krytyczny), paski postępu, animowane wiersze
- **Szybkie statystyki** — zweryfikowana liczba, oczekiwanie na sprawdzenie, całkowite spalone kcal
- **Sekcje oparte na rolach** — GLOBAL_OWNER widzi pełny przegląd, TENANT_ADMIN widzi statystyki miasta, TENANT_MODERATOR widzi listę roboczą

### Strona logowania
- **Układ na podzielonym ekranie** (tylko komputer stacjonarny)
  - Po lewej: panel gradientowy z logo, tekstem głównym, wyróżnieniami funkcji, dekoracyjnymi plamami
  - Po prawej: karta formularza z animowanymi komunikatami o błędach
- Animowane wejście z Framer Motion
- Gradientowy przycisk CTA z cieniem i uniesieniem po najechaniu

### Tryb ciemny
- Pełne wsparcie poprzez `data-mantine-color-scheme="dark"`
- Wszystkie zmienne CSS przemapowane na ciemne
- Przełącznik dostępny w stopce paska bocznego (zarówno w stanie rozwiniętym, jak i zwiniętym)
- Przestrzega preferencji systemu operacyjnego (`defaultColorScheme="auto"`)

### Zastąpienia motywu Mantine
- Karty: podwyższona powierzchnia z obramowaniem + cień
- Tabele: nagłówki z wielkimi literami, przyciemnione etykiety, subtelne przekładki
- Modale/szuflady: matowa nakładka, obramowany nagłówek
- Przyciski: główny gradient, zaokrąglone rogi
- Etykietki narzędzi: ciemny motyw ze strzałką
- Odznaki: małe odstępy między literami, zaokrąglone

## Struktura nawigacji

Menu paska bocznego jest logicznie pogrupowane w 6 głównych sekcjach biznesowych, aby uniknąć nadmiarowości, z uprawnieniami ograniczonymi przez rolę użytkownika.```
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
```Trasy są ściśle filtrowane na poziomie routera według roli użytkownika:

| Trasa / Moduł | WŁAŚCICIEL GLOBALNY | ADMIN_NAJEMCA | TENANT_MODERATOR | SPONSOR | SPORTOWCA |
|----------------|-------------|-------------|--------------------------------|---------|---------|
| **Panel ** | ✅ (Globalny) | ✅ (Najemca) | ✅ (Tylko do odczytu) | | |
| **Symulator** | ✅ | ✅ | | | |
| **Najemcy i branding** | ✅ | ✅ (własny najemca)| | | |
| **Menedżer użytkowników** | ✅ (Wszystkie + Edycja)| ✅ (Najemca + Edycja)| ✅ (Tylko do odczytu) | | |
| **Działania** | ✅ | ✅ | ✅ | | |
| **SOC zapobiegający oszustwom** | ✅ (Wszystkie + Moderacja)| ✅ (Najemca + Moderacja)| ✅ (Tylko do odczytu) | | |
| **Menedżer wydarzeń** | ✅ (CRUD) | ✅ (Najemca CRUD) | ✅ (Tylko do odczytu) | | |
| **Mapa POI sponsora** | ✅ (CRUD) | ✅ (Najemca CRUD) | | ✅ (Własny CRUD) | |
| **Kupony i nagrody**| ✅ (Zarządzaj) | | | ✅ (Zarządzaj) | |
| **Ustawienia Systemowe** | ✅ | ✅ | | | |

---

## 🛠️ Specyfikacja architektury i planu działania wersji 3.0

Aby uzyskać szczegółowe informacje na temat wydajnego paginacji, integracji śledzenia GPS MapLibre GL, interaktywnych kart kuponów sponsorskich 3D i naszego nadchodzącego Studia dostosowywania trenerów AI, zapoznaj się z naszym dedykowanym dokumentem specyfikacji:
👉 **[ROADMAP_V3.md](./ROADMAP_V3.md)**


## Komponenty wielokrotnego użytku

### `<Karta Statystyki />````tsx
<StatCard
  icon={<Users size={18} />}
  label="Total Athletes"
  value={stats.total_users.toLocaleString()}
  variant="indigo"
  loading={loading}
  trend={{ value: "+42", direction: "up", label: "this week" }}
  index={0}        // for stagger animation delay
/>
```**Rekwizyty:** `ikona`, `etykieta`, `wartość`, `trend`, `wariant`, `ładowanie`, `indeks`
**Warianty:** `niebieski` | „indygo” | `fioletowy` | „zielony” | `pomarańczowy` | `czerwony` | `cyjan` | „różowy”.

### `<Nagłówek strony />````tsx
<PageHeader
  title="Global Dashboard"
  subtitle="All platform instances overview"
  gradient={true}
  breadcrumbs={[
    { label: "Home", href: "/" },
    { label: "Dashboard" }
  ]}
/>
```**Rekwizyty:** `tytuł`, `podtytuł`, `gradient`, `bułka tarta`, `dzieci`

## Mapa na żywo i symulator (`src/modules/analytics/`)

| Moduł | Opis |
|------|------|
| `Mapa na żywo.tsx` | Mapa na żywo MapLibre — warstwy GPU, API LOD, pasek stanu synchronizacji |
| `liveMapLayers.ts` | Klastry, ikony, etykiety, huby miast (symbol/kółko) |
| `liveMapZoom.ts` | Stopień powiększenia + `szczegóły=podsumowanie\|standard\|pełny` |
| `liveMapHealth.ts` / `liveMapPoll.ts` / `LiveMapStatusBar.tsx` | Synchronizacja stanu, odpytywanie SLO, zdegradowany UX |
| `liveMapStream.ts` / `liveMapWs.ts` | SSE + opcjonalna telemetria WS |
| `liveMapRing.ts` / `liveMapPolyline.ts` | Pierścień 3 pkt + interpolacja po polilinii |
| `liveMapViewport.ts` | Klawisz rzutni, nieaktualne-puste po powiększaniu/przesuwaniu |
| `liveMapMarkers.ts` | Typowe pozycje, `resolveActivityKind`, wyskakujące okienka pomocnicze |
| `Strona symulatora.tsx` | Batch + orkiestracja na żywo („waitForBatchComplete”) |
| `SymulacjaProgressBar.tsx` | Pasek zabezpieczający wsad / wytrzeć |

Element Runbook: [operations/LIVE_MAP.md](../../operations/LIVE_MAP.md), [operations/SIMULATOR.md](../../operations/SIMULATOR.md). API: [API.md](../API.md) § Admin.

## Rozwój```bash
cd admin
npm install
npm run dev          # Start dev server
npm run build        # Production build (Vite)
npm run lint         # ESLint
npm run test         # Vitest
npm run test:e2e     # Playwright E2E
npm run electron:dev # Desktop app mode
```### Automatyzacja audytu interfejsu użytkownika```bash
ADMIN_URL=https://admin-production-083b.up.railway.app \
ADMIN_USER=global_owner ADMIN_PASS='…' \
node scripts/audit-admin-full.mjs   # → audit-screenshots/audit-report.json
node scripts/explore-admin.mjs      # → probe-screenshots/report.json
```Zobacz [UI_AUDIT_2026-06-02.md](../../admin/UI_AUDIT_2026-06-02.md), aby zapoznać się z ustaleniami i priorytetami P0–P3. Po ponownym wdrożeniu uruchom [P0_SMOKE_CHECKLIST.md](./P0_SMOKE_CHECKLIST.md) przed uruchomieniem P1.

### Audyt niezawodności/wydania

Aby zapoznać się z praktycznymi bramkami zwalniającymi niezawodność i obsługą incydentów 409/lock/zablokowanego zadania, zobacz:
[../reports/RELIABILITY_AUDIT_PLAYBOOK.md](../reports/RELIABILITY_AUDIT_PLAYBOOK.md)

## Decyzje projektowe

1. **Zmienne CSS w przypadku tokenów Mantine** — System kolorów Mantine jest ograniczony. Niestandardowe zmienne CSS zapewniają nam pełną kontrolę w trybie ciemnym i spójność między komponentami.
2. **Ruch klatek w przypadku przejść CSS** — Złożone animacje schodkowe i efekty podnoszenia po najechaniu kursorem są znacznie łatwiejsze w przypadku wartości ruchu.
3. **localStorage dla stanu paska bocznego** — Nie ma potrzeby korzystania z Zustand ani kontekstu; zwinięta preferencja jest specyficzna dla użytkownika i trwała w sesjach.
4. **Wzorzec komponentu na kartę** — „Karta StatCard” jest wyodrębniana w celu uniknięcia powielania modułów panelu kontrolnego i utrzymania spójnego zachowania animacji/gradientu.
5. **Gradient marki nad jednolitym kolorem** — Gradient w kolorze indygo zapewnia wrażenie premium, którego nie można uzyskać w przypadku płaskich kolorów, szczególnie w przypadku brandingu strony logowania i kontenerów ikon.
