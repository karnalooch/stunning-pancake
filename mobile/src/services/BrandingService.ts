import { api } from './api';
import { stitchTheme } from '../theme/stitch';
import type { StitchTheme } from '../theme/unistyles';

export interface TenantBranding {
  name: string;
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
}

let currentBranding: TenantBranding | null = null;

/**
 * Apply branding overrides to both theme objects so that
 * `useStyles()` consumers automatically receive branded colors.
 *
 * The branding is stored as `theme.branding` on each theme object,
 * which is consumed via `theme.colors.branding?.primary` etc.
 */
function applyOverrides(branding: TenantBranding): void {
  const override = {
    primary: branding.primary_color,
    secondary: branding.secondary_color,
  };
  const themes: StitchTheme[] = [stitchTheme];
  for (const theme of themes) {
    theme.branding = override;
  }
}

/** Remove branding overrides from both themes */
function clearOverrides(): void {
  const themes: StitchTheme[] = [stitchTheme];
  for (const theme of themes) {
    delete theme.branding;
  }
}

export const BrandingService = {
  /**
   * Fetch tenant branding from the API and apply overrides
   * to the Unistyles theme objects.
   */
  fetch: async (tenantId: string): Promise<TenantBranding | null> => {
    try {
      const data = await api
        .get(`/api/users/branding/${tenantId}/`)
        .then((r) => r.data);
      currentBranding = data;
      // Wire into Unistyles theme objects so useStyles() picks up overrides
      applyOverrides(data);
      return data;
    } catch (e) {
      console.warn(`[Branding] Failed to fetch branding for ${tenantId}:`, e);
      return null;
    }
  },

  getCurrent: (): TenantBranding | null => currentBranding,

  /**
   * Return branding colors for theme consumption.
   *
   * @deprecated Prefer reading `theme.colors.branding?.primary` from
   * Unistyles `useStyles()` or `useUnistyles()` instead of calling this directly.
   * Kept for Phase 1–2 backward compatibility with Tamagui.
   */
  colors: (): { primary: string; secondary: string } | null => {
    if (!currentBranding) return null;
    return {
      primary: currentBranding.primary_color,
      secondary: currentBranding.secondary_color,
    };
  },

  /** Clear branding (e.g. on tenant logout) */
  clear: (): void => {
    currentBranding = null;
    clearOverrides();
  },
};
