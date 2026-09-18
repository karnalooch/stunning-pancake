import {
  ASSET_VISUAL_FREEZE_VERSION,
  LEGACY_GENERATED_ASSET_POLICY,
  placeBadgeInitials,
  resolvePlaceIdentity,
} from '../../src/assets/assetGovernance';

describe('asset governance', () => {
  test('pins asset work to the approved visual freeze', () => {
    expect(ASSET_VISUAL_FREEZE_VERSION).toBe('1.2.0');
    expect(LEGACY_GENERATED_ASSET_POLICY.visualReferenceAllowedForNewUi).toBe(false);
    expect(LEGACY_GENERATED_ASSET_POLICY.autoApprovalAllowed).toBe(false);
  });

  test.each([
    ['Siedlce', 'SI'],
    ['Mińsk Mazowiecki', 'MM'],
    ['Biała Podlaska', 'BP'],
    ['Łódź', 'ŁÓ'],
    ['Nowy-Dwór', 'ND'],
    ['', '4V'],
  ])('creates deterministic Polish place-badge initials for %s', (name, expected) => {
    expect(placeBadgeInitials(name)).toBe(expected);
  });

  test('uses a verified official crest without cropping or recolouring', () => {
    expect(
      resolvePlaceIdentity({
        name: 'Siedlce',
        officialCrest: {
          uri: 'https://cdn.example.test/siedlce.svg',
          version: '2026-01',
          sourceReference: 'official-city-source',
          rightsStatus: 'verified',
        },
      }),
    ).toEqual({
      kind: 'official-crest',
      uri: 'https://cdn.example.test/siedlce.svg',
      version: '2026-01',
      sourceReference: 'official-city-source',
      fit: 'contain',
      recolor: false,
      crop: false,
    });
  });

  test('falls back when no verified crest is available', () => {
    expect(resolvePlaceIdentity({ name: 'Siedlce' })).toEqual({
      kind: 'place-badge',
      initials: 'SI',
      palette: 'navy-cream-amber',
    });
  });

  test('falls back when crest provenance is incomplete', () => {
    expect(
      resolvePlaceIdentity({
        name: 'Siedlce',
        officialCrest: {
          uri: 'https://cdn.example.test/siedlce.svg',
          version: '2026-01',
          sourceReference: '   ',
          rightsStatus: 'verified',
        },
      }),
    ).toEqual({
      kind: 'place-badge',
      initials: 'SI',
      palette: 'navy-cream-amber',
    });
  });
});
