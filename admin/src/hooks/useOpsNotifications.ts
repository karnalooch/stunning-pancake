import { useQuery } from '@tanstack/react-query';
import { API_PATHS } from '@4velo/api-client';
import { apiClient } from '../api/client';
import { useAuth } from '../core/auth/useAuth';

export interface OpsNotificationItem {
  id: string;
  labelKey: 'moderation' | 'feedback';
  count: number;
  path: string;
}

export function useOpsNotifications() {
  const { user, hasAnyPermission } = useAuth();
  const canModerate = hasAnyPermission(['activities.approve', '*']);
  const isTenantOps =
    user?.role === 'TENANT_ADMIN' ||
    user?.role === 'TENANT_MODERATOR' ||
    user?.role === 'GLOBAL_OWNER';

  const query = useQuery({
    queryKey: ['ops', 'notifications', user?.role],
    queryFn: async () => {
      const items: OpsNotificationItem[] = [];
      if (canModerate) {
        const queue = await apiClient.get(API_PATHS.moderationQueue, { params: { limit: 1 } });
        const modCount = queue.data?.count ?? 0;
        if (modCount > 0) {
          items.push({
            id: 'moderation',
            labelKey: 'moderation',
            count: modCount,
            path: '/owner/moderation',
          });
        }
      }
      if (isTenantOps) {
        const fb = await apiClient.get<{ resolved?: boolean }[]>('/activities/beta-feedback/list/');
        const rows = Array.isArray(fb.data) ? fb.data : [];
        const openFb = rows.filter((r) => !r.resolved).length;
        if (openFb > 0) {
          items.push({
            id: 'feedback',
            labelKey: 'feedback',
            count: openFb,
            path: '/owner/analytics/feedback',
          });
        }
      }
      return items;
    },
    enabled: Boolean(user && (canModerate || isTenantOps)),
    refetchInterval: 60_000,
    staleTime: 20_000,
  });

  const total = (query.data ?? []).reduce((sum, i) => sum + i.count, 0);
  return { items: query.data ?? [], total, loading: query.isLoading };
}
