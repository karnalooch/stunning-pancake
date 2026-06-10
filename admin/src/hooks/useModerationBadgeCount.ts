import { useEffect, useState } from 'react';
import { API_PATHS } from '@4velo/api-client';
import { apiClient } from '../api/client';
import { useAuth } from '../core/auth/useAuth';

/** Pending moderation count for nav badge (60s poll). */
export function useModerationBadgeCount(): number {
  const { user, hasAnyPermission } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user || !hasAnyPermission(['activities.approve', '*'])) {
      setCount(0);
      return;
    }
    const load = () => {
      apiClient.get(API_PATHS.moderationQueue, { params: { limit: 1 } })
        .then((r) => setCount(r.data?.count ?? 0))
        .catch(() => setCount(0));
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [user, hasAnyPermission]);

  return count;
}
