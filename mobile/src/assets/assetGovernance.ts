/**
 * Runtime-facing asset governance helpers.
 *
 * This module does not approve visual assets. It encodes the scalable place
 * identity fallback and the rule that legacy generated artwork is not a visual
 * reference for new UI.
 */

export const ASSET_VISUAL_FREEZE_VERSION = '1.2.0' as const;

export const LEGACY_GENERATED_ASSET_POLICY = {
  visualReferenceAllowedForNewUi: false,
  autoApprovalAllowed: false,
  temporaryRuntimeUseAllowed: false,
} as const;

export type OfficialCrest = {
  uri: string;
  version: string;
  sourceReference: string;
  rightsStatus: 'verified';
};

export type PlaceIdentityInput = {
  name: string;
  officialCrest?: OfficialCrest | null;
};

export type ResolvedPlaceIdentity =
  | {
      kind: 'official-crest';
      uri: string;
      version: string;
      sourceReference: string;
      fit: 'contain';
      recolor: false;
      crop: false;
    }
  | {
      kind: 'place-badge';
      initials: string;
      palette: 'navy-cream-amber';
    };

function words(value: string): string[] {
  return value
    .trim()
    .split(/[\s-]+/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function placeBadgeInitials(name: string): string {
  const parts = words(name);
  if (parts.length === 0) return '4V';

  const first = parts[0];
  if (!first) return '4V';

  const second = parts[1];
  if (second) {
    const initials = (Array.from(first)[0] ?? '') + (Array.from(second)[0] ?? '');
    return initials.toLocaleUpperCase('pl-PL');
  }

  return Array.from(first).slice(0, 2).join('').toLocaleUpperCase('pl-PL') || '4V';
}

function isUsableVerifiedCrest(crest: OfficialCrest | null | undefined): crest is OfficialCrest {
  return Boolean(
    crest &&
      crest.rightsStatus === 'verified' &&
      crest.uri.trim() &&
      crest.version.trim() &&
      crest.sourceReference.trim(),
  );
}

/**
 * Official marks are optional enhancements. Every place must render without
 * one, using the deterministic 4VELO Place Badge fallback.
 */
export function resolvePlaceIdentity(input: PlaceIdentityInput): ResolvedPlaceIdentity {
  if (isUsableVerifiedCrest(input.officialCrest)) {
    return {
      kind: 'official-crest',
      uri: input.officialCrest.uri,
      version: input.officialCrest.version,
      sourceReference: input.officialCrest.sourceReference,
      fit: 'contain',
      recolor: false,
      crop: false,
    };
  }

  return {
    kind: 'place-badge',
    initials: placeBadgeInitials(input.name),
    palette: 'navy-cream-amber',
  };
}
