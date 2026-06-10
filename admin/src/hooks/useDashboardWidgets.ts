import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/client';

export type DashboardWidgetId =
  | 'kpi'
  | 'moderationSla'
  | 'departments'
  | 'goHealth'
  | 'tenantQuickActions';

const DEFAULT_WIDGETS: Record<DashboardWidgetId, boolean> = {
  kpi: true,
  moderationSla: true,
  departments: true,
  goHealth: true,
  tenantQuickActions: true,
};

const STORAGE_KEY = 'dashboard_widgets_v1';

function readLocal(): Record<DashboardWidgetId, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WIDGETS };
    return { ...DEFAULT_WIDGETS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_WIDGETS };
  }
}

export function useDashboardWidgets() {
  const [widgets, setWidgets] = useState<Record<DashboardWidgetId, boolean>>(readLocal);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ dashboard_widgets?: Record<string, boolean> }>('/users/preferences/')
      .then((res) => {
        const remote = res.data?.dashboard_widgets;
        if (remote && typeof remote === 'object') {
          setWidgets((prev) => ({ ...prev, ...remote }));
        }
      })
      .catch(() => {})
      .finally(() => setSynced(true));
  }, []);

  const setWidget = useCallback((id: DashboardWidgetId, visible: boolean) => {
    setWidgets((prev) => {
      const next = { ...prev, [id]: visible };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      apiClient
        .patch('/users/preferences/', { dashboard_widgets: next })
        .catch(() => {});
      return next;
    });
  }, []);

  return { widgets, setWidget, synced };
}
