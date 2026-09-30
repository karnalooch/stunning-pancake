# @4velo/tokens

Repository-owned design tokens for 4VELO.

GitHub is the authority. Design tools may consume generated artifacts, but an external design workspace must not become the only copy of accepted token state.

## Consumption

Apps may consume generated output through their configured aliases/adapters. The workspace package name is `@4velo/tokens` for `pnpm --filter` and workspace ownership.

## Build

```bash
pnpm tokens:build   # regenerate all versioned artifacts from colors.json
pnpm tokens:check   # fail when committed generated content differs from source
```

The freshness check is **content-based**, not timestamp-based, so it is stable under Git checkout, CI caching and rebases.

## Generated artifacts

Source:

- `colors.json`

Generated and committed:

- `generated/restyle-colors.ts` — TypeScript constants;
- `generated/colors-flat.json` — resolved JSON for code/tooling;
- `generated/figma-variables-bridge.json` — Figma-friendly, repository-owned interchange.

### Figma bridge

`figma-variables-bridge.json` is deliberately **not** a Figma API response and does not require a Figma account to build.

It contains:

- primitive color collection;
- semantic color collection;
- Day/Night theme modes;
- non-color spacing/typography/border/shadow source data;
- explicit `authority: "github"`.

If the active Figma plan supports Variables API or Code Connect, an adapter may publish/sync from this artifact. If not, designers can still use Figma as a workspace/reference while the repository remains authoritative.

Do not add a CI requirement that needs a paid Figma plan or a personal access token merely to validate 4VELO source.

References:

- Figma Variables REST API: https://developers.figma.com/docs/rest-api/variables/
- Figma Code Connect: https://github.com/figma/code-connect

## Change rule

Edit `colors.json`, run `pnpm tokens:build`, and commit source + generated artifacts together.

Generated files are never hand-edited.
