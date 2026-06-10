import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Card, Text, Table, Badge, SimpleGrid, ThemeIcon, Skeleton, Stack, Button, Group,
    Modal, TextInput, NumberInput,
} from '@mantine/core';
import { Gift, Users, TrendingUp, CheckCircle2, Plus } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { apiClient } from '../../api/client';
import { useAuth } from '../../core/auth/useAuth';
import { SponsorEmptyCta } from '../../core/components/SponsorEmptyCta';
import { PageHeader } from '../../core/components/PageHeader';

export const RewardsVouchers: React.FC = () => {
    const { user } = useAuth();
    const isSponsor = user?.role === 'SPONSOR' || user?.role === 'GLOBAL_OWNER';
    const [pools, setPools] = useState<any[]>([]);
    const [balance, setBalance] = useState<{ points: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({
        title: '',
        description: '',
        points_required: 100,
        quantity: 10,
        valid_days: 90,
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        const reqs = [apiClient.get('/rewards/pools/')];
        if (user?.role !== 'SPONSOR') {
            reqs.push(apiClient.get('/rewards/balance/'));
        }
        try {
            const [poolsRes, balanceRes] = await Promise.all(reqs);
            setPools(Array.isArray(poolsRes.data) ? poolsRes.data : []);
            setBalance(balanceRes?.data ?? { points: 0 });
        } catch {
            setError('Failed to load rewards data.');
        } finally {
            setLoading(false);
        }
    }, [user?.role]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        if (!form.title.trim()) {
            notifications.show({ title: 'Validation', message: 'Title is required.', color: 'orange' });
            return;
        }
        setCreating(true);
        try {
            await apiClient.post('/rewards/pools/', form);
            notifications.show({ title: 'Voucher pool created', message: form.title, color: 'green' });
            setModalOpen(false);
            setForm({ title: '', description: '', points_required: 100, quantity: 10, valid_days: 90 });
            load();
        } catch (err: any) {
            const detail = err.response?.data?.detail || 'Failed to create voucher pool.';
            notifications.show({ title: 'Error', message: String(detail), color: 'red' });
        } finally {
            setCreating(false);
        }
    };

    const activeCount = pools.length;
    const totalAvailable = pools.reduce((sum, p) => sum + (p.available || 0), 0);

    const stats = [
        { icon: Gift, label: 'Active Vouchers', value: String(activeCount), color: 'indigo' },
        { icon: Users, label: 'Total Available', value: String(totalAvailable), color: 'green' },
        { icon: TrendingUp, label: 'Pools Active', value: String(activeCount), color: 'violet' },
        { icon: CheckCircle2, label: 'Your Points', value: String(balance?.points ?? '—'), color: 'orange' },
    ];

    return (
        <Box p="md">
            <PageHeader
                title="Rewards & Vouchers"
                subtitle="Manage voucher pools and redemptions"
            >
                {isSponsor && (
                    <Button leftSection={<Plus size={16} />} onClick={() => setModalOpen(true)}>
                        New voucher pool
                    </Button>
                )}
            </PageHeader>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="xl">
                {stats.map((s, i) => (
                    <Card key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
                        <ThemeIcon size={36} radius="md" color={s.color} variant="light" mx="auto"><s.icon size={18} /></ThemeIcon>
                        {loading ? <Skeleton height={28} mt="sm" mx="auto" width={60} radius="sm" /> : <Text fw={700} size="xl" mt="sm">{s.value}</Text>}
                        <Text size="xs" c="dimmed">{s.label}</Text>
                    </Card>
                ))}
            </SimpleGrid>
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                <Text fw={700} mb="md">Active Vouchers</Text>
                {loading ? (
                    <Stack gap="sm">{[...Array(3)].map((_, i) => <Skeleton key={i} height={40} radius="md" />)}</Stack>
                ) : error ? (
                    <Text c="red" size="sm" ta="center">{error}</Text>
                ) : pools.length === 0 ? (
                    isSponsor ? (
                        <SponsorEmptyCta />
                    ) : (
                        <Text c="dimmed" ta="center" py="xl">No active voucher pools.</Text>
                    )
                ) : (
                    <Table>
                        <thead><tr><th>Title</th><th>Points</th><th>Sponsor</th><th>Available</th><th>Expires</th></tr></thead>
                        <tbody>
                            {pools.map((v: any) => (
                                <tr key={v.id}>
                                    <td><Text fw={500} ff="monospace">{v.title}</Text></td>
                                    <td>{v.points_required} pts</td>
                                    <td>{v.sponsor_name || '—'}</td>
                                    <td>{v.available}</td>
                                    <td><Badge color={new Date(v.valid_until) > new Date() ? 'green' : 'red'}>{new Date(v.valid_until).toLocaleDateString()}</Badge></td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </Card>

            <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Create voucher pool" centered>
                <Stack gap="md">
                    <TextInput
                        label="Offer title"
                        placeholder="e.g. Free coffee after 50 km"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        required
                    />
                    <TextInput
                        label="Description"
                        placeholder="Short description for athletes"
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                    <NumberInput
                        label="Points required"
                        min={1}
                        value={form.points_required}
                        onChange={(v) => setForm({ ...form, points_required: Number(v) || 1 })}
                    />
                    <NumberInput
                        label="Number of vouchers"
                        min={1}
                        max={500}
                        value={form.quantity}
                        onChange={(v) => setForm({ ...form, quantity: Number(v) || 1 })}
                    />
                    <NumberInput
                        label="Valid for (days)"
                        min={1}
                        max={365}
                        value={form.valid_days}
                        onChange={(v) => setForm({ ...form, valid_days: Number(v) || 90 })}
                    />
                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => setModalOpen(false)}>Cancel</Button>
                        <Button loading={creating} onClick={handleCreate}>Create pool</Button>
                    </Group>
                </Stack>
            </Modal>
        </Box>
    );
};
