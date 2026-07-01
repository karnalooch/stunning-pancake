import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert, Badge, Box, Button, Card, Group, SimpleGrid, Stack, Text, ThemeIcon,
} from '@mantine/core';
import {
    Activity, AlertTriangle, Bike, Map, RefreshCw, Route, StopCircle, Trash2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '../../../core/components/PageHeader';
import { useAuth } from '../../../core/auth/useAuth';
import { BatchProgressBar, WipeProgressBar } from '../../analytics/SimulationProgressBar';
import { SimulatorApi } from '../../../api/client';
import {
    useAbortBatch,
    useAbortGarmin,
    useAbortLive,
    useBatchStatus,
    useClearGarminSummary,
    useGarminStatus,
    useLiveStatus,
    useResetSimulator,
    useSimTarget,
    resolveWipeTarget,
} from '../api/queries';
import { startLiveWithRetry, waitForLiveRunning } from '../../../api/simulatorBatch';
import { fallbackLivePlan } from '../../analytics/simInfraPlanner';
import { LogViewer } from './LogViewer';
import { GarminSummaryTable } from './GarminSummaryTable';
import { WipeModal } from '../wipe/WipeModal';
import { useWipeHandlers } from '../wipe/useWipeHandlers';
import { extractStartConflictMessage } from '../utils/conflict';

function garminPhaseLabel(phase: string): string {
    const map: Record<string, string> = {
        creating_users: 'Creating users...',
        scheduling: 'Generating schedules...',
        dispatching: 'Dispatching rides...',
        scheduled: 'Scheduled — waiting for start times',
        riding: 'Rides in progress on live map',
        complete: 'Complete',
        error: 'Error',
        aborted: 'Aborted',
    };
    return map[phase] || phase;
}

export const SimulatorMonitor: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isGlobalOwner = user?.role === 'GLOBAL_OWNER';

    const { data: simTarget } = useSimTarget();
    const { data: batchStatus, refetch: refetchBatch } = useBatchStatus();
    const { data: liveStatus, refetch: refetchLive } = useLiveStatus(false);
    const { data: garminStatus, refetch: refetchGarmin } = useGarminStatus();

    const abortBatch = useAbortBatch();
    const abortLive = useAbortLive();
    const abortGarmin = useAbortGarmin();
    const resetSimulator = useResetSimulator();
    const clearGarminSummary = useClearGarminSummary();

    const wipeTarget = resolveWipeTarget(simTarget);
    const wipe = useWipeHandlers({
        wipeTarget,
        onWipeComplete: () => {
            void refetchBatch();
            void refetchLive();
            void refetchGarmin();
        },
    });

    useEffect(() => {
        void SimulatorApi.getWipeStatus(wipeTarget)
            .then((ws) => {
                if (SimulatorApi.isWipeActive(ws)) {
                    wipe.setWipeStatus(ws);
                    wipe.setWipeModalOpen(true);
                }
            })
            .catch(() => null);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only wipe recovery
    }, [wipeTarget]);

    const [startingLiveOnly, setStartingLiveOnly] = useState(false);
    const [lastLiveError, setLastLiveError] = useState<string | null>(null);

    const isBatchRunning = batchStatus?.running ?? false;
    const isLiveRunning = liveStatus?.running ?? false;
    const isGarminRunning = garminStatus?.running ?? false;
    const anyRunning = isBatchRunning || isLiveRunning || isGarminRunning;
    const isWipeActive = wipe.isWipeActive;
    const isStuck = !isWipeActive && Boolean(
        liveStatus?.stuck || batchStatus?.stuck || liveStatus?.error || batchStatus?.error
        || liveStatus?.live_lock_held || batchStatus?.batch_lock_held,
    );
    const hasOrphanedLive = !isLiveRunning && (
        (liveStatus?.pool_size ?? 0) > 0
        || (liveStatus?.currently_riding ?? 0) > 0
        || (liveStatus?.active_rides ?? 0) > 0
    );
    const warmingStuckOnMap = isLiveRunning
        && (liveStatus?.currently_riding ?? 0) === 0
        && (liveStatus?.ride_warming ?? 0) > 0;
    const showSimControls = anyRunning || isStuck || hasOrphanedLive;
    const batchCompleteReady = !isBatchRunning
        && (batchStatus?.current_phase || '').toLowerCase() === 'complete'
        && (batchStatus?.users_created ?? 0) > 0;

    const simLabReachable = Boolean(simTarget?.prod_local_writes)
        || simTarget?.mode === 'prod-local-sim'
        || simTarget?.mode !== 'sim-lab-proxy'
        || simTarget?.sim_lab_health?.reachable !== false;
    const canStartLiveOnly = batchCompleteReady && !isLiveRunning && simLabReachable;

    const statusBadge = useMemo(() => {
        if (isWipeActive) return { color: 'red', label: 'WIPING' };
        if (anyRunning) return { color: 'green', label: 'RUNNING' };
        if (isStuck) return { color: 'orange', label: 'STUCK' };
        return { color: 'gray', label: 'IDLE' };
    }, [isWipeActive, anyRunning, isStuck]);

    const refreshStatus = async () => {
        await Promise.all([refetchBatch(), refetchLive(), refetchGarmin()]);
    };

    const handleStop = async () => {
        try {
            await abortLive.mutateAsync();
            await abortBatch.mutateAsync();
            if (isGarminRunning) await abortGarmin.mutateAsync();
            await refreshStatus();
            notifications.show({
                title: 'Simulation Stopped',
                message: 'Locks cleared; Celery chain will drain.',
                color: 'blue',
            });
        } catch (err: unknown) {
            notifications.show({
                title: 'Stop failed',
                message: err instanceof Error ? err.message : 'Stop failed',
                color: 'red',
            });
        }
    };

    const handleForceReset = async () => {
        try {
            await resetSimulator.mutateAsync(wipeTarget);
            await refreshStatus();
            notifications.show({
                title: 'Simulator reset',
                message: 'Locks and running flags cleared.',
                color: 'teal',
            });
        } catch (err: unknown) {
            notifications.show({
                title: 'Reset failed',
                message: err instanceof Error ? err.message : 'Reset failed',
                color: 'red',
            });
        }
    };

    const handleStartLiveOnly = async () => {
        setStartingLiveOnly(true);
        setLastLiveError(null);
        const cyclists = batchStatus?.total_users || liveStatus?.total_users || 1000;
        const plan = fallbackLivePlan(cyclists, 29, 6);
        try {
            await startLiveWithRetry({
                pool_pct: plan.pool_pct,
                active_ratio: plan.active_ratio,
                cheat_ratio: plan.cheat_ratio,
                tick_seconds: plan.tick_seconds,
                scale_overrides: plan.scale_overrides,
            });
            await waitForLiveRunning({ timeoutMs: 20_000 });
            await refetchLive();
            notifications.show({ title: 'Live Simulation Started', color: 'teal' });
        } catch (err: unknown) {
            const msg = extractStartConflictMessage(err);
            setLastLiveError(msg);
            notifications.show({ title: 'Start Live Failed', message: msg, color: 'orange' });
        } finally {
            setStartingLiveOnly(false);
        }
    };

    return (
        <Box p="md">
            <PageHeader
                title="📡 Simulation Monitor"
                subtitle="Live status for batch, map telemetry, and Garmin Edge simulator"
            />

            <Group mb="md" justify="space-between">
                <Group gap="xs">
                    <Badge variant="light" color={statusBadge.color}>{statusBadge.label}</Badge>
                    {isBatchRunning && <Badge color="violet">Batch</Badge>}
                    {isLiveRunning && <Badge color="teal">Live</Badge>}
                    {isGarminRunning && <Badge color="cyan">Garmin</Badge>}
                </Group>
                <Group gap="xs">
                    <Button variant="light" size="xs" leftSection={<RefreshCw size={14} />} onClick={() => void refreshStatus()}>
                        Refresh
                    </Button>
                    <Button variant="light" size="xs" component={Link} to="/owner/analytics/simulator">
                        Back to Wizard
                    </Button>
                </Group>
            </Group>

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
                <Stack gap="md">
                    {(isBatchRunning || (batchStatus && batchStatus.progress_pct > 0 && batchStatus.progress_pct < 100)) && (
                        <BatchProgressBar
                            running={isBatchRunning}
                            progressPct={batchStatus?.progress_pct}
                            currentPhase={batchStatus?.current_phase}
                            usersCreated={batchStatus?.users_created}
                            targetUsers={batchStatus?.total_users}
                            activitiesCreated={batchStatus?.activities_created}
                            elapsedSeconds={batchStatus?.elapsed_seconds}
                            error={batchStatus?.error}
                        />
                    )}

                    {isGarminRunning && garminStatus && (
                        <Alert color="teal" title={garminPhaseLabel(garminStatus.phase)}>
                            {garminStatus.rides_done} / {garminStatus.total_rides} rides (
                            {garminStatus.progress_pct.toFixed(0)}%)
                        </Alert>
                    )}

                    {lastLiveError && !isLiveRunning && (
                        <Alert color="red" title="Live sim error">{lastLiveError}</Alert>
                    )}

                    {canStartLiveOnly && (
                        <Button
                            color="teal"
                            variant="light"
                            loading={startingLiveOnly}
                            onClick={() => void handleStartLiveOnly()}
                        >
                            Start Live Sim
                        </Button>
                    )}

                    {showSimControls && (
                        <Button color="red" variant="light" leftSection={<StopCircle size={16} />} onClick={() => void handleStop()}>
                            Stop Active Simulation
                        </Button>
                    )}

                    {isStuck && !anyRunning && (
                        <Button color="orange" variant="outline" leftSection={<RefreshCw size={16} />} onClick={() => void handleForceReset()}>
                            Reset simulator locks (stuck state)
                        </Button>
                    )}

                    <Button variant="light" color="cyan" component="a" href="#/owner/analytics/live-map" leftSection={<Map size={16} />}>
                        Open Live Maps
                    </Button>

                    {!anyRunning && isGlobalOwner && (
                        <Button color="red" variant="subtle" size="xs" leftSection={<Trash2 size={12} />} onClick={wipe.openWipeModal}>
                            Wipe Simulator DB Data
                        </Button>
                    )}
                </Stack>

                <Card withBorder radius="md" p="md">
                    <Group mb="md" justify="space-between">
                        <Group gap="xs">
                            <ThemeIcon size={24} radius="sm" color="teal" variant="light">
                                <Activity size={14} />
                            </ThemeIcon>
                            <Text fw={600} size="sm">Telemetry</Text>
                        </Group>
                        <Group gap={6}>
                            {isLiveRunning && (liveStatus?.ride_warming ?? 0) > 0 && (
                                <Badge variant="light" color="yellow">
                                    Warming {(liveStatus?.ride_warming ?? 0).toLocaleString()}
                                </Badge>
                            )}
                            {isLiveRunning && liveStatus?.tick_stale && (
                                <Badge variant="filled" color="red">Tick stalled</Badge>
                            )}
                            {isLiveRunning && (liveStatus?.ride_routing ?? 0) > 0 && (
                                <Badge variant="light" color="cyan">
                                    Routing {(liveStatus?.ride_routing ?? 0).toLocaleString()}
                                </Badge>
                            )}
                        </Group>
                    </Group>

                    {warmingStuckOnMap && (
                        <Alert color="orange" icon={<AlertTriangle size={16} />} mb="md" title="Warming bez riderów na mapie">
                            <Text size="xs">
                                {(liveStatus?.ride_warming ?? 0).toLocaleString()} przejazdów czeka na routing.
                            </Text>
                        </Alert>
                    )}

                    {(anyRunning || hasOrphanedLive) ? (
                        <SimpleGrid cols={2} spacing="xs" mb="md">
                            <Card withBorder padding="xs" bg="var(--surface-secondary)">
                                <Text size="2xs" c="dimmed">On map (ACTIVE)</Text>
                                <Text fw={700} size="lg" c="blue">
                                    {liveStatus?.currently_riding?.toLocaleString() ?? '0'}
                                </Text>
                            </Card>
                            <Card withBorder padding="xs" bg="var(--surface-secondary)">
                                <Text size="2xs" c="dimmed">Rides Completed</Text>
                                <Text fw={700} size="lg" c="green">
                                    {liveStatus?.total_completed?.toLocaleString() ?? '0'}
                                </Text>
                            </Card>
                            <Card withBorder padding="xs" bg="var(--surface-secondary)">
                                <Text size="2xs" c="dimmed">Cheaters Caught</Text>
                                <Text fw={700} size="lg" c="red">
                                    {liveStatus?.cheaters_caught?.toLocaleString() ?? '0'}
                                </Text>
                            </Card>
                            <Card withBorder padding="xs" bg="var(--surface-secondary)">
                                <Text size="2xs" c="dimmed">Routing queue</Text>
                                <Group gap={6} wrap="nowrap">
                                    <ThemeIcon size={20} variant="light" color="violet"><Route size={12} /></ThemeIcon>
                                    <Text fw={700} size="lg" ff="monospace">
                                        {liveStatus?.routing_queue_depth?.toLocaleString() ?? '0'}
                                    </Text>
                                </Group>
                            </Card>
                            <Card withBorder padding="xs" bg="var(--surface-secondary)">
                                <Text size="2xs" c="dimmed">Users Created</Text>
                                <Text fw={700} size="lg">{batchStatus?.users_created?.toLocaleString() ?? '—'}</Text>
                            </Card>
                            <Card withBorder padding="xs" bg="var(--surface-secondary)">
                                <Text size="2xs" c="dimmed">Garmin rides</Text>
                                <Group gap={4}>
                                    <Bike size={14} />
                                    <Text fw={700} size="lg">
                                        {garminStatus?.rides_done ?? 0}/{garminStatus?.total_rides ?? 0}
                                    </Text>
                                </Group>
                            </Card>
                        </SimpleGrid>
                    ) : isWipeActive ? (
                        <Box mb="md">
                            <WipeProgressBar
                                running
                                progressPct={wipe.wipeStatus?.progress_pct}
                                phase={wipe.wipeStatus?.phase}
                                phaseLabel={wipe.wipeStatus?.phase_label}
                                message={wipe.wipeStatus?.message}
                                tablesDone={wipe.wipeStatus?.tables_done}
                                tablesTotal={wipe.wipeStatus?.tables_total}
                                rowsDeleted={wipe.wipeStatus?.rows_deleted}
                                deleted={wipe.wipeStatus?.deleted}
                                startedAt={wipe.wipeStatus?.started_at ?? undefined}
                                stuck={wipe.wipeStatus?.stuck}
                                stuckReason={wipe.wipeStatus?.stuck_reason}
                            />
                        </Box>
                    ) : (
                        <Alert color="gray" icon={<Activity size={16} />} mb="md">
                            <Text size="xs">
                                No active simulation.{' '}
                                <Text
                                    span
                                    c="blue"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => navigate('/owner/analytics/simulator')}
                                >
                                    Open wizard
                                </Text>{' '}
                                to configure and launch.
                            </Text>
                        </Alert>
                    )}

                    <LogViewer
                        batchLog={batchStatus?.log}
                        liveLog={liveStatus?.log}
                        garminLog={garminStatus?.log}
                    />

                    <GarminSummaryTable
                        summary={garminStatus?.summary ?? []}
                        loading={clearGarminSummary.isPending}
                        onClear={() => void clearGarminSummary.mutateAsync()}
                    />
                </Card>
            </SimpleGrid>

            <WipeModal opened={wipe.wipeModalOpen} simTarget={simTarget} wipe={wipe} />
        </Box>
    );
};
