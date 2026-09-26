# 4VELO Mobile Asset Audit — 2026-09-18

**Verdict:** existing generated artwork is **LEGACY / NOT APPROVED AS NEW VISUAL REFERENCE**.

## 2026-09-25 superseding decision

The June generated pack is now **DELETE**, not temporary-runtime, because it is legacy/unapproved production input under the current Frozen UI v1.2 governance. It was physically removed from both `assets/generated/**` and `mobile/assets/generated/**` on the Mobile UI Assets v1 branch. Governed v1 assets live under `mobile/assets/approved/v1/**`; CI rejects resurrection of the retired visual roots and validates provenance/digests, but does not expire approved assets by age.

## Inventory

Repository scan of \`assets/generated/**\` on the audit base:

| Family | Visual files | Disposition |
|---|---:|---|
| environment | 8 | REPLACE |
| expressions | 4 | REPLACE after canonical rider |
| icons | 40 | VERIFY official marks / REPLACE functional & decorative art |
| map | 1 | REPLACE |
| marketing | 1 | ARCHIVE only |
| particles | 1 | REPLACE only if needed |
| sprites | 2 | REPLACE after canonical rider |
| textures | 4 | LEGACY special-use only |
| **Total** | **61** | **legacy_unapproved by default** |

There are 100 total files below \`assets/generated/**\` including prompts, manifest and sound data. The current legacy \`ASSET_MANIFEST.json\` records only three HUD assets, so it is not an authoritative inventory.

## Runtime finding

\`assetRegistry.ts\` and \`visionAssets.ts\` still wire many generated images. Runtime use does not mean visual approval. Removing them all here would mix asset governance with unrelated behaviour, so replacement is staged screen-by-screen.

## Family decisions

### Municipal crests — VERIFY_PROVENANCE

Current \`crest_*\` files are not automatically official. Do not regenerate them. Verify authoritative source, accuracy and rights/status. Until verified, new UI uses Place Badge.

### Achievements — REPLACE

Current \`ach_*\` assets remain temporary only. Produce \`achievement_core_set_v1\` after canonical art calibration.

### Rider/sprites/expressions — REPLACE

Current cyclist/ghost assets do not define future rider identity. Approve \`rider_canonical_v1\` first.

### Environment scenes — REPLACE

Current hills/road/sky/town/banner/finish images are not the target direction. New scenes are screen-specific, crop-safe and use the canonical rider.

### Functional icons — REPLACE OR RETIRE

Routine navigation/action controls move toward a coherent modern icon system. Game-heavy power/currency concepts do not drive pilot UI unless product requirements explicitly need them.

HUD stop/pause/play may remain temporarily for behaviour continuity but T80 owns their final visual treatment.

### Map marker — REPLACE

Create \`ride_marker_rider_v1\` after rider approval.

### Textures / ornate frame — LEGACY SPECIAL ONLY

Do not use as routine chrome. Reuse requires explicit visual review.

### Marketing mockup — ARCHIVE ONLY

Historical reference, not a production baseline.

## Risks

1. old generator encodes the previous green/game-heavy direction;
2. hard-coded five-city crest resolution does not scale;
3. legacy manifest is incomplete;
4. mixed sources can create patchwork UI;
5. batch generation before rider calibration multiplies inconsistency.

## Migration

- do not delete legacy assets in this tranche;
- do not mass-regenerate them;
- do not expand the old generated pack for new UI;
- new art receives new versioned IDs and explicit approval;
- legacy assets disappear as T79–T83 migrate;
- Place Badge removes any need to bundle thousands of crests.

## Automated evidence

This tranche adds machine policy, repository validator + unit tests, runtime place fallback + Jest tests, CI validation for \`assets/**\`, and \`pnpm audit:assets\`.
