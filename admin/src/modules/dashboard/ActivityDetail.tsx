import React, { useState, useEffect } from 'react';
import { Box, Text, Title, Group, Badge, Card, Skeleton, Alert, Stack } from '@mantine/core';
import { MapPin, Clock, ShieldCheck, Bike, Footprints, PersonStanding } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../../api/client';

const typeIcons: Record<string, any> = { RUN: Footprints, BIKE: Bike, WALK: PersonStanding, WHEELCHAIR: PersonStanding };
const typeLabels: Record<string, string> = { RUN: 'Running', BIKE: 'Cycling', WALK: 'Walking', WHEELCHAIR: 'Wheelchair' };

interface ActivityDetailData {
    id: number;
    type: string;
    start_time: string;
    end_time: string | null;
    distance: number;
    duration: string | null;
    is_verified: boolean;
    verification_score: number;
    route_coords: Array<[number, number]> | null;
    user_info: { id: number; username: string; role: string };
    created_at: string;
}

export const ActivityDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<ActivityDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        apiClient.get(`/activities/sessions/${id}/detail/`)
            .then(r => setData(r.data))
            .catch(err => {
                const detail = err.response?.data?.detail;
                setError(typeof detail === 'string' ? detail : err.message || 'Failed to load activity');
            })
            .finally(() => setLoading(false));
    }, [id]);

    const TypeIcon = typeIcons[data?.type || ''] || Clock;

    const routePointCount = data?.route_coords?.length ?? 0;
    const routeStats = routePointCount > 0 ? `${routePointCount.toLocaleString()} GPS points` : null;

    // ── Loading Skeleton ──────────────────────────────────────────
    if (loading) {
        return (
            <Box p="md">
                <Skeleton height={32} width={200} mb="md" radius="sm" />
                <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }} mb="md">
                    <Skeleton height={24} width={150} mb="md" />
                    <Group gap="xl" mt="sm">
                        {[...Array(5)].map((_, i) => (
                            <Box key={i}>
                                <Skeleton height={12} width={48} mb={4} />
                                <Skeleton height={18} width={80} />
                            </Box>
                        ))}
                    </Group>
                </Card>
                <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }} mb="md">
                    <Skeleton height={24} width={150} mb="md" />
                    <Skeleton height={300} radius={12} />
                </Card>
                <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                    <Skeleton height={24} width={180} mb="md" />
                    <Group gap="sm">
                        <Skeleton height={24} width={130} radius="xl" />
                        <Skeleton height={24} width={120} radius="xl" />
                    </Group>
                </Card>
            </Box>
        );
    }

    // ── Error State ───────────────────────────────────────────────
    if (error) {
        return (
            <Box p="md">
                <Title order={2} mb="md">Activity #{id}</Title>
                <Alert color="red" title="Error Loading Activity" variant="light">
                    {error}
                </Alert>
            </Box>
        );
    }

    // ── Empty / Not Found ────────────────────────────────────────
    if (!data) {
        return (
            <Box p="md">
                <Title order={2} mb="md">Activity #{id}</Title>
                <Alert color="gray" title="Not Found" variant="light">
                    No activity data found for ID #{id}.
                </Alert>
            </Box>
        );
    }

    // ── Derived Values ───────────────────────────────────────────
    const scorePct = Math.round(data.verification_score * 100);
    const scoreColor = data.verification_score >= 0.7 ? 'green' : data.verification_score >= 0.4 ? 'yellow' : 'red';
    const firstCoord = routePointCount > 0
        ? `[${data.route_coords![0][1].toFixed(4)}, ${data.route_coords![0][0].toFixed(4)}]`
        : null;

    // ── Main View ────────────────────────────────────────────────
    return (
        <Box p="md">
            <Title order={2} mb="md">Activity #{id}</Title>

            {/* Summary Card */}
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }} mb="md">
                <Group mb="xs" gap="sm">
                    <TypeIcon size={24} style={{ color: 'var(--accent)' }} />
                    <Text fw={700} size="lg">{typeLabels[data.type] || data.type}</Text>
                    <Badge color={data.is_verified ? 'green' : 'orange'} variant="light">
                        {data.is_verified ? 'Verified' : 'Unverified'}
                    </Badge>
                </Group>
                <Group gap="xl" mt="sm" wrap="wrap">
                    <Box>
                        <Text size="xs" c="dimmed">User</Text>
                        <Text fw={600}>{data.user_info.username}</Text>
                    </Box>
                    <Box>
                        <Text size="xs" c="dimmed">Distance</Text>
                        <Text fw={600}>{(data.distance / 1000).toFixed(2)} km</Text>
                    </Box>
                    <Box>
                        <Text size="xs" c="dimmed">Start</Text>
                        <Text fw={600}>{new Date(data.start_time).toLocaleString()}</Text>
                    </Box>
                    {data.end_time && (
                        <Box>
                            <Text size="xs" c="dimmed">End</Text>
                            <Text fw={600}>{new Date(data.end_time).toLocaleString()}</Text>
                        </Box>
                    )}
                    {data.duration && (
                        <Box>
                            <Text size="xs" c="dimmed">Duration</Text>
                            <Text fw={600}>{data.duration}</Text>
                        </Box>
                    )}
                    <Box>
                        <Text size="xs" c="dimmed">Verification</Text>
                        <Badge color={scoreColor} variant="light">{scorePct}%</Badge>
                    </Box>
                </Group>
            </Card>

            {/* GPS Route Card */}
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }} mb="md">
                <Group mb="md">
                    <MapPin size={20} style={{ color: 'var(--accent)' }} />
                    <Text fw={700}>GPS Route</Text>
                    {routeStats && <Badge color="indigo" variant="light">{routeStats}</Badge>}
                </Group>
                <Box style={{
                    height: 300,
                    background: 'var(--surface-secondary)',
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                }}>
                    {routePointCount > 0 ? (
                        <>
                            <MapPin size={40} style={{ color: 'var(--accent)', opacity: 0.6 }} />
                            <Text c="dimmed" size="sm">
                                Route data available ({routePointCount.toLocaleString()} points)
                            </Text>
                            <Text c="dimmed" size="xs">First point: {firstCoord}</Text>
                        </>
                    ) : (
                        <>
                            <MapPin size={40} style={{ opacity: 0.3 }} />
                            <Text c="dimmed">No route data recorded</Text>
                        </>
                    )}
                </Box>
            </Card>

            {/* Anti-Cheat Results Card */}
            <Card style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
                <Group mb="md">
                    <ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
                    <Text fw={700}>Anti-Cheat Results</Text>
                </Group>
                <Stack gap="sm">
                    <Group gap="sm">
                        <Badge color={scoreColor} variant="light" size="lg">
                            Overall Score: {scorePct}%
                        </Badge>
                        <Badge color={data.is_verified ? 'green' : 'orange'} variant="light" size="lg">
                            {data.is_verified ? 'Approved ✅' : 'Pending Review ⚠️'}
                        </Badge>
                    </Group>
                    {data.verification_score < 0.3 && !data.is_verified && (
                        <Alert color="red" variant="light" title="Low Confidence">
                            This activity has a very low verification score and may require manual review.
                        </Alert>
                    )}
                    {data.verification_score < 0.7 && data.verification_score >= 0.3 && !data.is_verified && (
                        <Text size="sm" c="dimmed">
                            Moderate confidence — activity is pending verification review.
                        </Text>
                    )}
                    {data.is_verified && data.verification_score >= 0.9 && (
                        <Text size="sm" c="dimmed">
                            High-confidence verified activity — no anomalies detected.
                        </Text>
                    )}
                </Stack>
            </Card>
        </Box>
    );
};
