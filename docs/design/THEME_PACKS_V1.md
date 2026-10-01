# Mobile theme packs v1

Status: CURRENT implementation contract for #418 / PR #419. Owner: Mobile. Decision: 2026-10-01.
Parent authority: [Product UX v2](./PRODUCT_UX_V2.md).

## User workflow

Open Settings -> Appearance (PL: Ustawienia -> Wygląd). Choose Roadbook, Forest or an installed custom pack. Choose light, dark or system mode independently, and optionally high contrast. Preview changes only the labelled sample panel; Apply changes the app and commits preferences. Back/Cancel discards unapplied edits.

The first importer accepts **pasted JSON**. Export invokes the native share sheet with **JSON text**, not a filesystem document. File-picker import, asset/font downloads, a marketplace and a visual theme editor are not part of this implementation. These limitations must remain visible in reports.

A custom pack needs a unique ID. The importer previews valid data before installation; Apply installs and selects it in one store transaction. Removing the active custom pack selects Roadbook in the same transaction. Official packs cannot be overwritten or removed. Exporting Roadbook and editing its ID/name/colours provides a starting point for a third pack without changing screens.

## Data-only format

Exactly five top-level fields are accepted: `schemaVersion` (literal `1`), `id`, `name`, `light`, `dark`.

IDs match `^[a-z][a-z0-9-]{2,39}$`. Names contain 1–48 characters, have no leading/trailing whitespace, control characters, bidi controls or markup delimiters. Each palette requires exactly these roles, expressed as opaque `#RRGGBB` colours:

`canvas`, `surface`, `raised`, `text`, `muted`, `action`, `actionPressed`, `onAction`, `border`, `success`, `warning`, `error`, `onError`.

Unknown fields, missing roles, unsupported schema versions, malformed JSON, prototype keys and arbitrary expressions/URLs are rejected. Import is capped at 16,384 JavaScript string characters per pack and ten custom packs. No JavaScript, remote assets, fonts, layout overrides, permissions, navigation or domain commands are executable through this format.

The implementation is [themePack.ts](../../mobile/src/theme/packs/themePack.ts). [builtins.ts](../../mobile/src/theme/packs/builtins.ts) contains complete usable examples. Runtime colours are normalized and frozen after validation.

## Contrast and accessibility

The validator uses unrounded sRGB relative luminance ratios. Normal text, secondary text, the action colour used as a text link, and status colours require at least 4.5:1 against canvas, surface and raised backgrounds. Control boundaries require 3:1. Action labels require 4.5:1 against normal/pressed action backgrounds; destructive labels require 4.5:1 against error backgrounds.

High contrast overrides the selected palette with a controlled light/dark palette. It does not change theme identity. Theme files cannot reduce target sizes, disable text scaling, suppress warnings, change state meanings or modify reduced-motion behavior. Palette validation alone is not a screen-reader, layout, map or full-app WCAG audit.

## Runtime and persistence

`AppearanceStore` is a pure external store. Its versioned `appearance_v1` JSON envelope contains preferences and custom packs. A write happens before publishing the new snapshot. If persistent storage throws, the previous selection and installed packs remain active and the UI reports failure. Without persistent storage, session-only changes are allowed with an explicit warning.

Bootstrap and the provider share the same store. Stored data is validated before styles are configured. Old `theme_mode=grandPrix/grandPrixNight` migrates to Roadbook light/dark without overwriting the old key. Fresh users default to system mode. Corrupt data falls back to a safe selection and produces a recovery notice without automatically overwriting evidence.

Unistyles uses two temporary runtime aliases, `grandPrix` and `grandPrixNight`; they are not catalog entries. Selecting a pack updates their validated light/dark values without registering arbitrary runtime identifiers. React Native `useColorScheme` resolves system mode. New components consume semantic roles or `useAppearance().palette`; no screen switches on custom pack IDs.

The compatibility adapter does not mutate exported palettes. Tenant branding remains validated metadata and cannot silently override the selected palette's contrast-checked action/status roles. App children have no theme-dependent key; a theme change must not recreate the ride/session root.

## Map and migration boundary

Version 1 custom packs do not load or rewrite MapLibre styles. Existing map sources, attribution and route/recording overlays remain protected. Separately verified light/dark map variants and full Roadbook screen migration are follow-on work within the presentation sprint; do not claim that recolouring legacy keys completes the redesign.

## Verification

Pure tests: `mobile/src/theme/__tests__/themePacks.test.ts` cover format/contrast attacks, limits, duplicate IDs, offline restart, migration, atomic write failure, removal and third-pack installation.

Interaction tests: `mobile/__tests__/theme/appearanceRuntime.test.tsx` exercise the actual provider and picker with a mocked native boundary: preview/cancel, apply, import, export, write failure and preservation of a stateful child through pack/mode/high-contrast changes. They do not prove real GPS/native continuity.

Use the repository's pinned pnpm toolchain:

```sh
pnpm --dir mobile typecheck
pnpm --dir mobile test --runInBand --runTestsByPath src/theme/__tests__/themePacks.test.ts __tests__/theme/appearanceRuntime.test.tsx
```

Native acceptance still requires real-device/emulator evidence for restart, text scaling, system mode, active recording continuity, offline behavior and appearance preview/apply/cancel. Use the approved exact-SHA proof path; do not trigger APK builds for routine palette edits.
