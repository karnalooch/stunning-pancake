import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Box, Card, Text, Group, Badge, Button, Table, Skeleton, Tabs, Anchor, SegmentedControl, Checkbox,
} from '@mantine/core';
import { Activity, ShieldAlert, Calendar, RefreshCw, History } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_PATHS } from '@4velo/api-client';
import { apiClient } from '../../api/client';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../core/auth/useAuth';
import { PageHeader } from '../../core/components/PageHeader';
import { severityColor, severityLabel } from '../../utils/anomalySeverity';
import { RejectReasonModal } from './RejectReasonModal';
import { QueueAgeBadge } from './QueueAgeBadge';
import { useI18n } from '../../i18n/useI18n';
import { useModerationHotkeys } from '../../hooks/useModerationHotkeys';
import { useModerationInboxData } from '../../hooks/queries/useModerationInboxData';

interface AnomalyRow {
  id: string;
  activity_id: number;
  user: string;
  type: string;
  score: number;
  severity?: string;
  description?: string;
}

interface DraftEvent {
  id: number;
  title: string;
  status: string;
  event_type?: string;
  start_date?: string;
}

const EMPTY_ACTIVITIES: any[] = [];
const EMPTY_ANOMALIES: AnomalyRow[] = [];
const EMPTY_DRAFT_EVENTS: DraftEvent[] = [];

export const ModerationInbox: React.FC = () => {
  const { user, hasAnyPermission } = useAuth();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'me'>('all');
  const inboxQuery = useModerationInboxData(filter);
  const activities = (inboxQuery.data?.activities ?? EMPTY_ACTIVITIES) as any[];
  const anomalies = (inboxQuery.data?.anomalies ?? EMPTY_ANOMALIES) as AnomalyRow[];
  const draftEvents = inboxQuery.data?.draftEvents ?? EMPTY_DRAFT_EVENTS;
  const loading = inboxQuery.isLoading;
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedActivityIds, setSelectedActivityIds] = useState<number[]>([]);
  const [bulkApproving, setBulkApproving] = useState(false);
  const prevCount = useRef(0);

  const refetchInbox = () => queryClient.invalidateQueries({ queryKey: ['moderation', 'inbox', filter] });

  useEffect(() => {
    const count = activities.length;
    if (prevCount.current > 0 && count > prevCount.current) {
      notifications.show({
        title: t.moderation.queueUpdated,
        message: `${count - prevCount.current} ${t.moderation.newItems}`,
        color: 'blue',
      });
    }
    prevCount.current = count;
  }, [activities.length, t.moderation.newItems, t.moderation.queueUpdated]);

  useEffect(() => {
    const visibleIds = new Set(
      activities
        .map((a: any) => Number(a.id || a.activity_id))
        .filter((v: number) => Number.isFinite(v)),
    );
    setSelectedActivityIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [activities]);

  useEffect(() => {
    if (searchParams.get('auto') === '1' && activities.length > 0) {
      const next = activities[0];
      const aid = next.id || next.activity_id;
      if (aid) {
        window.location.hash = `#/owner/activities/${aid}?queue=1`;
      }
    }
  }, [searchParams, activities]);

  const handleApprove = async (id: number) => {
    try {
      await apiClient.post(`${API_PATHS.activitiesApprove}${id}/`);
      notifications.show({ title: t.moderation.approve, message: `#${id}`, color: 'green' });
      refetchInbox();
    } catch {
      notifications.show({ title: t.common.error, message: t.moderation.approveFailed, color: 'red' });
    }
  };

  const handleReject = async (reason: string, notes: string) => {
    if (!rejectId) return;
    try {
      await apiClient.post(`${API_PATHS.activitiesReject}${rejectId}/`, { reason, notes });
      notifications.show({ title: t.moderation.reject, message: reason, color: 'orange' });
      setRejectId(null);
      refetchInbox();
    } catch (e: any) {
      notifications.show({
        title: t.common.error,
        message: e?.response?.data?.detail || t.moderation.rejectFailed,
        color: 'red',
      });
    }
  };

  const assignToMe = async (activityId: number) => {
    try {
      await apiClient.patch(`${API_PATHS.moderationAssign}${activityId}/`, {
        assignee_id: user?.id,
      });
      notifications.show({ title: t.moderation.assigned, message: t.moderation.assignedToYou, color: 'blue' });
      refetchInbox();
    } catch {
      notifications.show({ title: t.common.error, message: t.moderation.assignFailed, color: 'red' });
    }
  };

  const publishEvent = async (id: number) => {
    try {
      await apiClient.patch(`/events/${id}/`, { status: 'PUBLISHED' });
      notifications.show({ title: t.moderation.published, message: t.moderation.publishLive, color: 'green' });
      refetchInbox();
    } catch {
      notifications.show({ title: t.common.error, message: t.moderation.publishFailed, color: 'red' });
    }
  };

  const visibleActivityIds = useMemo(
    () =>
      activities
        .map((a: any) => Number(a.id || a.activity_id))
        .filter((v: number) => Number.isFinite(v)),
    [activities],
  );
  const allSelected = visibleActivityIds.length > 0
    && visibleActivityIds.every((id) => selectedActivityIds.includes(id));
  const someSelected = visibleActivityIds.some((id) => selectedActivityIds.includes(id));

  const toggleSelectAll = (checked: boolean) => {
    setSelectedActivityIds(checked ? visibleActivityIds : []);
  };

  const toggleSelectOne = (id: number, checked: boolean) => {
    setSelectedActivityIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((v) => v !== id);
    });
  };

  const handleBulkApprove = async () => {
    if (selectedActivityIds.length === 0) {
      notifications.show({ title: t.common.error, message: t.moderation.bulkApproveEmpty, color: 'orange' });
      return;
    }
    setBulkApproving(true);
    try {
      const results = await Promise.allSettled(
        selectedActivityIds.map((id) => apiClient.post(`${API_PATHS.activitiesApprove}${id}/`)),
      );
      const approved = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - approved;
      if (approved > 0) {
        notifications.show({
          title: t.moderation.bulkApproveDone,
          message: `${approved} ${t.moderation.bulkApproveDoneMsg}`,
          color: 'green',
        });
      }
      if (failed > 0) {
        notifications.show({
          title: t.common.error,
          message: `${t.moderation.bulkApproveFailed} (${failed})`,
          color: 'red',
        });
      }
      setSelectedActivityIds([]);
      refetchInbox();
    } finally {
      setBulkApproving(false);
    }
  };

  const defaultTab = useMemo(() => {
    if (anomalies.length > 0) return 'anomalies';
    if (activities.length > 0) return 'activities';
    if (draftEvents.length > 0) return 'events';
    return 'activities';
  }, [anomalies.length, activities.length, draftEvents.length]);

  const totalCount = activities.length + anomalies.length + draftEvents.length;
  const canModerate = hasAnyPermission(['activities.approve', '*']);
  const currentActivity = activities[selectedIdx];
  const currentId = currentActivity?.id || currentActivity?.activity_id;

  useModerationHotkeys({
    enabled: canModerate && activities.length > 0,
    onApprove: currentId ? () => void handleApprove(currentId) : undefined,
    onReject: currentId ? () => setRejectId(currentId) : undefined,
    onNext: () => setSelectedIdx((i) => Math.min(i + 1, activities.length - 1)),
    onPrev: () => setSelectedIdx((i) => Math.max(i - 1, 0)),
  });

  return (
    <Box>
      <PageHeader
        title={t.moderation.inboxTitle}
        subtitle={user?.tenantId
          ? `${t.moderation.scopeScoped} · ${totalCount} ${t.common.open.toLowerCase()}`
          : `${t.moderation.scopePlatform} · ${totalCount} ${t.common.open.toLowerCase()}`}
      >
        <Button component={Link} to="/owner/moderation/history" variant="subtle" leftSection={<History size={16} />}>
          {t.moderation.history}
        </Button>
        <Button variant="light" leftSection={<RefreshCw size={16} />} onClick={() => refetchInbox()}>
          {t.moderation.refresh}
        </Button>
      </PageHeader>
      <Group mb="md">
        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as 'all' | 'me')}
          data={[
            { label: t.moderation.filterAll, value: 'all' },
            { label: t.moderation.assignedToMe, value: 'me' },
          ]}
        />
        <Checkbox
          label={t.common.selectAll}
          checked={allSelected}
          indeterminate={someSelected && !allSelected}
          onChange={(e) => toggleSelectAll(e.currentTarget.checked)}
        />
        <Button
          size="xs"
          variant="light"
          color="green"
          onClick={() => void handleBulkApprove()}
          disabled={selectedActivityIds.length === 0 || loading}
          loading={bulkApproving}
        >
          {t.common.bulkApprove} ({selectedActivityIds.length})
        </Button>
        <Text size="xs" c="dimmed">{t.moderation.hotkeys}</Text>
      </Group>
      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <Group mb="md">
          <Activity size={20} style={{ color: 'var(--accent)' }} />
          <Text fw={700} size="lg">{t.moderation.workQueue}</Text>
          <Badge color="orange" variant="light">{totalCount} {t.common.open.toLowerCase()}</Badge>
        </Group>

        <Tabs defaultValue={defaultTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="anomalies" leftSection={<ShieldAlert size={14} />}>
              {t.moderation.anomalies} ({anomalies.length})
            </Tabs.Tab>
            <Tabs.Tab value="activities" leftSection={<Activity size={14} />}>
              {t.moderation.activitiesTab} ({activities.length})
            </Tabs.Tab>
            <Tabs.Tab value="events" leftSection={<Calendar size={14} />}>
              {t.moderation.eventsDraftTab} ({draftEvents.length})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="anomalies">
            {loading ? <Skeleton height={120} /> : anomalies.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">{t.moderation.noAnomalies}</Text>
            ) : (
              <Table>
                <Table.Tbody>
                  {anomalies.map((a) => (
                    <Table.Tr key={a.id}>
                      <Table.Td>
                        <Badge size="sm" color={severityColor(a.severity)}>{severityLabel(a.severity)}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Anchor component={Link} to={`/owner/activities/${a.activity_id}?queue=1`}>{a.user}</Anchor>
                      </Table.Td>
                      <Table.Td>{a.score.toFixed(2)}</Table.Td>
                      {canModerate && (
                        <Table.Td>
                          <Button size="xs" color="green" onClick={() => void handleApprove(a.activity_id)}>{t.moderation.approve}</Button>
                        </Table.Td>
                      )}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="activities">
            {loading ? <Skeleton height={120} /> : activities.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">{t.moderation.queueEmpty}</Text>
            ) : (
              <Table>
                <Table.Tbody>
                  {activities.map((a: any, idx: number) => {
                    const aid = a.id || a.activity_id;
                    return (
                      <Table.Tr key={aid} bg={idx === selectedIdx ? 'var(--surface-secondary)' : undefined}>
                        <Table.Td>
                          <Anchor component={Link} to={`/owner/activities/${aid}?queue=1`}>
                            {a.user || a.username}
                          </Anchor>
                          <QueueAgeBadge createdAt={a.created_at} />
                        </Table.Td>
                        <Table.Td>{a.type}</Table.Td>
                        <Table.Td>{a.distance ? `${(a.distance / 1000).toFixed(1)} km` : '—'}</Table.Td>
                        <Table.Td>{a.assignee_username ?? t.moderation.assigneeUnknown}</Table.Td>
                        {canModerate && (
                          <Table.Td>
                            <Group gap={4}>
                              <Checkbox
                                aria-label={t.moderation.selectRow}
                                checked={selectedActivityIds.includes(Number(aid))}
                                onChange={(e) => toggleSelectOne(Number(aid), e.currentTarget.checked)}
                              />
                              <Button size="xs" variant="light" onClick={() => void assignToMe(aid)}>{t.common.assignMe}</Button>
                              <Button size="xs" color="green" onClick={() => void handleApprove(aid)}>{t.moderation.approve}</Button>
                              <Button size="xs" color="red" variant="light" onClick={() => setRejectId(aid)}>{t.moderation.reject}</Button>
                            </Group>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="events">
            {draftEvents.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">{t.moderation.queueEmpty}</Text>
            ) : (
              draftEvents.map((e) => (
                <Group key={e.id} justify="space-between" mb="sm">
                  <Text size="sm" fw={500}>{e.title}</Text>
                  <Button size="xs" onClick={() => void publishEvent(e.id)}>{t.moderation.publishCta}</Button>
                </Group>
              ))
            )}
          </Tabs.Panel>
        </Tabs>
      </Card>
      <RejectReasonModal
        opened={rejectId != null}
        onClose={() => setRejectId(null)}
        onConfirm={(r, n) => void handleReject(r, n)}
      />
    </Box>
  );
};
