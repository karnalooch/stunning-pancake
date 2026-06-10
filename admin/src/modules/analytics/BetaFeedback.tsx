import React, { useMemo, useState } from 'react';
import { Box, Card, Text, Badge, Group, Stack, Skeleton, Button, Tabs, Select } from '@mantine/core';
import { Check, Clock } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { PageHeader } from '../../core/components/PageHeader';

interface FeedbackItem {
    id: number;
    username: string;
    category: string;
    message: string;
    screen: string;
    severity: number;
    resolved: boolean;
    created_at: string;
}

export const BetaFeedback: React.FC = () => {
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<string | null>('open');
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
    const [resolving, setResolving] = useState<Record<number, boolean>>({});

    const { data: items = [], isLoading, error } = useQuery({
        queryKey: ['feedback', 'beta'],
        queryFn: async () => {
            const r = await apiClient.get<FeedbackItem[]>('/activities/beta-feedback/list/');
            return Array.isArray(r.data) ? r.data : [];
        },
        staleTime: 20_000,
    });

    const filtered = useMemo(() => {
        let rows = items;
        if (tab === 'open') rows = rows.filter((f) => !f.resolved);
        if (tab === 'resolved') rows = rows.filter((f) => f.resolved);
        if (categoryFilter) rows = rows.filter((f) => f.category === categoryFilter);
        return rows;
    }, [items, tab, categoryFilter]);

    const categories = useMemo(
        () => [...new Set(items.map((f) => f.category).filter(Boolean))],
        [items],
    );

    const handleResolve = (id: number) => {
        setResolving((prev) => ({ ...prev, [id]: true }));
        apiClient.post(`/activities/beta-feedback/${id}/resolve/`)
            .then(() => {
                queryClient.setQueryData<FeedbackItem[]>(['feedback', 'beta'], (prev) =>
                    (prev ?? []).map((item) => (item.id === id ? { ...item, resolved: true } : item)),
                );
            })
            .finally(() => setResolving((prev) => ({ ...prev, [id]: false })));
    };

    return (
        <Box p="md">
            <PageHeader title={t.analytics.feedbackTitle} subtitle={t.nav.items.feedback} />
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                <Group mb="md" justify="space-between">
                    <Tabs value={tab} onChange={setTab}>
                        <Tabs.List>
                            <Tabs.Tab value="open">{t.analytics.feedbackOpen}</Tabs.Tab>
                            <Tabs.Tab value="resolved">{t.analytics.feedbackResolved}</Tabs.Tab>
                            <Tabs.Tab value="all">{t.analytics.feedbackAll}</Tabs.Tab>
                        </Tabs.List>
                    </Tabs>
                    {categories.length > 0 && (
                        <Select
                            size="xs"
                            clearable
                            placeholder={t.analytics.feedbackCategory}
                            data={categories.map((c) => ({ value: c, label: c }))}
                            value={categoryFilter}
                            onChange={setCategoryFilter}
                            w={160}
                        />
                    )}
                </Group>
                {isLoading ? (
                    <Stack gap="sm">{[...Array(3)].map((_, i) => <Skeleton key={i} height={64} radius="md" />)}</Stack>
                ) : error ? (
                    <Text c="red" size="sm" ta="center">{t.analytics.feedbackLoadFailed}</Text>
                ) : filtered.length === 0 ? (
                    <Text c="dimmed" ta="center">{t.analytics.feedbackEmpty}</Text>
                ) : (
                    <Stack gap="sm">
                        {filtered.map((f) => (
                            <Group key={f.id} p="sm" style={{ borderRadius: 12, background: 'var(--surface-secondary)', border: '1px solid var(--border-subtle)' }} wrap="nowrap">
                                <Box style={{ flex: 1 }}>
                                    <Group gap="xs" mb={4}>
                                        <Text size="sm" fw={600}>{f.username}</Text>
                                        <Badge size="xs" variant="outline">{f.category}</Badge>
                                        <Badge size="xs" color="gray" variant="light">{t.analytics.feedbackSeverity}: {f.severity}</Badge>
                                    </Group>
                                    <Text size="xs" c="dimmed">{f.message}</Text>
                                    {f.screen && <Text size="xs" c="dimmed" mt={4}>Screen: {f.screen}</Text>}
                                </Box>
                                {f.resolved ? (
                                    <Badge color="green" variant="light" leftSection={<Check size={10} />}>{t.analytics.feedbackResolved}</Badge>
                                ) : (
                                    <Group gap="xs">
                                        <Badge color="orange" variant="light" leftSection={<Clock size={10} />}>{t.analytics.feedbackOpen}</Badge>
                                        <Button
                                            size="xs"
                                            variant="light"
                                            color="green"
                                            loading={resolving[f.id]}
                                            onClick={() => handleResolve(f.id)}
                                        >
                                            {t.analytics.feedbackResolve}
                                        </Button>
                                    </Group>
                                )}
                            </Group>
                        ))}
                    </Stack>
                )}
            </Card>
        </Box>
    );
};
