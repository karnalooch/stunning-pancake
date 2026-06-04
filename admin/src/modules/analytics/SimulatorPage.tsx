import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
    Box, Text, Card, Group, Stack, Slider, NumberInput, Button,
    Badge, ThemeIcon, SimpleGrid, Alert, ScrollArea, Checkbox,
    Modal, Divider, Stepper,
} from '@mantine/core';
import { BatchProgressBar, WipeProgressBar } from './SimulationProgressBar';
import { notifications } from '@mantine/notifications';
import {
    Play, StopCircle, Bike, Trash2, AlertTriangle,
    RefreshCw, Users, Map, Activity, Zap, Loader, CheckCircle2,
    AlertCircle, ArrowRight, ArrowLeft, ShieldCheck, Database, Route
} from 'lucide-react';
import { SimulatorApi, formatApiError, WipeStuckError, type WipeProgressStatus } from '../../api/client';
import { waitForBatchComplete } from '../../api/simulatorBatch';
import { PageHeader } from '../../core/components/PageHeader';
import { useAuth } from '../../core/auth/useAuth';
import { resolveSimProfile } from './simProfileMap';

interface LiveStatus {
    running: boolean; elapsed_seconds: number; error: string | null;
    stuck?: boolean; live_lock_held?: boolean; pool_size?: number; active_rides?: number;
    async_routing_enabled?: boolean;
    ride_warming?: number; ride_routing?: number; ride_routed?: number; ride_active?: number;
    routing_unroutable_total?: number;
    routing_queue_depth?: number;
    routing_backpressure_active?: boolean;
    dispatches_throttled?: boolean;
    max_routing_queue_depth?: number | null;
    total_users: number; active_ratio: number; cheat_ratio: number; tick_seconds: number;
    currently_riding: number; total_completed: number; cheaters_caught: number;
    log: [string, string][];
}

interface BatchStatus {
    running: boolean; elapsed_seconds: number; error: string | null;
    stuck?: boolean; batch_lock_held?: boolean;
    total_users: number; users_created: number; activities_created: number;
    current_phase: string; progress_pct: number;
    log: [string, string][];
}

const extractStartConflictMessage = (err: any): string => {
    const statusCode = err?.response?.status;
    const code = err?.response?.data?.code;
    if (statusCode === 409 && code === 'WIPE_IN_PROGRESS') {
        return 'Data wipe is running. Wait for wipe completion before starting simulation.';
    }
    return err?.response?.data?.error || err?.message || 'Start request failed';
};

export const SimulatorPage: React.FC = () => {
    const { user } = useAuth();
    const isGlobalOwner = user?.role === 'GLOBAL_OWNER';
    const [activeStep, setActiveStep] = useState(0);

    const [cyclists, setCyclists] = useState<number>(1000);
    const [generateActivities, setGenerateActivities] = useState(true);
    const [poolIntensity, setPoolIntensity] = useState(50);
    const [systemLoad, setSystemLoad] = useState(50);
    const [liveEnabled, setLiveEnabled] = useState(true);

    const simProfile = useMemo(
        () => resolveSimProfile(poolIntensity, systemLoad),
        [poolIntensity, systemLoad],
    );
    const { active_ratio: activeRatio, cheat_ratio: cheatRatio, tick_seconds: tickSeconds, scale_overrides: scaleOverrides } = simProfile;

    const [launching, setLaunching] = useState(false);
    const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
    const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);

    const [wipeModalOpen, setWipeModalOpen] = useState(false);
    const [wipeConfirmPhrase, setWipeConfirmPhrase] = useState('');
    const [wipeMfaAck, setWipeMfaAck] = useState(false);
    const [wiping, setWiping] = useState(false);
    const [wipeStatus, setWipeStatus] = useState<WipeProgressStatus | null>(null);
    const [scaleReport, setScaleReport] = useState<any | null>(null);
    const [preflightLoading, setPreflightLoading] = useState(false);

    const environmentLabel = useMemo(
        () => (import.meta.env.DEV ? 'DEVELOPMENT' : 'PRODUCTION'),
        [],
    );

    const requiredWipePhrase = useMemo(
        () => `DELETE ALL DATA — ${environmentLabel} — GLOBAL_OWNER`,
        [environmentLabel],
    );

    const batchPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const livePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    const isBatchRunning = batchStatus?.running ?? false;
    const isLiveRunning = liveStatus?.running ?? false;
    const anyRunning = isBatchRunning || isLiveRunning;
    const isWipeActive = wiping || SimulatorApi.isWipeActive(wipeStatus);
    const isWipeBlocked = wiping || SimulatorApi.isWipeBlocked(wipeStatus);
    const isWipeStuck = Boolean(wipeStatus?.stuck) && !wiping;
    const isStuck = !isWipeActive && Boolean(
        liveStatus?.stuck || batchStatus?.stuck || liveStatus?.error || batchStatus?.error
        || liveStatus?.live_lock_held || batchStatus?.batch_lock_held
    );
    const hasOrphanedLive = !isLiveRunning && (
        (liveStatus?.pool_size ?? 0) > 0 || (liveStatus?.currently_riding ?? 0) > 0
        || (liveStatus?.active_rides ?? 0) > 0
    );
    const showSimControls = anyRunning || isStuck || hasOrphanedLive;
    const showBatchProgress = launching || isBatchRunning || (batchStatus && batchStatus.progress_pct > 0 && batchStatus.progress_pct < 100);

    const rawActive = Math.round(cyclists * activeRatio);
    const activeRiders = rawActive;
    const cheaters = Math.round(activeRiders * cheatRatio);
    const estActivities = generateActivities ? Math.round(cyclists * 2) : 0;
    const FORCE_SKIP_ACTIVITIES_ABOVE = 150_000;

    useEffect(() => {
        if (cyclists >= FORCE_SKIP_ACTIVITIES_ABOVE && generateActivities) {
            setGenerateActivities(false);
        }
    }, [cyclists, generateActivities]);

    const runPreflight = async () => {
        setPreflightLoading(true);
        try {
            const report = await SimulatorApi.getScalePreflight({
                target_users: cyclists,
                active_ratio: activeRatio,
                skip_activities: !generateActivities,
            });
            setScaleReport(report);
        } catch (err: any) {
            notifications.show({ title: 'Preflight failed', message: err?.message || 'Error', color: 'red' });
        }
        setPreflightLoading(false);
    };

    const applyScale300k = () => {
        setCyclists(300_000);
        setGenerateActivities(false);
        setPoolIntensity(25);
        setSystemLoad(15);
        setScaleReport(null);
    };

    /** ~150 starts/tick + szybszy ramp ACTIVE (wymaga deploy railway.json turbo). */
    const applyTurboMapRamp = () => {
        setPoolIntensity(100);
        setSystemLoad(100);
        setScaleReport(null);
    };

    const startPolling = useCallback(() => {
        if (batchPollRef.current) clearInterval(batchPollRef.current);
        if (livePollRef.current) clearInterval(livePollRef.current);

        batchPollRef.current = setInterval(async () => {
            try { const d = await SimulatorApi.getBatchStatus({ silent: true }); setBatchStatus(d); } catch {}
        }, 2000);
        livePollRef.current = setInterval(async () => {
            try { const d = await SimulatorApi.getLiveStatus({ silent: true }); setLiveStatus(d); } catch {}
        }, 1500);
    }, []);

    useEffect(() => {
        (async () => {
            const [bs, ls, ws] = await Promise.all([
                SimulatorApi.getBatchStatus().catch(() => null),
                SimulatorApi.getLiveStatus().catch(() => null),
                SimulatorApi.getWipeStatus().catch(() => null),
            ]);
            setBatchStatus(bs);
            setLiveStatus(ls);
            if (ws && SimulatorApi.isWipeActive(ws)) {
                setWipeStatus(ws);
                setWiping(SimulatorApi.isWipeBlocked(ws));
                setWipeModalOpen(true);
            }
            if (bs?.running || ls?.running || bs?.stuck || ls?.stuck || ls?.live_lock_held) {
                setActiveStep(2); // Jump straight to running/monitoring if already active
            }
        })();
        startPolling();
        return () => {
            if (batchPollRef.current) clearInterval(batchPollRef.current);
            if (livePollRef.current) clearInterval(livePollRef.current);
        };
    }, [startPolling]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [batchStatus?.log, liveStatus?.log]);

    const handleLaunch = async () => {
        setLaunching(true);
        setActiveStep(2);
        try {
            await SimulatorApi.startBatch({
                total_users: cyclists,
                days: 7,
                clear: true,
                skip_activities: !generateActivities,
                scale_overrides: liveEnabled ? scaleOverrides : undefined,
            });
            notifications.show({ title: 'Generowanie…', message: `Tworzenie ${cyclists.toLocaleString()} użytkowników — postęp poniżej.`, color: 'yellow' });

            await waitForBatchComplete({ onStatus: setBatchStatus });
            notifications.show({ title: 'Cyclists Created', message: `${cyclists.toLocaleString()} users generated`, color: 'green' });
        } catch (err: any) {
            notifications.show({ title: 'Generation Error', message: extractStartConflictMessage(err), color: 'red' });
            setLaunching(false);
            return;
        }
        setLaunching(false);

        if (liveEnabled) {
            try {
                await SimulatorApi.startLive({
                    pool_pct: 1.0,
                    intensity: poolIntensity,
                    load: systemLoad,
                    active_ratio: activeRatio,
                    cheat_ratio: cheatRatio,
                    tick_seconds: tickSeconds,
                    scale_overrides: scaleOverrides,
                });
                notifications.show({ title: 'Live Simulation Started', message: `${activeRiders.toLocaleString()} visible on map`, color: 'teal' });
            } catch (err: any) {
                notifications.show({ title: 'Live Sim Error', message: extractStartConflictMessage(err), color: 'orange' });
            }
        }
        startPolling();
    };

    const refreshStatus = async () => {
        const [bs, ls] = await Promise.all([
            SimulatorApi.getBatchStatus().catch(() => null),
            SimulatorApi.getLiveStatus().catch(() => null),
        ]);
        setBatchStatus(bs);
        setLiveStatus(ls);
    };

    const handleStop = async () => {
        try {
            await SimulatorApi.abortLive();
            await SimulatorApi.abortBatch();
            await refreshStatus();
            notifications.show({ title: 'Simulation Stopped', message: 'Locks cleared; Celery chain will drain.', color: 'blue' });
        } catch (err: any) {
            notifications.show({ title: 'Stop failed', message: err?.response?.data?.error || err.message, color: 'red' });
        }
    };

    const handleForceReset = async () => {
        try {
            await SimulatorApi.resetSimulator();
            await refreshStatus();
            notifications.show({ title: 'Simulator reset', message: 'Locks and running flags cleared.', color: 'teal' });
        } catch (err: any) {
            notifications.show({ title: 'Reset failed', message: err?.response?.data?.error || err.message, color: 'red' });
        }
    };

    const handleWipe = async () => {
        setWiping(true);
        setWipeStatus({ running: true, phase: 'queued', progress_pct: 0, message: 'Starting wipe…' });
        try {
            const result = await SimulatorApi.wipeData(
                (s) => setWipeStatus(s),
                {
                    confirmPhrase: wipeConfirmPhrase,
                    mfaConfirmed: wipeMfaAck,
                },
            );
            setBatchStatus(null);
            setLiveStatus(null);
            setWipeStatus(result);
            setWipeModalOpen(false);
            setWipeConfirmPhrase('');
            setWipeMfaAck(false);
            setActiveStep(0);
            await refreshStatus();
            const warn = result?.warning;
            notifications.show({
                title: 'Wipe Complete',
                message: warn || 'All simulation and activity data has been wiped.',
                color: warn ? 'yellow' : 'green',
            });
        } catch (err: unknown) {
            if (err instanceof WipeStuckError) {
                setWipeStatus(err.status);
                notifications.show({
                    title: 'Wipe stuck',
                    message: err.message,
                    color: 'orange',
                });
            } else {
                notifications.show({
                    title: 'Wipe failed',
                    message: formatApiError(err, 'Wipe failed'),
                    color: 'red',
                });
            }
        } finally {
            setWiping(false);
        }
    };

    const handleWipeRecover = async () => {
        setWiping(true);
        try {
            const restarted = await SimulatorApi.recoverStuckWipe({
                confirmPhrase: wipeConfirmPhrase,
                mfaConfirmed: wipeMfaAck,
            });
            setWipeStatus(restarted);
            notifications.show({
                title: 'Wipe restarted',
                message: 'Simulator reset and wipe force-restarted.',
                color: 'blue',
            });
            const result = await SimulatorApi.wipeData(
                (s) => setWipeStatus(s),
                {
                    confirmPhrase: wipeConfirmPhrase,
                    mfaConfirmed: wipeMfaAck,
                },
            );
            setWipeStatus(result);
            setWipeModalOpen(false);
            setWipeConfirmPhrase('');
            setWipeMfaAck(false);
            notifications.show({
                title: 'Wipe Complete',
                message: result?.warning || 'All simulation and activity data has been wiped.',
                color: result?.warning ? 'yellow' : 'green',
            });
        } catch (err: unknown) {
            if (err instanceof WipeStuckError) {
                setWipeStatus(err.status);
            }
            notifications.show({
                title: 'Recovery failed',
                message: formatApiError(err, 'Could not recover stuck wipe.'),
                color: 'red',
            });
        } finally {
            setWiping(false);
        }
    };

    const handleWipeUnstick = async () => {
        try {
            const cleared = await SimulatorApi.forceUnstickWipe();
            setWipeStatus(cleared);
            setWiping(false);
            notifications.show({
                title: 'Wipe cleared',
                message: 'Locks cleared. You can close this dialog or retry wipe.',
                color: 'teal',
            });
        } catch (err: unknown) {
            notifications.show({
                title: 'Unstick failed',
                message: formatApiError(err, 'Could not clear wipe locks.'),
                color: 'red',
            });
        }
    };

    return (
        <Box p="md">
            <PageHeader title="🚴 Cycling Simulator" subtitle="Interactive step-by-step wizard to configure, generate, and monitor live cyclists" />

            <Card withBorder radius="md" p="xl" mb="md">
                <Stepper active={activeStep} onStepClick={anyRunning ? undefined : setActiveStep} breakpoint="sm" allowNextStepsSelect={false}>
                    {/* STEP 1: POPULATION CONFIG */}
                    <Stepper.Step label="Step 1" description="Configure Cyclists" icon={<Users size={16} />}>
                        <Stack gap="lg" mt="xl" style={{ maxWidth: 600 }}>
                            <Alert color="indigo" icon={<Users size={18} />} title="Cycling Population Setup">
                                <Text size="sm">Choose how many cyclists should exist in your Smart City database. These users will be dynamically generated across various municipalities.</Text>
                            </Alert>

                            <Group gap="xs">
                                <Button variant="light" size="xs" onClick={applyScale300k}>Preset: 300k (bez aktywności)</Button>
                                <Button variant="light" size="xs" loading={preflightLoading} onClick={runPreflight}>
                                    Analiza ryzyka
                                </Button>
                            </Group>

                            <NumberInput
                                label="Number of Cyclists to Generate"
                                description="Do 350k — przy >150k aktywności historyczne są wyłączane automatycznie"
                                value={cyclists}
                                onChange={(v) => setCyclists(Number(v) || 100)}
                                min={10} max={350000} step={1000}
                                leftSection={<Bike size={16} />}
                                size="md"
                            />

                            {scaleReport && (
                                <Alert color="orange" icon={<AlertTriangle size={18} />} title="Scale preflight">
                                    <Text size="sm" mb="xs">
                                        Pula: {scaleReport.target_users?.toLocaleString()} · jednocześnie na mapie max{' '}
                                        {scaleReport.estimated_concurrent_riders?.toLocaleString()}
                                    </Text>
                                    {scaleReport.batch_plan && (
                                        <Text size="sm" mb="xs" c="dimmed">
                                            Batch: {scaleReport.batch_plan.num_cities} miast ×{' '}
                                            {scaleReport.batch_plan.users_per_city?.toLocaleString()} użytk./miasto · bulk{' '}
                                            {scaleReport.batch_plan.user_bulk_batch_size?.toLocaleString()} · parallel≤
                                            {scaleReport.batch_plan.max_parallel_workers} · {scaleReport.estimated_batch_label}
                                        </Text>
                                    )}
                                    <Stack gap={4}>
                                        {(scaleReport.risks || []).filter((r: any) => r.severity !== 'resolved').slice(0, 5).map((r: any, i: number) => (
                                            <Text key={i} size="xs">[{r.severity}] {r.title}: {r.detail}</Text>
                                        ))}
                                    </Stack>
                                </Alert>
                            )}

                            <Checkbox
                                label="Generate historical GPS-tracked activities"
                                description="Populates the database with realistic completed rides of varying coordinates"
                                checked={generateActivities}
                                onChange={(e) => setGenerateActivities(e.currentTarget.checked)}
                                size="md"
                            />

                            <Group justify="flex-end" mt="xl">
                                <Button size="md" color="violet" rightSection={<ArrowRight size={16} />} onClick={() => setActiveStep(1)}>
                                    Next: Live Telemetry Tuning
                                </Button>
                            </Group>
                        </Stack>
                    </Stepper.Step>

                    {/* STEP 2: TELEMETRY TUNING */}
                    <Stepper.Step label="Step 2" description="Live Telemetry Tuning" icon={<Zap size={16} />}>
                        <Stack gap="lg" mt="xl" style={{ maxWidth: 600 }}>
                            <Alert color="teal" icon={<Zap size={18} />} title="Real-Time Telemetry Settings">
                                <Text size="sm">Configure how kolarze should behave on the active live map. You can simulate cheat ratios (impossible routes/speeds) and define tick telemetry intervals.</Text>
                            </Alert>

                            <Checkbox
                                label="Enable live ride simulation"
                                description="Cyclists will ride in real-time, sending bulk coordinates on a periodic interval"
                                checked={liveEnabled}
                                onChange={(e) => setLiveEnabled(e.currentTarget.checked)}
                                size="md"
                            />

                            {liveEnabled && (
                                <Stack gap="md" mt="xs">
                                    {liveStatus?.routing_backpressure_active && (
                                        <Alert color="red" icon={<AlertTriangle size={16} />} title="Backpressure routing">
                                            <Text size="xs">
                                                Kolejka routingu jest pełna — obniż „Aktywność puli” lub „Obciążenie systemu”, albo poczekaj na opróżnienie kolejki.
                                                Przy włączonym SIM_AUTO_LOWER_ACTIVE_RATIO_ON_BP backend może sam obniżyć active_ratio.
                                            </Text>
                                        </Alert>
                                    )}

                                    <Box>
                                        <Text size="sm" fw={600} mb={4}>Aktywność puli: {poolIntensity}</Text>
                                        <Text size="xs" c="dimmed" mb="md">
                                            active_ratio {(activeRatio * 100).toFixed(0)}% · cheat {(cheatRatio * 100).toFixed(0)}% ·
                                            ~{activeRiders.toLocaleString()} aktywnych (~{cheaters.toLocaleString()} cheaterów)
                                        </Text>
                                        <Slider
                                            value={poolIntensity}
                                            onChange={setPoolIntensity}
                                            min={0}
                                            max={100}
                                            step={1}
                                            marks={[
                                                { value: 0, label: '8%' },
                                                { value: 50, label: '29%' },
                                                { value: 100, label: '50%' },
                                            ]}
                                        />
                                    </Box>

                                    <Box mt="md">
                                        <Text size="sm" fw={600} mb={4}>Obciążenie systemu: {systemLoad}</Text>
                                        <Text size="xs" c="dimmed" mb="md">
                                            tick {tickSeconds}s · starts {scaleOverrides.max_starts_per_live_tick}/tick ·
                                            BRouter {scaleOverrides.brouter_max_calls_per_tick}/tick ·
                                            próby {scaleOverrides.brouter_route_attempts}
                                        </Text>
                                        <Slider
                                            value={systemLoad}
                                            onChange={setSystemLoad}
                                            min={0}
                                            max={100}
                                            step={1}
                                            marks={[
                                                { value: 0, label: 'Eco' },
                                                { value: 50, label: 'Balanced' },
                                                { value: 75, label: '100/s' },
                                                { value: 100, label: '150/s' },
                                            ]}
                                        />
                                    </Box>

                                    <Group gap="xs">
                                        <Button variant="light" size="xs" color="teal" onClick={applyTurboMapRamp}>
                                            Preset: Turbo map (150 warm / tick)
                                        </Button>
                                    </Group>
                                    <Alert color="yellow" variant="light" icon={<AlertTriangle size={16} />}>
                                        <Text size="xs">
                                            Load 75≈100 starts/tick, 100≈150. ACTIVE na mapie zależy od routingu (3× worker).
                                            Przy dużym warming obniż load lub poczekaj na drain kolejki.
                                        </Text>
                                    </Alert>
                                </Stack>
                            )}

                            <Group justify="space-between" mt="xl">
                                <Button variant="light" size="md" color="gray" leftSection={<ArrowLeft size={16} />} onClick={() => setActiveStep(0)}>
                                    Back
                                </Button>
                                <Button size="md" color="violet" rightSection={<ArrowRight size={16} />} onClick={() => setActiveStep(2)}>
                                    Next: Review & Launch
                                </Button>
                            </Group>
                        </Stack>
                    </Stepper.Step>

                    {/* STEP 3: EXECUTION & MONITORING */}
                    <Stepper.Step label="Step 3" description="Review & Monitor" icon={<Activity size={16} />}>
                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" mt="xl">
                            {/* Summary & Trigger */}
                            <Stack gap="lg">
                                <Alert color="indigo" icon={<Database size={18} />} title="Simulation Configuration Summary">
                                    <Stack gap="xs" mt="xs">
                                        <Text size="sm">• Total Cyclists: <b>{cyclists.toLocaleString()}</b></Text>
                                        <Text size="sm">• Historical Activities: <b>{estActivities.toLocaleString()}</b></Text>
                                        <Text size="sm">• Live Ride Simulation: <b>{liveEnabled ? 'Enabled' : 'Disabled'}</b></Text>
                                        {liveEnabled && (
                                            <>
                                                <Text size="sm">• Profil: <b>aktywność {poolIntensity}</b> · <b>obciążenie {systemLoad}</b></Text>
                                                <Text size="sm" c="blue">• Live pool: <b>~{activeRiders.toLocaleString()} ({(activeRatio * 100).toFixed(0)}% active_ratio)</b></Text>
                                                <Text size="sm" c="red">• Cheaters: <b>~{cheaters.toLocaleString()} ({(cheatRatio * 100).toFixed(0)}%)</b></Text>
                                                <Text size="sm">• Tick: <b>{tickSeconds}s</b> · starts <b>{scaleOverrides.max_starts_per_live_tick}</b> · BRouter <b>{scaleOverrides.brouter_max_calls_per_tick}</b> · próby <b>{scaleOverrides.brouter_route_attempts}</b></Text>
                                            </>
                                        )}
                                    </Stack>
                                </Alert>

                                {showBatchProgress && (
                                    <BatchProgressBar
                                        running={isBatchRunning || launching}
                                        progressPct={batchStatus?.progress_pct ?? (launching ? 2 : 0)}
                                        currentPhase={batchStatus?.current_phase}
                                        usersCreated={batchStatus?.users_created}
                                        targetUsers={batchStatus?.total_users || cyclists}
                                        activitiesCreated={batchStatus?.activities_created}
                                        elapsedSeconds={batchStatus?.elapsed_seconds}
                                        error={batchStatus?.error}
                                    />
                                )}

                                <Stack gap="md">
                                    <Button size="lg" color="violet" fullWidth
                                        leftSection={anyRunning ? <Loader className="animate-spin" size={18} /> : <Play size={18} />}
                                        loading={launching} disabled={anyRunning}
                                        onClick={handleLaunch}>
                                        {launching ? 'Creating Cyclists & Rides...' : `Launch ${cyclists.toLocaleString()} Cyclists`}
                                    </Button>

                                    {showSimControls && (
                                        <Button size="md" color="red" variant="light" fullWidth
                                            leftSection={<StopCircle size={16} />} onClick={handleStop}>
                                            Stop Active Simulation
                                        </Button>
                                    )}
                                    {isStuck && !anyRunning && (
                                        <Button size="md" color="orange" variant="outline" fullWidth
                                            leftSection={<RefreshCw size={16} />} onClick={handleForceReset}>
                                            Reset simulator locks (stuck state)
                                        </Button>
                                    )}

                                    {!anyRunning && (
                                        <Button variant="light" size="md" color="gray" leftSection={<ArrowLeft size={16} />} onClick={() => setActiveStep(1)}>
                                            Back & Change Settings
                                        </Button>
                                    )}

                                    <Button variant="light" color="cyan" size="md" fullWidth
                                        leftSection={<Map size={16} />}
                                        component="a" href="#/owner/analytics/live-map">
                                        Open Live Maps
                                    </Button>
                                </Stack>
                            </Stack>

                            {/* Live Monitors & Logs */}
                            <Card withBorder radius="md" p="md">
                                <Group mb="md" justify="space-between">
                                    <Group gap="xs">
                                        <ThemeIcon size={24} radius="sm" color="teal" variant="light"><Activity size={14} /></ThemeIcon>
                                        <Text fw={600} size="sm">Live Telemetry Monitor</Text>
                                    </Group>
                                    <Group gap={6}>
                                        <Badge variant="light" color={isWipeActive ? 'red' : anyRunning ? 'green' : isStuck ? 'orange' : 'gray'}>
                                            {isWipeActive ? 'WIPING' : anyRunning ? 'RUNNING' : isStuck ? 'STUCK' : 'IDLE'}
                                        </Badge>
                                        {isLiveRunning && (liveStatus?.ride_warming ?? 0) > 0 && (
                                            <Badge variant="light" color="yellow" title="PENDING_ROUTE + ROUTING">
                                                Warming {(liveStatus?.ride_warming ?? 0).toLocaleString()}
                                            </Badge>
                                        )}
                                        {isLiveRunning && (liveStatus?.ride_routing ?? 0) > 0 && (
                                            <Badge variant="light" color="cyan" title="BRouter on routing queue">
                                                Routing {(liveStatus?.ride_routing ?? 0).toLocaleString()}
                                            </Badge>
                                        )}
                                        {isLiveRunning && (liveStatus?.ride_routed ?? 0) > 0 && (
                                            <Badge variant="light" color="violet" title="Routed, waiting for start_time">
                                                Queued {(liveStatus?.ride_routed ?? 0).toLocaleString()}
                                            </Badge>
                                        )}
                                    </Group>
                                </Group>

                                {isBatchRunning && (
                                    <BatchProgressBar
                                        running
                                        progressPct={batchStatus?.progress_pct}
                                        currentPhase={batchStatus?.current_phase}
                                        usersCreated={batchStatus?.users_created}
                                        targetUsers={batchStatus?.total_users || cyclists}
                                        activitiesCreated={batchStatus?.activities_created}
                                        elapsedSeconds={batchStatus?.elapsed_seconds}
                                        error={batchStatus?.error}
                                    />
                                )}

                                {(anyRunning || hasOrphanedLive) ? (
                                    <SimpleGrid cols={2} spacing="xs" mb="md">
                                        <Card withBorder padding="xs" bg="var(--surface-secondary)">
                                            <Text size="2xs" c="dimmed">On map (ACTIVE)</Text>
                                            <Text fw={700} size="lg" c="blue">{liveStatus?.currently_riding?.toLocaleString() ?? '0'}</Text>
                                            {(liveStatus?.ride_warming ?? 0) > 0 && (
                                                <Text size="2xs" c="yellow.7">+{(liveStatus?.ride_warming ?? 0).toLocaleString()} warming</Text>
                                            )}
                                        </Card>
                                        <Card withBorder padding="xs" bg="var(--surface-secondary)">
                                            <Text size="2xs" c="dimmed">Rides Completed</Text>
                                            <Text fw={700} size="lg" c="green">{liveStatus?.total_completed?.toLocaleString() ?? '0'}</Text>
                                        </Card>
                                        <Card withBorder padding="xs" bg="var(--surface-secondary)">
                                            <Text size="2xs" c="dimmed">Cheaters Caught</Text>
                                            <Text fw={700} size="lg" c="red">{liveStatus?.cheaters_caught?.toLocaleString() ?? '0'}</Text>
                                        </Card>
                                        <Card withBorder padding="xs" bg="var(--surface-secondary)">
                                            <Text size="2xs" c="dimmed">Routing queue</Text>
                                            <Group gap={6} wrap="nowrap">
                                                <ThemeIcon size={20} variant="light" color="violet"><Route size={12} /></ThemeIcon>
                                                <Text fw={700} size="lg" ff="monospace">
                                                    {liveStatus?.routing_queue_depth?.toLocaleString() ?? '0'}
                                                </Text>
                                                {liveStatus?.routing_backpressure_active && (
                                                    <Badge size="xs" color="red" variant="filled">Backpressure</Badge>
                                                )}
                                                {liveStatus?.dispatches_throttled && !liveStatus?.routing_backpressure_active && (
                                                    <Badge size="xs" color="yellow" variant="light">Throttled</Badge>
                                                )}
                                            </Group>
                                        </Card>
                                        <Card withBorder padding="xs" bg="var(--surface-secondary)">
                                            <Text size="2xs" c="dimmed">Users Created</Text>
                                            <Text fw={700} size="lg">{batchStatus?.users_created?.toLocaleString() ?? '—'}</Text>
                                        </Card>
                                    </SimpleGrid>
                                ) : isWipeActive ? (
                                    <Box mb="md">
                                        <WipeProgressBar
                                            running
                                            progressPct={wipeStatus?.progress_pct}
                                            phase={wipeStatus?.phase}
                                            phaseLabel={wipeStatus?.phase_label}
                                            message={wipeStatus?.message}
                                            tablesDone={wipeStatus?.tables_done}
                                            tablesTotal={wipeStatus?.tables_total}
                                            rowsDeleted={wipeStatus?.rows_deleted}
                                            deleted={wipeStatus?.deleted}
                                            startedAt={wipeStatus?.started_at ?? undefined}
                                            stuck={wipeStatus?.stuck}
                                            stuckReason={wipeStatus?.stuck_reason}
                                        />
                                    </Box>
                                ) : isStuck ? (
                                    <Alert color="orange" icon={<AlertTriangle size={16} />} mb="md">
                                        <Text size="xs">
                                            Simulator lock or pool still active while status is idle.
                                            Use Stop or Reset simulator locks, then Wipe if needed.
                                        </Text>
                                    </Alert>
                                ) : (
                                    <Alert color="gray" icon={<Activity size={16} />} mb="md">
                                        <Text size="xs">Ready to start. Click "Launch" on the left to begin the simulation cycle.</Text>
                                    </Alert>
                                )}

                                {/* Logs Scroll Area */}
                                {((batchStatus?.log?.length ?? 0) > 0 || (liveStatus?.log?.length ?? 0) > 0) && (
                                    <ScrollArea h={180} style={{
                                        background: '#0d1117', borderRadius: 8, padding: 12,
                                        fontFamily: 'monospace',
                                    }}>
                                        {batchStatus?.log?.map(([ts, msg], i) => (
                                            <Text key={`b-${i}`} size="2xs"
                                                style={{ color: msg.includes('ERROR') ? '#f85149' : '#58a6ff', lineHeight: 1.5 }}>
                                                <Text span c="dimmed" size="2xs">[{ts}]</Text> {msg}
                                            </Text>
                                        ))}
                                        {liveStatus?.log?.map(([ts, msg], i) => {
                                            const lower = msg.toLowerCase();
                                            const isUnroutableWarning =
                                                lower.includes('unroutable start')
                                                || lower.includes('road-only mode: skipped')
                                                || lower.includes('pass=0')
                                                || lower.includes('target island');
                                            const color = msg.includes('ERROR')
                                                ? '#f85149'
                                                : isUnroutableWarning
                                                    ? '#d29922'
                                                    : '#8b949e';
                                            return (
                                                <Text key={`l-${i}`} size="2xs"
                                                    style={{ color, lineHeight: 1.5 }}>
                                                    <Text span c="dimmed" size="2xs">[L {ts}]</Text> {msg}
                                                </Text>
                                            );
                                        })}
                                        <div ref={logEndRef} />
                                    </ScrollArea>
                                )}

                                {/* Wipe Data (Danger Zone) */}
                                {!anyRunning && isGlobalOwner && (
                                    <Button color="red" variant="subtle" size="xs" fullWidth mt="md"
                                        leftSection={<Trash2 size={12} />}
                                        onClick={() => setWipeModalOpen(true)}>
                                        Wipe Simulator DB Data
                                    </Button>
                                )}
                                {isStuck && anyRunning && (
                                    <Text size="2xs" c="dimmed" mt="xs" ta="center">
                                        If Stop does not help, use Reset simulator locks above.
                                    </Text>
                                )}
                            </Card>
                        </SimpleGrid>
                    </Stepper.Step>
                </Stepper>
            </Card>

            <Modal
                opened={wipeModalOpen}
                onClose={() => {
                    if (isWipeBlocked) return;
                    setWipeModalOpen(false);
                    setWipeConfirmPhrase('');
                    setWipeMfaAck(false);
                }}
                closeOnClickOutside={!isWipeBlocked}
                closeOnEscape={!isWipeBlocked}
                title={<Text fw={700} c="red">⚠️ Wipe All Data</Text>} centered>
                <Stack gap="md">
                    <Text size="sm" c="dimmed">
                        Stop 1/2: Type the exact phrase (role + environment).
                    </Text>
                    <Text size="sm">
                        Type <b>exactly</b>:
                        <span style={{ fontFamily: 'monospace' }}> &quot;{requiredWipePhrase}&quot;</span>
                    </Text>
                    <input type="text" value={wipeConfirmPhrase}
                        onChange={(e) => setWipeConfirmPhrase(e.target.value)}
                        placeholder={requiredWipePhrase}
                        style={{
                            padding: '8px 12px', border: '1px solid var(--mantine-color-red-6)',
                            borderRadius: 8, background: 'var(--surface-secondary)',
                            color: 'var(--text-primary)', fontSize: 14, width: '100%',
                            fontFamily: 'monospace',
                        }} />
                    <Checkbox
                        checked={wipeMfaAck}
                        onChange={(e) => setWipeMfaAck(e.currentTarget.checked)}
                        label="Stop 2/2: I confirm (MFA-like checkbox) that I understand the consequences."
                    />
                    {(isWipeActive || wipeStatus) && (
                        <WipeProgressBar
                            running={SimulatorApi.isWipeBlocked(wipeStatus) || wiping}
                            progressPct={wipeStatus?.progress_pct ?? 0}
                            phase={wipeStatus?.phase}
                            phaseLabel={wipeStatus?.phase_label}
                            message={wipeStatus?.message}
                            tablesDone={wipeStatus?.tables_done}
                            tablesTotal={wipeStatus?.tables_total}
                            rowsDeleted={wipeStatus?.rows_deleted}
                            deleted={wipeStatus?.deleted}
                            startedAt={wipeStatus?.started_at ?? undefined}
                            error={wipeStatus?.error ?? undefined}
                            stuck={wipeStatus?.stuck || isWipeStuck}
                            stuckReason={wipeStatus?.stuck_reason}
                        />
                    )}
                    {(wipeStatus?.stuck || isWipeStuck) && !isWipeBlocked && (
                        <Group grow>
                            <Button color="orange" variant="light" onClick={handleWipeRecover} loading={wiping}>
                                Reset and retry
                            </Button>
                            <Button color="gray" variant="outline" onClick={handleWipeUnstick} disabled={wiping}>
                                Clear locks only
                            </Button>
                        </Group>
                    )}
                    <Button color="red" fullWidth loading={isWipeBlocked}
                        disabled={isWipeBlocked || wipeConfirmPhrase !== requiredWipePhrase || !wipeMfaAck} onClick={handleWipe}>
                        {isWipeBlocked
                            ? `Wiping… ${(wipeStatus?.progress_pct ?? 0).toFixed(0)}%`
                            : 'Yes, Delete Everything'}
                    </Button>
                </Stack>
            </Modal>
        </Box>
    );
};
