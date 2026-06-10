import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

export interface DashboardStats {
  total_users?: number;
  total_activities?: number;
  total_distance_km?: number;
  verified_pct?: number;
  tenant_id?: string;
  tenant_name?: string;
  [key: string]: unknown;
}

export function useDashboardStats(enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get<DashboardStats>('/activities/admin/stats/');
      return res.data;
    },
    enabled,
    staleTime: 30_000,
  });
}
