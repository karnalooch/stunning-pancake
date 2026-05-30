import React, { useState, useEffect } from 'react';
import { Box, Table, Text, Badge, Skeleton, Alert, Group, Pagination, Checkbox, Button, TextInput, Select, ActionIcon, Tooltip } from '@mantine/core';
import { AlertCircle, Bike, Footprints, PersonStanding, ArrowUpRight, Check, X, Search, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';

interface ActivityItem {
    id: number;
    user?: string;
    user_info?: { username: string; id: number };
    type: string;
    start_time: string;
    end_time?: string | null;
    distance: number;
    duration?: number;
    is_verified: boolean;
    verification_score?: number;
}

const typeIcons: Record<string, React.ComponentType<{ size?: number }>> = {
    RUN: Footprints,
    BIKE: Bike,
    WALK: PersonStanding,
};

const PAGE_SIZE = 50;

export const ActivitiesList: React.FC = () => {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);
    const navigate = useNavigate();

    // Advanced filters
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    const [prevDeps, setPrevDeps] = useState({ page, filterType, filterStatus, filterDateFrom, filterDateTo, searchQuery });

    if (
        page !== prevDeps.page ||
        filterType !== prevDeps.filterType ||
        filterStatus !== prevDeps.filterStatus ||
        filterDateFrom !== prevDeps.filterDateFrom ||
        filterDateTo !== prevDeps.filterDateTo ||
        searchQuery !== prevDeps.searchQuery
    ) {
        setPrevDeps({ page, filterType, filterStatus, filterDateFrom, filterDateTo, searchQuery });
        setLoading(true);
    }

    useEffect(() => {
        const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
        if (filterType) params.type = filterType;
        if (filterStatus === 'verified') params.verified = 'true';
        if (filterStatus === 'pending') params.verified = 'false';
        if (filterDateFrom) params.start_after = filterDateFrom;
        if (filterDateTo) params.start_before = filterDateTo;
        if (searchQuery) params.search = searchQuery;

        apiClient.get('/activities/admin/all/', { params })
            .then(r => {
                const results = Array.isArray(r.data) ? r.data : r.data?.results ?? [];
                setActivities(results);
                setTotal(r.data?.count ?? results.length);
            })
            .catch(() => setError('Failed to load activities.'))
            .finally(() => setLoading(false));
    }, [page, filterType, filterStatus, filterDateFrom, filterDateTo, searchQuery]);

    const allSelected = activities.length > 0 && selected.size === activities.length;
    const someSelected = selected.size > 0;

    const toggleSelect = (id: number) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelected(new Set());
        } else {
            setSelected(new Set(activities.map(a => a.id)));
        }
    };

    const handleBulkAction = async (action: 'approve' | 'reject') => {
        if (selected.size === 0) return;
        setBulkLoading(true);
        let success = 0;
        let failed = 0;

        for (const id of selected) {
            try {
                await apiClient.post(`/activities/admin/${action}/${id}/`);
                success++;
            } catch {
                failed++;
            }
        }

        notifications.show({
            title: 'Bulk Action Complete',
            message: `${action === 'approve' ? 'Approved' : 'Rejected'} ${success} activities${failed > 0 ? `, ${failed} failed` : ''}.`,
            color: failed > 0 ? 'orange' : 'green',
        });

        setSelected(new Set());
        setBulkLoading(false);
        // Reload
        setLoading(true);
        const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
        apiClient.get('/activities/admin/all/', { params })
            .then(r => {
                const results = Array.isArray(r.data) ? r.data : r.data?.results ?? [];
                setActivities(results);
                setTotal(r.data?.count ?? results.length);
            })
            .finally(() => setLoading(false));
    };

    const clearFilters = () => {
        setSearchQuery('');
        setFilterType('');
        setFilterStatus('');
        setFilterDateFrom('');
        setFilterDateTo('');
        setPage(1);
    };

    const hasActiveFilters = filterType || filterStatus || filterDateFrom || filterDateTo || searchQuery;

    if (loading && activities.length === 0) {
        return (
            <Box p="md">
                <PageHeader title="All Activities" subtitle="Browse and inspect every recorded activity" />
                {[...Array(10)].map((_, i) => <Skeleton key={i} height={48} radius="md" mb="sm" />)}
            </Box>
        );
    }

    if (error) {
        return (
            <Box p="md">
                <PageHeader title="All Activities" />
                <Alert color="red" icon={<AlertCircle size={18} />} title="Error">{error}</Alert>
            </Box>
        );
    }

    return (
        <Box p="md">
            <PageHeader title="All Activities" subtitle={`${total.toLocaleString()} activities recorded`} />

            {/* Search & Filter Bar */}
            <Group mb="md" justify="space-between" wrap="wrap">
                <Group gap="sm">
                    <TextInput
                        placeholder="Search by username..."
                        leftSection={<Search size={14} />}
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.currentTarget.value); setPage(1); }}
                        size="sm"
                        style={{ width: 240 }}
                    />
                    <Tooltip label="Toggle advanced filters">
                        <ActionIcon
                            variant={filtersOpen || hasActiveFilters ? 'filled' : 'subtle'}
                            color={hasActiveFilters ? 'blue' : 'gray'}
                            onClick={() => setFiltersOpen(!filtersOpen)}
                            size="lg"
                        >
                            <Filter size={16} />
                        </ActionIcon>
                    </Tooltip>
                    {hasActiveFilters && (
                        <Button variant="subtle" size="xs" color="gray" onClick={clearFilters}>
                            Clear filters
                        </Button>
                    )}
                </Group>
            </Group>

            {/* Advanced Filters Panel */}
            {filtersOpen && (
                <Group mb="md" p="sm" gap="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <Select
                        label="Activity Type"
                        placeholder="All types"
                        size="sm"
                        value={filterType}
                        onChange={(v) => { setFilterType(v || ''); setPage(1); }}
                        data={[
                            { value: '', label: 'All types' },
                            { value: 'RUN', label: 'Run' },
                            { value: 'BIKE', label: 'Bike' },
                            { value: 'WALK', label: 'Walk' },
                        ]}
                        clearable
                        style={{ width: 150 }}
                    />
                    <Select
                        label="Verification"
                        placeholder="All statuses"
                        size="sm"
                        value={filterStatus}
                        onChange={(v) => { setFilterStatus(v || ''); setPage(1); }}
                        data={[
                            { value: '', label: 'All statuses' },
                            { value: 'verified', label: 'Verified' },
                            { value: 'pending', label: 'Pending' },
                        ]}
                        clearable
                        style={{ width: 160 }}
                    />
                    <TextInput
                        label="Date from"
                        type="date"
                        size="sm"
                        value={filterDateFrom}
                        onChange={(e) => { setFilterDateFrom(e.currentTarget.value); setPage(1); }}
                        style={{ width: 160 }}
                    />
                    <TextInput
                        label="Date to"
                        type="date"
                        size="sm"
                        value={filterDateTo}
                        onChange={(e) => { setFilterDateTo(e.currentTarget.value); setPage(1); }}
                        style={{ width: 160 }}
                    />
                </Group>
            )}

            {/* Bulk Action Bar */}
            {someSelected && (
                <Group mb="sm" p="sm" gap="sm" style={{ background: 'var(--accent-light)', borderRadius: 10, border: '1px solid var(--accent)' }}>
                    <Text size="sm" fw={600} style={{ color: 'var(--accent)' }}>
                        {selected.size} selected
                    </Text>
                    <Button
                        size="xs"
                        color="green"
                        variant="filled"
                        leftSection={<Check size={14} />}
                        loading={bulkLoading}
                        onClick={() => handleBulkAction('approve')}
                    >
                        Approve Selected
                    </Button>
                    <Button
                        size="xs"
                        color="red"
                        variant="light"
                        leftSection={<X size={14} />}
                        loading={bulkLoading}
                        onClick={() => handleBulkAction('reject')}
                    >
                        Reject Selected
                    </Button>
                    <Button
                        size="xs"
                        variant="subtle"
                        color="gray"
                        onClick={() => setSelected(new Set())}
                    >
                        Clear selection
                    </Button>
                </Group>
            )}

            {activities.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                    {hasActiveFilters ? 'No activities match your filters.' : 'No activities found.'}
                </Text>
            ) : (
                <Box style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th w={40}>
                                    <Checkbox
                                        checked={allSelected}
                                        indeterminate={!allSelected && someSelected}
                                        onChange={toggleSelectAll}
                                        aria-label="Select all"
                                    />
                                </Table.Th>
                                <Table.Th>#</Table.Th>
                                <Table.Th>User</Table.Th>
                                <Table.Th>Type</Table.Th>
                                <Table.Th>Distance</Table.Th>
                                <Table.Th>Duration</Table.Th>
                                <Table.Th>Date</Table.Th>
                                <Table.Th>Status</Table.Th>
                                <Table.Th></Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {activities.map((a) => {
                                const Icon = typeIcons[a.type] || Bike;
                                const username = a.user_info?.username || a.user || 'Unknown';
                                const distKm = ((a.distance || 0) / 1000).toFixed(1);
                                const durationNum = typeof a.duration === 'number' ? a.duration : Number(a.duration);
                                const durationMin = !isNaN(durationNum) && durationNum > 0 ? Math.floor(durationNum / 60) : null;
                                const isChecked = selected.has(a.id);
                                return (
                                    <Table.Tr
                                        key={a.id}
                                        style={{ background: isChecked ? 'var(--accent-light)' : undefined }}
                                    >
                                        <Table.Td>
                                            <Checkbox
                                                checked={isChecked}
                                                onChange={(e) => { e.stopPropagation(); toggleSelect(a.id); }}
                                                aria-label={`Select activity #${a.id}`}
                                            />
                                        </Table.Td>
                                        <Table.Td>
                                            <Text
                                                size="xs"
                                                ff="monospace"
                                                c="dimmed"
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => navigate(`/owner/activities/${a.id}`)}
                                            >
                                                #{a.id}
                                            </Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text
                                                size="sm"
                                                fw={500}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => navigate(`/owner/activities/${a.id}`)}
                                            >
                                                {username}
                                            </Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap={6} style={{ cursor: 'pointer' }} onClick={() => navigate(`/owner/activities/${a.id}`)}>
                                                <Icon size={14} />
                                                <Text size="sm">{a.type}</Text>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="sm" style={{ cursor: 'pointer' }} onClick={() => navigate(`/owner/activities/${a.id}`)}>
                                                {distKm} km
                                            </Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="sm" style={{ cursor: 'pointer' }} onClick={() => navigate(`/owner/activities/${a.id}`)}>
                                                {durationMin != null ? `${durationMin} min` : '—'}
                                            </Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="xs" style={{ cursor: 'pointer' }} onClick={() => navigate(`/owner/activities/${a.id}`)}>
                                                {new Date(a.start_time).toLocaleDateString()}
                                            </Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge
                                                color={a.is_verified ? 'green' : 'orange'}
                                                variant="light"
                                                size="xs"
                                            >
                                                {a.is_verified ? 'Verified' : 'Pending'}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <ArrowUpRight
                                                size={14}
                                                style={{ color: 'var(--text-tertiary)', cursor: 'pointer' }}
                                                onClick={() => navigate(`/owner/activities/${a.id}`)}
                                            />
                                        </Table.Td>
                                    </Table.Tr>
                                );
                            })}
                        </Table.Tbody>
                    </Table>
                </Box>
            )}
            {total > PAGE_SIZE && (
                <Group justify="center" mt="md">
                    <Pagination total={Math.ceil(total / PAGE_SIZE)} value={page} onChange={setPage} />
                </Group>
            )}
        </Box>
    );
};
