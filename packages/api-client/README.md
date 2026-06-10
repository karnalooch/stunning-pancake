# @4velo/api-client

Single source of truth for API path constants and (gradually) Orval-generated clients.

## Policy (monorepo overhaul program)

1. **New endpoints** — add paths to `src/paths.ts` (`API_PATHS` + `API_PATHS_FULL`) before use in admin/mobile.
2. **No new raw `/api/...` strings** in application code for endpoints covered by this package.
3. **OpenAPI drift** — after backend schema changes run from repo root:
   ```bash
   pnpm api:export
   pnpm api:codegen:check
   ```
4. **Orval generated** — `src/generated/` is committed; run `pnpm --filter @4velo/api-client codegen` after export when adding new tagged operations.

## Usage

```ts
import { API_PATHS } from '@4velo/api-client';
await apiClient.get(API_PATHS.usersProfile);
```

Mobile host-root clients use `API_PATHS_FULL`.

## Files

| File | Role |
|------|------|
| `src/paths.ts` | Hand-maintained critical paths (SSOT) |
| `src/types.ts` | Shared request/response types |
| `openapi.json` | Snapshot from `scripts/export_openapi.py` |
| `src/generated/` | Orval output (axios + models) |
