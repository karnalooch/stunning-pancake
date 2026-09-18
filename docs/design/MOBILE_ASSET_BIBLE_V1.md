# 4VELO Mobile Asset Bible v1

**Status:** APPROVED / production guidance  
**Decision date:** 2026-09-18  
**Visual contract:** Frozen UI v1.2  
**Applies to:** mobile brand art, rider art, achievements, place identity, map markers, special illustrations and functional icon sourcing

## 1. Purpose

4VELO must look like one product. Asset creation is a controlled production process, not a bulk image-generation exercise.

The accepted character is **modern outdoor/cycling product first, expressive pixel-art identity second**. Functional UI remains modern and highly legible. Pixel art is reserved for emotional and identity-bearing surfaces.

The existing \`assets/generated/**\` pack is legacy material. It may remain temporarily wired to avoid unrelated regressions, but it is not a visual reference and is not automatically eligible for new UI.

## 2. Source hierarchy

Use sources in this order:

1. **Code/UI rendering** for cards, charts, progress, place fallback badges and ordinary interface geometry.
2. **Consistent licensed or owned vector icon system** for routine functional controls.
3. **Original 4VELO brand artwork** for rider, hero scenes, achievements, celebration art, city scenes and selected map markers.
4. **Verified official source** for municipal crests, club logos and other official marks.

Do not use random web images, mixed marketplace packs, AI approximations of official marks, or decorative pixel versions of ordinary functional controls.

## 3. Canonical rider

Before producing a family of scenes, approve one canonical rider model.

The rider master establishes body proportion, helmet/eyewear, jersey/bib construction, bicycle silhouette, line/pixel density, lighting, palette relationship and pose rules.

Production sequence:

1. rider silhouette studies;
2. one approved neutral/riding master;
3. Home hero calibration;
4. only then derive climbing, celebration, profile and marker variants.

Home, Summary and Profile must not look like they feature unrelated cyclists.

## 4. Pixel-art quality

Required:

- crisp silhouette at intended display size;
- controlled detail density;
- intentional pixel clusters and edges;
- no pseudo-pixel antialiasing around key silhouettes;
- no baked-in UI text;
- transparent backgrounds for reusable character/icon assets;
- composition safe zones for overlay text;
- nearest-neighbour scaling where intentionally low-resolution.

The exact logical pixel density is calibrated on the canonical rider + Home hero pair and then frozen. Do not batch-generate a family before that pair is accepted.

## 5. Colour relationship

Product chrome is navy + cream/parchment + orange/amber.

Artwork may contain natural environmental colours. It must not accidentally create bright-green elements that read like selected UI controls. Green is valid for nature and semantic success/GPS, not generic action emphasis.

## 6. Hero scenes

Hero scenes are for Home, Profile, selected onboarding moments and durable-success Summary.

They require one focal subject, a calm UI-safe zone, no embedded text, no fake buttons/HUD, safe cropping across target phone ratios, and enough restraint that the product does not become a game level.

## 7. Achievements

Achievement sets share frame language, perspective, highlight/shadow logic, border density and internal safe area. Every badge must remain distinguishable at 32/48/64 dp. Avoid baked-in text.

## 8. Functional icons

Routine controls are not an AI-art problem. Use a coherent vector/owned system with clear 20–24 dp readability, consistent optical weight and accessibility labels. Stop/pause/resume may carry subtle 4VELO character but must remain instantly recognisable.

## 9. Maps

The map remains functional and modern. Custom work is limited to rider marker, route/event/segment/place/club pins and selected POI-card illustrations. Never replace the map with raster pixel art or obscure functional labels/routes.

## 10. Place identity

A place never requires a custom asset.

Priority:

1. verified official crest when available;
2. otherwise canonical 4VELO Place Badge.

Official crests are never AI-generated/redrawn, require verified provenance, use contain fit, are not recoloured and are not cropped. Bespoke city pixel art is a separate optional enhancement and never pretends to be an official crest.

See \`PLACE_IDENTITY_POLICY_V1.md\`.

## 11. Approval states

- **planned** — required but not produced.
- **candidate** — produced for review; not approved.
- **approved** — explicitly accepted and has provenance + immutable digest.
- **rejected** — not a target asset.
- **legacy_unapproved** — may exist temporarily; not a reference.
- **verify_provenance** — official/source status still unresolved.

Presence in Git, \`visionAssets.ts\`, \`assetRegistry.ts\` or an old manifest does not grant approval.

## 12. Production workflow

1. take one request from \`MOBILE_ASSET_PRODUCTION_LIST_V1.md\`;
2. provide Frozen UI v1.2 + canonical rider reference where applicable;
3. create 2–4 serious candidates;
4. reject obvious misses;
5. review at real display size and on cream/navy;
6. test crop/safe zones;
7. approve exactly one candidate;
8. record provenance + SHA-256;
9. wire only the approved ID.

If no candidate is good enough, regenerate. Do not lower the bar because a file already exists.

## 13. Approval gate

An asset can become **approved** only when it matches Frozen UI v1.2, is coherent with its family, has allowed provenance/rights, immutable SHA-256, tested target sizing/crop, no localisation-breaking embedded text, reviewed accessibility impact and \`replaceWithoutApproval=false\`.

## 14. Legacy quarantine

All 61 visual files currently under \`assets/generated/**\` are legacy/unapproved until individually replaced or reviewed. The old generator/prompts are historical tooling, not the new art direction.

CI counts this inventory. Adding another visual file there changes the audit and must be acknowledged.
