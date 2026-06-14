# Compete Feature Contract

## Responsibilities

- City hub composition (city wars, leaderboard, nearby quests).
- Clubs and segments entry points.
- Offline-first presentation with cache fallback and edge banners.
- Event-triggered ride start handoff to ride domain.

## Integration points

- `screens/CityHubScreen.tsx`
- `screens/ClubsDirectoryScreen.tsx`
- `screens/SegmentsScreen.tsx`
- `services/api.ts` (`ActivityService.getCityHubSummary`)
- `services/OfflineCacheService.ts`
