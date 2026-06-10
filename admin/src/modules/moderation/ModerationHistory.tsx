import React, { useEffect, useState } from 'react';
import { Box, Card, Table, Text, Badge, Skeleton } from '@mantine/core';
import { API_PATHS } from '@4velo/api-client';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';
import { useI18n } from '../../i18n/useI18n';

interface HistoryRow {
  activity_id: number;
  user: string;
  type: string;
  is_verified: boolean;
  rejection_reason: string | null;
  moderated_at: string | null;
}

export const ModerationHistory: React.FC = () => {
  const { t } = useI18n();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get(API_PATHS.moderationHistory)
      .then((r) => setRows(r.data?.results ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <PageHeader title={t.moderation.history} subtitle={t.moderation.historySubtitle} />
      <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        {loading ? (
          <Skeleton height={200} />
        ) : rows.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">{t.moderation.noHistory}</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t.moderation.when}</Table.Th>
                <Table.Th>{t.moderation.athlete}</Table.Th>
                <Table.Th>{t.moderation.type}</Table.Th>
                <Table.Th>{t.moderation.outcome}</Table.Th>
                <Table.Th>{t.moderation.reason}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r) => (
                <Table.Tr key={`${r.activity_id}-${r.moderated_at}`}>
                  <Table.Td>{r.moderated_at ? new Date(r.moderated_at).toLocaleString() : t.moderation.assigneeUnknown}</Table.Td>
                  <Table.Td>{r.user}</Table.Td>
                  <Table.Td>{r.type}</Table.Td>
                  <Table.Td>
                    <Badge color={r.is_verified ? 'green' : 'red'} size="sm">
                      {r.is_verified ? t.moderation.approved : t.moderation.rejected}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{r.rejection_reason ?? t.moderation.assigneeUnknown}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Box>
  );
};
