import React, { useEffect, useState, useCallback } from 'react';
import { Box, Card, Text, Group, Badge, Button, Stack, Skeleton, Anchor } from '@mantine/core';
import { Inbox, ShieldAlert, MessageSquare, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_PATHS } from '@4velo/api-client';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';
import { useI18n } from '../../i18n/useI18n';

interface InboxItem {
  id: string;
  label: string;
  href: string;
  priority: 'high' | 'medium' | 'low';
}

export const ActionInbox: React.FC = () => {
  const { t } = useI18n();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [queueRes, feedbackRes] = await Promise.all([
        apiClient.get(API_PATHS.moderationQueue, { params: { limit: 5 } }),
        apiClient.get('/activities/beta-feedback/list/').catch(() => ({ data: [] })),
      ]);
      const next: InboxItem[] = [];
      const pending = queueRes.data?.count ?? 0;
      if (pending > 0) {
        next.push({
          id: 'mod',
          label: `${pending} ${t.actionInbox.pendingModeration}`,
          href: '/owner/moderation',
          priority: pending > 50 ? 'high' : 'medium',
        });
      }
      const feedback = Array.isArray(feedbackRes.data) ? feedbackRes.data : feedbackRes.data?.results ?? [];
      const openFb = feedback.filter((f: any) => !f.resolved).length;
      if (openFb > 0) {
        next.push({
          id: 'fb',
          label: `${openFb} ${t.actionInbox.betaFeedbackItems}`,
          href: '/owner/analytics/feedback',
          priority: 'low',
        });
      }
      next.push({
        id: 'anticheat',
        label: t.actionInbox.reviewAntiCheat,
        href: '/owner/anti-cheat',
        priority: 'medium',
      });
      setItems(next);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t.actionInbox.betaFeedbackItems, t.actionInbox.pendingModeration, t.actionInbox.reviewAntiCheat]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <Box>
      <PageHeader title={t.controlPlane.actionInbox} subtitle={t.controlPlane.actionSubtitle}>
        <Button variant="light" leftSection={<RefreshCw size={16} />} onClick={() => void load()}>{t.common.refresh}</Button>
      </PageHeader>
      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        {loading ? (
          <Stack gap="sm">{[...Array(3)].map((_, i) => <Skeleton key={i} height={48} />)}</Stack>
        ) : items.length === 0 ? (
          <Text c="dimmed">{t.actionInbox.empty}</Text>
        ) : (
          <Stack gap="sm">
            {items.map((item) => (
              <Group key={item.id} justify="space-between" wrap="nowrap">
                <Group gap="sm">
                  <Inbox size={18} />
                  <Anchor component={Link} to={item.href} fw={500}>{item.label}</Anchor>
                </Group>
                <Badge color={item.priority === 'high' ? 'red' : item.priority === 'medium' ? 'orange' : 'gray'}>
                  {item.priority === 'high'
                    ? t.actionInbox.priorityHigh
                    : item.priority === 'medium'
                      ? t.actionInbox.priorityMedium
                      : t.actionInbox.priorityLow}
                </Badge>
              </Group>
            ))}
          </Stack>
        )}
        <Group mt="lg" gap="xs">
          <ShieldAlert size={14} />
          <Text size="xs" c="dimmed">{t.actionInbox.simulatorKpiHint}</Text>
        </Group>
        <Group mt="xs" gap="xs">
          <MessageSquare size={14} />
          <Text size="xs" c="dimmed">{t.actionInbox.drillDownHint}</Text>
        </Group>
      </Card>
    </Box>
  );
};
