import axios from 'axios';
import { Theme } from '../theme/Theme';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://docker-backend-production-123c.up.railway.app';

export interface TenantBranding {
  name: string;
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
}

export const BrandingService = {
  getBranding: async (tenantId: string): Promise<TenantBranding | null> => {
    try {
      const response = await axios.get(`${BASE_URL}/api/users/tenant/${tenantId}/branding/`);
      return response.data;
    } catch (e) {
      console.error(`[Branding] Failed to fetch branding for ${tenantId}:`, e);
      return null;
    }
  },

  applyBranding: (branding: TenantBranding) => {
    console.log(`[Branding] Applying styles for ${branding.name}`);
    // In a real app, we would update a global state or Tamagui theme provider
    // For now, we update the local Theme object as a fallback
    if (branding.primary_color) Theme.colors.primary = branding.primary_color;
    if (branding.secondary_color) Theme.colors.secondary = branding.secondary_color;
  }
};
