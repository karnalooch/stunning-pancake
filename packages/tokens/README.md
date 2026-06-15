# @4velo/tokens

Design tokens (colors) for the Grand Prix visual system.

## Consumption

Apps import via the **`@tokens/*` path alias** (configured in each app's `tsconfig` / Vite / Metro), not the package name directly:

```ts
import { colors } from '@tokens/generated/restyle-colors';
```

The workspace package name is `@4velo/tokens` for `pnpm --filter` and `workspace:*` dependencies.

## Build

```bash
pnpm tokens:build   # regenerate from colors.json
pnpm tokens:check   # CI: fail if generated/ is stale
```

Source: `colors.json` → `generated/restyle-colors.ts`, `generated/colors-flat.json`.
