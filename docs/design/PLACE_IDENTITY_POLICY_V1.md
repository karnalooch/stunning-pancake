# 4VELO Place Identity Policy v1

**Goal:** support every city/town/locality without maintaining a custom crest pack.

## Identity layers

1. **Official Crest** — verified official symbol.
2. **4VELO Place Badge** — universal deterministic fallback.
3. **4VELO City Scene** — optional bespoke pixel-art enhancement.

They are independent. A generated scene is never an official crest.

## Resolution

\`\`\`text
verified official crest available?
  yes -> Official Crest
  no  -> 4VELO Place Badge

bespoke city scene available?
  yes -> optional enhancement
  no  -> screen still works
\`\`\`

Every locality renders correctly from its name alone.

## Official crest

Production approval requires authoritative source reference, current/verified mark, rights/status, immutable version/digest, contain fit and safe padding.

Never crop, recolour, AI-generate or redraw an official crest.

At scale prefer backend/storage/CDN delivery with application cache instead of bundling thousands of images. A bundled dev fixture does not prove official status.

## Place Badge

- one word -> first two characters, preserving Polish diacritics;
- multi-word/hyphenated -> first character of first two words;
- empty -> 4V;
- navy/cream/amber;
- no random colours;
- must not imitate heraldic arms;
- readable at 32/48/64 dp.

Examples: Siedlce -> SI; Mińsk Mazowiecki -> MM; Biała Podlaska -> BP; Łódź -> ŁÓ; Nowy-Dwór -> ND.

Runtime resolver: \`mobile/src/assets/assetGovernance.ts\`, covered by Jest.

## Club marks

Do not overload municipal crest and club logo into one generic visual field. Future model should distinguish \`place.officialCrest\`, \`club.logo\`, \`event.logo\` and \`brand.placeBadge\`.

## Future admin

Place branding should expose place ID/name, crest URL/upload, source reference, rights/status, version, preview, approval state and optional 4VELO city scene.

Until then Place Badge guarantees complete UI.

## Security

Remote branding URLs are public metadata and must not include user tokens or personal identifiers.
