import { useQuery } from '@tanstack/react-query';
import { API_PATHS } from '@4velo/api-client';
import { apiClient } from '../api/client';

export interface ModeratorDashboardStats {
  openQueue: number;
  olderThan48h: number;
  anomalies: number;
}

export function useModeratorDashboardStats(enabled: boolean) {
  const query = useQuery({
    queryKey: ['moderation', 'dashboard-stats'],
    queryFn: async (): Promise<ModeratorDashboardStats> => {
      const [queueRes, anomRes] = await Promise.all([
        apiClient.get(API_PATHS.moderationQueue),
        apiClient.get('/activities/telemetry/anomalies/').catch(() => ({ data: [] })),
      ]);
      const rows = queueRes.data?.results ?? [];
      const cutoff = Date.now() - 48 * 3_600_000;
      const olderThan48h = rows.filter((r: { created_at?: string }) => {
        if (!r.created_at) return false;
        return new Date(r.created_at).getTime() < cutoff;
      }).length;
      const raw = anomRes.data;
      const anomalies = Array.isArray(raw) ? raw.length : raw?.results?.length ?? 0;
      return {
        openQueue: queueRes.data?.count ?? rows.length,
        olderThan48h,
        anomalies,
      };
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
  });

  return {
    stats: query.data ?? null,
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
