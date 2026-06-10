import React, { useState, useEffect } from 'react';
import { Table, Text, Badge, ScrollArea, Skeleton, Box } from '@mantine/core';
import { AdminApi } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';
import { useI18n } from '../../i18n/useI18n';
import { useAuth } from '../../core/auth/useAuth';

interface AuditEntry {
  id?: number;
  timestamp: string;
  action: string;
  impersonator_username?: string;
  target_user_username?: string;
  tenant_id?: string;
  status_code: number;
  ip_address?: string;
}

export const AuditLog: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tenantId =
      user?.role === 'TENANT_ADMIN' && user?.tenantId ? String(user.tenantId) : undefined;
    AdminApi.getAuditLogs(200, tenantId)
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.role, user?.tenantId]);

  return (
    <Box>
      <PageHeader title={t.analytics.auditTitle} subtitle={t.analytics.auditSubtitle} />
      {loading ? (
        <Skeleton height={400} />
      ) : logs.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">{t.analytics.auditEmpty}</Text>
      ) : (
        <ScrollArea h={600}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t.analytics.auditTime}</Table.Th>
                <Table.Th>{t.analytics.auditAction}</Table.Th>
                <Table.Th>{t.analytics.auditUser}</Table.Th>
                <Table.Th>{t.analytics.auditTarget}</Table.Th>
                <Table.Th>IP</Table.Th>
                <Table.Th>{t.analytics.auditStatus}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {logs.map((l, i) => (
                <Table.Tr key={l.id ?? i}>
                  <Table.Td>
                    <Text size="xs" ff="monospace">{new Date(l.timestamp).toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" maw={250} style={{ wordBreak: 'break-word' }}>{l.action}</Text>
                  </Table.Td>
                  <Table.Td><Text size="xs">{l.impersonator_username || '—'}</Text></Table.Td>
                  <Table.Td><Text size="xs">{l.target_user_username || '—'}</Text></Table.Td>
                  <Table.Td><Text size="xs" ff="monospace">{l.ip_address || '—'}</Text></Table.Td>
                  <Table.Td>
                    <Badge size="xs" color={l.status_code < 400 ? 'green' : 'red'}>{l.status_code}</Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Box>
  );
};
