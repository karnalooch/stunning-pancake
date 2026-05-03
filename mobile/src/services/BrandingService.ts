import { api } from './api';

export interface TenantBranding {
  name: string;
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
}

let currentBranding: TenantBranding | null = null;

export const BrandingService = {
  fetch: async (tenantId: string): Promise<TenantBranding | null> => {
    try {
      const data = await api
        .get(`/api/users/branding/${tenantId}/`)
        .then((r) => r.data);
      currentBranding = data;
      return data;
    } catch (e) {
      console.warn(`[Branding] Failed to fetch branding for ${tenantId}:`, e);
      return null;
    }
  },

  getCurrent: (): TenantBranding | null => currentBranding,

  // Apply branding to Tamagui theme — to be called after fetch
  colors: (): { primary: string; secondary: string } | null => {
    if (!currentBranding) return null;
    return {
      primary: currentBranding.primary_color,
      secondary: currentBranding.secondary_color,
    };
  },
};
