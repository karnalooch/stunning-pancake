# 4VELO Web — Stan projektu (2026-05-29)

Dwie gałęzie convoy zmergowane. Projekt NIE buduje się — do dokończenia poniższe taski.

---

## 1. Brakujące pliki (build blocker)

Pliki importowane ale nieistniejące — każdy z nich **musi** istnieć zanim `npm run build` zadziała:

| Plik | Importowany przez | Opis |
|------|-------------------|------|
| `src/lib/components/layout/TabBar.svelte` | `layout/index.ts:5` | Mobilny pasek nawigacji (dolny tab bar) |
| `src/lib/stores/auth.ts` | `Navbar.svelte`, `+layout.svelte` | Store autoryzacji. Eksportuje `auth` z metodami: `login()`, `logout()` oraz polem `user` (obiekt z `username`, `avatar`) |
| `src/lib/components/ui/Avatar.svelte` | `Navbar.svelte` | Komponent avatara. Props: `username: string`, `size: 'sm' \| 'md' \| 'lg'` |
| `src/lib/guards/AuthGuard.svelte` | `+layout.svelte` | Wrapper sprawdzający czy użytkownik zalogowany. Jeśli nie — przekierowuje na `/login` |

## 2. Bug: `$store` auto-subscription w plikach `.ts`

Problem w `src/lib/stores/auth.ts` i `src/lib/services/api/events.ts`:
- `$state` / `$authStore` nie działa w plikach `.ts` — trzeba użyć `get(store)` z `svelte/store`
- Dotyczy linii z `$state` w metodach `login()`, `logout()`, `hasPermission()` w auth.ts
- Dotyczy linii `$authStore.token` w events.ts

## 3. Drobne (non-blocking)

- `MobileDrawer.svelte` — `$dispatch()` zadeklarowane ale nieużywane
- `HeatmapLayer.svelte`, `POIMarkers.svelte`, `RouteRenderer.svelte` — `onMount` zaimportowane ale nieużywane
- `POIMarkers.svelte` — składnia `Popup` może nie pasować do `maplibre-gl` v4

## 4. Instalacja zależności (po dodaniu plików)

```bash
cd web
npm install
npm run dev
```

Zależności web (z package.json): `@sveltejs/kit`, `svelte`, `maplibre-gl`, `typescript`, `vite`

## Convoye

- **svelte-frontend-pages-sprint** — Events pages (lista, detail, components)
- **svelte-frontend-layout-maps-sprint-haiku** — Layout (Shell, Sidebar, Navbar, MobileDrawer) + Maps (MapView, HeatmapLayer, RouteRenderer, POIMarkers)
