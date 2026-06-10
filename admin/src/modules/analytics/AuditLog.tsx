import React, { useState, useEffect } from 'react';
import { Table, Text, Badge, ScrollArea, Skeleton } from '@mantine/core';
import { AdminApi } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';

interface AuditEntry { id?: number; timestamp: string; action: string; impersonator_username?: string; target_user_username?: string; tenant_id?: string; status_code: number; ip_address?: string; }

export const AuditLog: React.FC = () => {
    const [logs, setLogs] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        AdminApi.getAuditLogs(200)
            .then(setLogs)
            .catch(() => { /* dashboard widget — silent fail */ })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div><PageHeader title="Audit Log" subtitle="All admin actions and impersonation sessions" />
            {loading ? <Skeleton height={400} /> : logs.length === 0 ? <Text c="dimmed" ta="center" py="xl">No audit logs.</Text> : (
                <ScrollArea h={600}><Table><thead><tr><th>Time</th><th>Action</th><th>User</th><th>Target</th><th>IP</th><th>Status</th></tr></thead><tbody>{logs.map((l, i) => (
                    <tr key={i}><td><Text size="xs" ff="monospace">{new Date(l.timestamp).toLocaleString()}</Text></td><td><Text size="xs" maw={250} style={{ wordBreak: 'break-word' }}>{l.action}</Text></td><td><Text size="xs">{l.impersonator_username || '-'}</Text></td><td><Text size="xs">{l.target_user_username || '-'}</Text></td><td><Text size="xs" ff="monospace">{l.ip_address || '-'}</Text></td><td><Badge size="xs" color={l.status_code < 400 ? 'green' : 'red'}>{l.status_code}</Badge></td></tr>
                ))}</tbody></Table></ScrollArea>
            )}
        </div>
    );
};
