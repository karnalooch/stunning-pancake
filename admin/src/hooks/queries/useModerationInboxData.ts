import { useQuery } from '@tanstack/react-query';
import { API_PATHS } from '@4velo/api-client';
import { apiClient } from '../../api/client';

export interface ModerationInboxData {
  activities: unknown[];
  anomalies: unknown[];
  draftEvents: { id: number; title: string; status: string; event_type?: string; start_date?: string }[];
}

export function useModerationInboxData(filter: 'all' | 'me', enabled = true) {
  return useQuery({
    queryKey: ['moderation', 'inbox', filter],
    queryFn: async (): Promise<ModerationInboxData> => {
      const queueUrl =
        filter === 'me'
          ? `${API_PATHS.moderationQueue}?assigned_to=me`
          : API_PATHS.moderationQueue;
      const [queueRes, cheatRes, eventsRes] = await Promise.all([
        apiClient.get(queueUrl),
        apiClient.get('/activities/telemetry/anomalies/').catch(() => ({ data: [] })),
        apiClient.get('/events/').catch(() => ({ data: [] })),
      ]);
      const rawAnomalies = cheatRes.data;
      const anomalyList = Array.isArray(rawAnomalies)
        ? rawAnomalies
        : rawAnomalies?.results ?? [];
      const rawEvents = eventsRes.data;
      const eventList = Array.isArray(rawEvents) ? rawEvents : rawEvents?.results ?? [];
      return {
        activities: queueRes.data?.results ?? [],
        anomalies: anomalyList,
        draftEvents: eventList.filter((e: { status: string }) => e.status === 'DRAFT'),
      };
    },
    enabled,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}
