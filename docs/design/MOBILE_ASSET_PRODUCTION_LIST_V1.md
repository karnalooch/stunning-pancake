# 4VELO Mobile Asset Production List v1

**Status:** fresh v1 pilot family active; legacy generated pack purged  
**Visual freeze:** 1.2.0

## Phase A — calibration

### A1 — rider_canonical_v1 — P0 — APPROVED 2026-09-25

Approve one rider/bicycle master: consistent silhouette, helmet/kit/bike language, transparent reusable subject, clean crop and no embedded text.

**Do not create derivative rider poses before A1 is approved.**

### A2 — home_hero_day_v1 — P0 — APPROVED 2026-09-25

Use A1 rider. This scene calibrates environment pixel density, scenery treatment, rider/environment scale and text-safe composition.

Only after A1+A2 are approved is the art family calibrated.

## Phase B — T79 Home

| ID | Priority | Source | Purpose |
|---|---|---|---|
| place_badge_v1 | P0 | code-generated | universal locality fallback |
| functional_icon_set_v1 | P0 | licensed/owned vector | routine product controls |
| home_hero_evening_v1 | P1 | original curated | optional hero variant |
| home_city_detail_siedlce_v1 | P2 | original curated | optional local flavour |

No bespoke crest is required for T79.

## Phase C — T80 Active Ride

| ID | Priority | Source | Purpose |
|---|---|---|---|
| ride_marker_rider_v1 | P0 | original curated | small rider identity |
| ride_action_icons_v1 | P1 | human/vector | stop/pause/resume |
| gps_state_icons_v1 | P1 | human/vector | only if standard icons insufficient |

No scenic Active Ride art.

## Phase D — T81 Summary

| ID | Priority | Source | Purpose |
|---|---|---|---|
| summary_finish_v1 | P0 | original curated | durable-success celebration |
| achievement_core_set_v1 | P0 | original curated | coherent pilot badge family |
| summary_share_frame_v1 | P2 | original/human | share card if needed |
| summary_particles_v1 | P2 | original curated | optional/reduced-motion safe |

## Phase E — T82/T83

| ID | Priority | Source | Purpose |
|---|---|---|---|
| explore_pin_set_v1 | P1 | human/vector | route/event/segment/place/club |
| profile_scene_v1 | P1 | original curated | rider identity |
| city_scene_siedlce_v1 | P2 | original curated | local city art |
| city_scene_generic_v1 | P2 | original curated | optional generic city |

## Official crest stream

Non-blocking for pilot UI.

For every official mark: authoritative source -> verify -> record rights/status -> clean source asset -> SHA-256 -> 32/48/64 dp containment review -> approve -> remote/cacheable delivery or intentional bundle.

Never generate a missing crest. Use Place Badge.

## Candidate limits

- 2–4 serious candidates per request;
- reject the batch if none meet the Bible;
- never derive a family from an unapproved master;
- avoid mixing generators/models inside one visual family unless manually normalised and re-approved;
- preserve the approved source/reference and digest.

## Approval evidence

Every approved production asset records ID/version, screens, source strategy/reference, rights status, dimensions, alpha expectation, SHA-256, intended-size screenshot and explicit approval note.

The machine queue is \`assets/ASSET_GOVERNANCE_V1.json\`.


## Asset lifecycle policy

- approved assets record provenance, rights status, `createdAt` and an immutable SHA-256;
- there is **no rolling age limit** that fails CI merely because an approved asset is older;
- replacement/removal happens through explicit review, provenance problems, visual changes or a newer approved version;
- legacy generated assets are deleted, not kept as runtime fallbacks;
- `assets/generated/**` and `mobile/assets/generated/**` are retired paths and must contain zero visual files;
- new or regenerated work targets the governed `mobile/assets/approved/v1/**` family or a newer explicitly approved version.

## 2026-09-25 cut-over

The June Grand Prix / vision-parity pack was retired as legacy/unapproved production input during the v1 cut-over. Runtime dependencies on its scenes, textures, sprite sheet, expressions, particle atlas, optional crests/achievements, HUD PNGs and SFX manifest were removed or replaced with approved v1/procedural equivalents.
