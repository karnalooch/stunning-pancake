import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box, Text, Card, Group, Stack, Slider, NumberInput, Button,
    Badge, ThemeIcon, SimpleGrid, Alert, ScrollArea, Stepper,
    Modal, Checkbox, Progress,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
    Play, Settings, Activity, Loader, CheckCircle2,
    AlertCircle, StopCircle, Bike, Trash2, AlertTriangle,
    RefreshCw, Users, Calendar, Eye, ArrowRight,
    Zap, Server, Clock, SkipForward,
} from 'lucide-react';
import { SimulatorApi } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';

interface LiveStatus {
    running: boolean; elapsed_seconds: number; error: string | null;
    total_users: number; active_ratio: number; cheat_ratio: number; tick_seconds: number;
    currently_riding: number; total_completed: number; cheaters_caught: number;
    log: [string, string][];
}

interface BatchStatus {
    running: boolean; elapsed_seconds: number; error: string | null;
    scale: number; days: number; total_users: number;
    users_created: number; departments_created: number; activities_created: number;
    current_phase: string; progress_pct: number;
    log: [string, string][];
}

interface WorkerStatus {
    workers: { name: string; pool_size: number; total_tasks: number }[];
    total_workers: number;
    active_tasks: number;
    queues: string[];
    error?: string;
}

export const SimulatorPage: React.FC = () => {
    // ─── Wizard State ──────────────────────────────────────────────
    const [activeStep, setActiveStep] = useState(0);
    const [showProgress, setShowProgress] = useState(false);

    // Step 1: Setup
    const [totalUsers, setTotalUsers] = useState<number>(1100);
    const [days, setDays] = useState<number>(30);
    const [generateActivities, setGenerateActivities] = useState<boolean>(true);

    // Step 2: Live Simulation (optional)
    const [liveEnabled, setLiveEnabled] = useState<boolean>(false);
    const [poolPct, setPoolPct] = useState(0.5);
    const [activeRatio, setActiveRatio] = useState(0.25);
    const [cheatRatio, setCheatRatio] = useState(0.05);
    const [tickSeconds, setTickSeconds] = useState<number>(10);

    // ─── Launch State ──────────────────────────────────────────────
    const [batchStarting, setBatchStarting] = useState(false);
    const [liveStarting, setLiveStarting] = useState(false);

    // ─── Monitoring State ──────────────────────────────────────────
    const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
    const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
    const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);

    // Polling refs
    const batchPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const livePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const workerPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    // ─── Wipe Modal ────────────────────────────────────────────────
    const [wipeModalOpen, setWipeModalOpen] = useState(false);
    const [wipeConfirm, setWipeConfirm] = useState('');
    const [wiping, setWiping] = useState(false);

    const isBatchRunning = batchStatus?.running ?? false;
    const isLiveRunning = liveStatus?.running ?? false;
    const anyRunning = isBatchRunning || isLiveRunning;

    // ─── Polling Helpers ───────────────────────────────────────────
    const startBatchPoll = useCallback(() => {
        if (batchPollRef.current) clearInterval(batchPollRef.current);
        batchPollRef.current = setInterval(async () => {
            try {
                const data = await SimulatorApi.getBatchStatus();
                setBatchStatus(data);
            } catch { /* retry */ }
        }, 2000);
    }, []);

    const startLivePoll = useCallback(() => {
        if (livePollRef.current) clearInterval(livePollRef.current);
        livePollRef.current = setInterval(async () => {
            try {
                const data = await SimulatorApi.getLiveStatus();
                setLiveStatus(data);
            } catch { /* retry */ }
        }, 1500);
    }, []);

    const startWorkerPoll = useCallback(() => {
        if (workerPollRef.current) clearInterval(workerPollRef.current);
        workerPollRef.current = setInterval(async () => {
            try {
                const data = await SimulatorApi.getWorkerStatus();
                setWorkerStatus(data);
            } catch { /* retry */ }
        }, 5000);
    }, []);

    // ─── Init & Page Visibility API ────────────────────────────────
    useEffect(() => {
        const init = async () => {
            const [bs, ls] = await Promise.all([
                SimulatorApi.getBatchStatus().catch(() => null),
                SimulatorApi.getLiveStatus().catch(() => null),
            ]);
            if (bs) setBatchStatus(bs);
            if (ls) setLiveStatus(ls);
            if (bs?.running || ls?.running) {
                setShowProgress(true);
                setActiveStep(3);
            }
        };
        init();
        startBatchPoll();
        startLivePoll();
        startWorkerPoll();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                startBatchPoll();
                startLivePoll();
                startWorkerPoll();
                SimulatorApi.getBatchStatus().then(setBatchStatus).catch(() => { });
                SimulatorApi.getLiveStatus().then(setLiveStatus).catch(() => { });
                SimulatorApi.getWorkerStatus().then(setWorkerStatus).catch(() => { });
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (batchPollRef.current) clearInterval(batchPollRef.current);
            if (livePollRef.current) clearInterval(livePollRef.current);
            if (workerPollRef.current) clearInterval(workerPollRef.current);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [startBatchPoll, startLivePoll, startWorkerPoll]);

    // Auto-scroll log
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [batchStatus?.log, liveStatus?.log]);

    // ─── Launch Handler ────────────────────────────────────────────
    const handleLaunch = async () => {
        setBatchStarting(true);
        try {
            await SimulatorApi.startBatch({
                total_users: totalUsers,
                days,
                clear: true,
                skip_activities: !generateActivities,
            });
            notifications.show({
                title: 'Batch Simulation Started',
                message: `${totalUsers.toLocaleString()} users across random cities`,
                color: 'green',
            });
        } catch (err: any) {
            notifications.show({
                title: 'Batch Error',
                message: err?.response?.data?.error || 'Failed to start batch simulation',
                color: 'red',
            });
            setBatchStarting(false);
            return;
        }
        setBatchStarting(false);

        if (liveEnabled) {
            setLiveStarting(true);
            try {
                await SimulatorApi.startLive({
                    pool_pct: poolPct,
                    active_ratio: activeRatio,
                    cheat_ratio: cheatRatio,
                    tick_seconds: tickSeconds,
                });
                notifications.show({
                    title: 'Live Simulation Started',
                    message: `${(poolPct * 100).toFixed(0)}% pool, ${(activeRatio * 100).toFixed(0)}% active`,
                    color: 'green',
                });
            } catch (err: any) {
                notifications.show({
                    title: 'Live Error',
                    message: err?.response?.data?.error || 'Failed to start live simulation',
                    color: 'red',
                });
            }
            setLiveStarting(false);
        }

        setShowProgress(true);
        setActiveStep(3);
    };

    // ─── Abort Handlers ────────────────────────────────────────────
    const handleBatchAbort = async () => {
        try {
            await SimulatorApi.abortBatch();
            notifications.show({ title: 'Batch Stopped', message: 'Abort requested.', color: 'orange' });
        } catch (err: any) {
            notifications.show({ title: 'Error', message: err?.response?.data?.error || 'Failed', color: 'red' });
        }
    };

    const handleLiveAbort = async () => {
        try {
            await SimulatorApi.abortLive();
            notifications.show({ title: 'Live Stopped', message: 'Abort requested.', color: 'orange' });
        } catch (err: any) {
            notifications.show({ title: 'Error', message: err?.response?.data?.error || 'Failed', color: 'red' });
        }
    };

    // ─── Wipe Handler ──────────────────────────────────────────────
    const handleWipe = async () => {
        if (wipeConfirm !== 'DELETE ALL DATA') return;
        setWiping(true);
        try {
            await SimulatorApi.wipeData();
            notifications.show({ title: 'Data Wiped', message: 'All data except Global Owner deleted.', color: 'green' });
            setWipeModalOpen(false);
            setWipeConfirm('');
            setBatchStatus(null);
            setLiveStatus(null);
            setShowProgress(false);
            setActiveStep(0);
        } catch (err: any) {
            notifications.show({ title: 'Error', message: err?.response?.data?.error || 'Failed', color: 'red' });
        } finally { setWiping(false); }
    };

    // ─── Computed Previews ─────────────────────────────────────────
    const estimatedCities = Math.min(10, Math.max(3, Math.round(totalUsers / 200)));
    const estimatedDepartments = Math.max(5, estimatedCities * 4);
    const estimatedActivities = generateActivities ? Math.round(totalUsers * 5) : 0;
    const livePoolUsers = Math.round(totalUsers * poolPct);
    const liveActiveRiders = Math.round(livePoolUsers * activeRatio);
    const liveCheaters = Math.round(livePoolUsers * cheatRatio);

    // ─── Render ────────────────────────────────────────────────────
    return (
        <Box p="md">
            <PageHeader title="Simulator" subtitle="Generate realistic competition data across cities" />

            {!showProgress ? (
                <>
                    <Stepper active={activeStep} onStepClick={setActiveStep} mb="xl" allowNextStepsSelect={false}>
                        {/* ─── STEP 1: SETUP ─────────────────────────────────── */}
                        <Stepper.Step label="Setup" description="Configure generation" icon={<Settings size={18} />}>
                            <Card withBorder p="lg" mt="md">
                                <Group mb="md">
                                    <ThemeIcon size={28} radius="sm" color="indigo" variant="light"><Users size={14} /></ThemeIcon>
                                    <Text fw={600} size="lg">Step 1: Configure Data Generation</Text>
                                </Group>

                                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                                    <NumberInput
                                        label="Total Users"
                                        description="Athletes to create across random cities"
                                        value={totalUsers}
                                        onChange={(v) => setTotalUsers(Number(v) || 1100)}
                                        min={100} max={110000} step={100}
                                        leftSection={<Users size={16} />}
                                    />
                                    <NumberInput
                                        label="Days of History"
                                        description="How far back activities should span"
                                        value={days}
                                        onChange={(v) => setDays(Number(v) || 30)}
                                        min={1} max={90}
                                        leftSection={<Calendar size={16} />}
                                    />
                                </SimpleGrid>

                                <Checkbox
                                    mt="lg"
                                    label="Generate activities (GPS tracks)"
                                    description="Creates realistic running/cycling/walking activities. Approximately 5 per user."
                                    checked={generateActivities}
                                    onChange={(e) => setGenerateActivities(e.currentTarget.checked)}
                                />

                                {/* Preview Card */}
                                <Card withBorder mt="md" bg="var(--mantine-color-dark-8)">
                                    <Group mb="sm">
                                        <ThemeIcon size={24} radius="sm" color="cyan" variant="light"><Eye size={14} /></ThemeIcon>
                                        <Text fw={600}>Preview — What Will Be Created</Text>
                                    </Group>
                                    <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
                                        <Box>
                                            <Text size="xs" c="dimmed">Cities (random)</Text>
                                            <Text fw={600}>~{estimatedCities}</Text>
                                        </Box>
                                        <Box>
                                            <Text size="xs" c="dimmed">Users</Text>
                                            <Text fw={600}>{totalUsers.toLocaleString()}</Text>
                                        </Box>
                                        <Box>
                                            <Text size="xs" c="dimmed">Departments</Text>
                                            <Text fw={600}>~{estimatedDepartments}</Text>
                                        </Box>
                                        <Box>
                                            <Text size="xs" c="dimmed">Activities</Text>
                                            <Text fw={600} c={generateActivities ? 'green' : 'red'}>
                                                {generateActivities ? `~${estimatedActivities.toLocaleString()}` : 'None'}
                                            </Text>
                                        </Box>
                                    </SimpleGrid>
                                </Card>

                                <Group justify="flex-end" mt="md">
                                    <Button onClick={() => setActiveStep(1)} rightSection={<ArrowRight size={16} />}>
                                        Next: Live Simulation
                                    </Button>
                                </Group>
                            </Card>
                        </Stepper.Step>

                        {/* ─── STEP 2: LIVE SIMULATION (OPTIONAL) ───────────── */}
                        <Stepper.Step label="Live Sim" description="Optional ride simulator" icon={<Activity size={18} />}>
                            <Card withBorder p="lg" mt="md">
                                <Checkbox
                                    label={<Text fw={600}>Skip Live Simulation</Text>}
                                    description="The live ride simulator is optional. Uncheck this box to configure it."
                                    checked={!liveEnabled}
                                    onChange={(e) => setLiveEnabled(!e.currentTarget.checked)}
                                    mb="lg"
                                />

                                {liveEnabled && (
                                    <>
                                        <Group mb="md">
                                            <ThemeIcon size={28} radius="sm" color="violet" variant="light"><Bike size={14} /></ThemeIcon>
                                            <Text fw={600} size="lg">Step 2: Live Ride Simulator Configuration</Text>
                                        </Group>

                                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                                            <Box>
                                                <Group justify="space-between" mb={4}>
                                                    <Text size="sm" fw={500}>Pool Size (% of athletes)</Text>
                                                    <Badge variant="light">{(poolPct * 100).toFixed(0)}%</Badge>
                                                </Group>
                                                <Slider value={poolPct} onChange={setPoolPct} min={0.01} max={1.0} step={0.01}
                                                    label={(v) => `${(v * 100).toFixed(0)}%`}
                                                    marks={[
                                                        { value: 0.1, label: '10%' },
                                                        { value: 0.25, label: '25%' },
                                                        { value: 0.5, label: '50%' },
                                                        { value: 1, label: '100%' },
                                                    ]} />
                                                <Text size="xs" c="dimmed" mt={4}>~{livePoolUsers.toLocaleString()} users in pool</Text>
                                            </Box>
                                            <Box>
                                                <Group justify="space-between" mb={4}>
                                                    <Text size="sm" fw={500}>Active Riders</Text>
                                                    <Badge variant="light">{(activeRatio * 100).toFixed(0)}%</Badge>
                                                </Group>
                                                <Slider value={activeRatio} onChange={setActiveRatio} min={0.01} max={1.0} step={0.01}
                                                    label={(v) => `${(v * 100).toFixed(0)}%`}
                                                    marks={[
                                                        { value: 0.1, label: '10%' },
                                                        { value: 0.25, label: '25%' },
                                                        { value: 0.5, label: '50%' },
                                                    ]} />
                                                <Text size="xs" c="dimmed" mt={4}>~{liveActiveRiders.toLocaleString()} riding at any time</Text>
                                            </Box>
                                            <Box>
                                                <Group justify="space-between" mb={4}>
                                                    <Text size="sm" fw={500}>Cheaters</Text>
                                                    <Badge color="red" variant="light">{(cheatRatio * 100).toFixed(0)}%</Badge>
                                                </Group>
                                                <Slider value={cheatRatio} onChange={setCheatRatio} min={0} max={0.5} step={0.01}
                                                    label={(v) => `${(v * 100).toFixed(0)}%`}
                                                    marks={[
                                                        { value: 0, label: '0%' },
                                                        { value: 0.05, label: '5%' },
                                                        { value: 0.15, label: '15%' },
                                                    ]} />
                                                <Text size="xs" c="dimmed" mt={4}>~{liveCheaters.toLocaleString()} cheaters flagged</Text>
                                            </Box>
                                            <NumberInput
                                                label="Tick Interval (seconds)"
                                                description="How often rides start/finish"
                                                value={tickSeconds}
                                                onChange={(v) => setTickSeconds(Number(v) || 10)}
                                                min={2} max={300}
                                                leftSection={<Clock size={16} />}
                                            />
                                        </SimpleGrid>

                                        {/* Live preview info */}
                                        <Card withBorder mt="md" bg="var(--mantine-color-violet-9)" opacity={0.85}>
                                            <Text size="sm" c="white">
                                                Live simulation will use the same user pool created by batch generation.
                                                Rides start and finish each tick with realistic GPS tracks.
                                                Cheaters get suspicious route paths and low verification scores.
                                            </Text>
                                        </Card>
                                    </>
                                )}

                                {!liveEnabled && (
                                    <Alert color="gray" icon={<SkipForward size={16} />} mt="md">
                                        <Text size="sm">Live simulation skipped. Only batch generation will run when you launch.</Text>
                                    </Alert>
                                )}

                                <Group justify="space-between" mt="md">
                                    <Button variant="light" onClick={() => setActiveStep(0)}>
                                        Back: Setup
                                    </Button>
                                    <Button onClick={() => setActiveStep(2)} rightSection={<ArrowRight size={16} />}>
                                        Next: Review & Launch
                                    </Button>
                                </Group>
                            </Card>
                        </Stepper.Step>

                        {/* ─── STEP 3: REVIEW & LAUNCH ───────────────────────── */}
                        <Stepper.Step label="Review" description="Review & Launch" icon={<Zap size={18} />}>
                            <Card withBorder p="lg" mt="md">
                                <Group mb="md">
                                    <ThemeIcon size={28} radius="sm" color="teal" variant="light"><CheckCircle2 size={14} /></ThemeIcon>
                                    <Text fw={600} size="lg">Step 3: Review Settings & Launch</Text>
                                </Group>

                                {/* Batch Summary */}
                                <Card withBorder mb="md">
                                    <Text fw={600} mb="sm">Batch Generation</Text>
                                    <SimpleGrid cols={2} spacing="sm">
                                        <Box>
                                            <Text size="xs" c="dimmed">Total Users</Text>
                                            <Text fw={600}>{totalUsers.toLocaleString()}</Text>
                                        </Box>
                                        <Box>
                                            <Text size="xs" c="dimmed">Days of History</Text>
                                            <Text fw={600}>{days}</Text>
                                        </Box>
                                        <Box>
                                            <Text size="xs" c="dimmed">Activities</Text>
                                            <Text fw={600}>{generateActivities ? `~${estimatedActivities.toLocaleString()}` : 'Disabled'}</Text>
                                        </Box>
                                        <Box>
                                            <Text size="xs" c="dimmed">Cities (random)</Text>
                                            <Text fw={600}>~{estimatedCities}</Text>
                                        </Box>
                                        <Box>
                                            <Text size="xs" c="dimmed">Departments</Text>
                                            <Text fw={600}>~{estimatedDepartments}</Text>
                                        </Box>
                                        <Box>
                                            <Text size="xs" c="dimmed">Skip Activities</Text>
                                            <Text fw={600}>{!generateActivities ? 'Yes' : 'No'}</Text>
                                        </Box>
                                    </SimpleGrid>
                                </Card>

                                {/* Live Summary */}
                                <Card withBorder mb="md">
                                    <Text fw={600} mb="sm">Live Simulation</Text>
                                    {liveEnabled ? (
                                        <SimpleGrid cols={2} spacing="sm">
                                            <Box>
                                                <Text size="xs" c="dimmed">Pool (% of athletes)</Text>
                                                <Text fw={600}>{(poolPct * 100).toFixed(0)}%</Text>
                                            </Box>
                                            <Box>
                                                <Text size="xs" c="dimmed">Active Riders</Text>
                                                <Text fw={600}>{(activeRatio * 100).toFixed(0)}%</Text>
                                            </Box>
                                            <Box>
                                                <Text size="xs" c="dimmed">Cheaters</Text>
                                                <Text fw={600} c="red">{(cheatRatio * 100).toFixed(0)}%</Text>
                                            </Box>
                                            <Box>
                                                <Text size="xs" c="dimmed">Tick Interval</Text>
                                                <Text fw={600}>{tickSeconds}s</Text>
                                            </Box>
                                        </SimpleGrid>
                                    ) : (
                                        <Text size="sm" c="dimmed">Skipped</Text>
                                    )}
                                </Card>

                                <Group justify="space-between" mb="md">
                                    <Button variant="light" onClick={() => setActiveStep(1)}>
                                        Back: Live Sim
                                    </Button>
                                    <Button size="lg" color="violet"
                                        leftSection={<Play size={18} />}
                                        loading={batchStarting || liveStarting}
                                        onClick={handleLaunch}>
                                        Launch Simulation
                                    </Button>
                                </Group>

                                {/* Danger Zone */}
                                <Card withBorder style={{ border: '2px solid var(--mantine-color-red-6)' }}>
                                    <Group mb="md">
                                        <ThemeIcon size={28} radius="sm" color="red" variant="light"><AlertTriangle size={14} /></ThemeIcon>
                                        <Text fw={600} c="red">Danger Zone</Text>
                                    </Group>
                                    <Text size="sm" c="dimmed" mb="sm">
                                        Delete ALL data except Global Owner. This cannot be undone.
                                    </Text>
                                    <Button color="red" variant="outline" leftSection={<Trash2 size={14} />}
                                        onClick={() => setWipeModalOpen(true)}>
                                        Wipe All Data
                                    </Button>
                                </Card>
                            </Card>
                        </Stepper.Step>
                    </Stepper>
                </>
            ) : (
                /* ─── STEP 4: PROGRESS MONITORING ─────────────────────────── */
                <Box>
                    {/* Batch Status Alert */}
                    {batchStatus && (
                        <Alert mb="md"
                            color={isBatchRunning ? 'blue' : batchStatus.error ? 'red' : 'green'}
                            icon={isBatchRunning ? <Loader size={16} /> : batchStatus.error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                            title={isBatchRunning
                                ? `Batch Running — ${batchStatus.current_phase || '...'} (${(batchStatus.progress_pct ?? 0).toFixed(0)}%)`
                                : batchStatus.error ? 'Batch Error' : 'Batch Complete'}>
                            {isBatchRunning && <Progress value={batchStatus.progress_pct ?? 0} size="sm" mb="xs" animated />}
                            {batchStatus.error && <Text size="sm" c="red">{batchStatus.error}</Text>}
                            {!isBatchRunning && !batchStatus.error && (
                                <Text size="sm">
                                    Created: {batchStatus.users_created?.toLocaleString() ?? 0} users,
                                    {' '}{batchStatus.departments_created?.toLocaleString() ?? 0} departments,
                                    {' '}{batchStatus.activities_created?.toLocaleString() ?? 0} activities
                                </Text>
                            )}
                        </Alert>
                    )}

                    {/* Live Status Alert */}
                    {liveStatus && liveEnabled && (
                        <Alert mb="md"
                            color={isLiveRunning ? 'violet' : liveStatus.error ? 'red' : 'green'}
                            icon={isLiveRunning ? <Loader size={16} /> : liveStatus.error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                            title={isLiveRunning
                                ? `Live Running — ${Math.floor((liveStatus.elapsed_seconds ?? 0) / 60)}m ${Math.floor((liveStatus.elapsed_seconds ?? 0) % 60)}s`
                                : liveStatus.error ? 'Live Error' : 'Live Complete'}>
                            {liveStatus.error && <Text size="sm" c="red">{liveStatus.error}</Text>}
                        </Alert>
                    )}

                    {/* Stats Grid */}
                    <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" mb="md">
                        {batchStatus && (
                            <>
                                <Card withBorder padding="sm">
                                    <Text size="xs" c="dimmed">Users Created</Text>
                                    <Text fw={700} size="lg">{(batchStatus.users_created ?? 0).toLocaleString()}</Text>
                                </Card>
                                <Card withBorder padding="sm">
                                    <Text size="xs" c="dimmed">Departments</Text>
                                    <Text fw={700} size="lg">{(batchStatus.departments_created ?? 0).toLocaleString()}</Text>
                                </Card>
                                <Card withBorder padding="sm">
                                    <Text size="xs" c="dimmed">Activities</Text>
                                    <Text fw={700} size="lg" c={batchStatus.activities_created ? 'green' : undefined}>
                                        {(batchStatus.activities_created ?? 0).toLocaleString()}
                                    </Text>
                                </Card>
                                <Card withBorder padding="sm">
                                    <Text size="xs" c="dimmed">Elapsed (batch)</Text>
                                    <Text fw={700} size="lg">
                                        {batchStatus.elapsed_seconds != null
                                            ? `${Math.floor(batchStatus.elapsed_seconds / 60)}m ${Math.floor(batchStatus.elapsed_seconds % 60)}s`
                                            : '—'}
                                    </Text>
                                </Card>
                            </>
                        )}
                        {liveStatus && liveEnabled && (
                            <>
                                <Card withBorder padding="sm">
                                    <Text size="xs" c="dimmed">Pool Size</Text>
                                    <Text fw={700} size="lg">{(liveStatus.total_users ?? 0).toLocaleString()}</Text>
                                </Card>
                                <Card withBorder padding="sm">
                                    <Text size="xs" c="dimmed">Currently Riding</Text>
                                    <Text fw={700} size="lg" c="blue">{(liveStatus.currently_riding ?? 0).toLocaleString()}</Text>
                                </Card>
                                <Card withBorder padding="sm">
                                    <Text size="xs" c="dimmed">Completed</Text>
                                    <Text fw={700} size="lg" c="green">{(liveStatus.total_completed ?? 0).toLocaleString()}</Text>
                                </Card>
                                <Card withBorder padding="sm">
                                    <Text size="xs" c="dimmed">Cheaters Caught</Text>
                                    <Text fw={700} size="lg" c="red">{(liveStatus.cheaters_caught ?? 0).toLocaleString()}</Text>
                                </Card>
                            </>
                        )}
                    </SimpleGrid>

                    {/* Worker Info */}
                    {workerStatus && (
                        <Card withBorder mb="md">
                            <Group mb="sm">
                                <ThemeIcon size={24} radius="sm" color="blue" variant="light"><Server size={14} /></ThemeIcon>
                                <Text fw={600}>Celery Workers</Text>
                                <Badge variant="light" color="blue">
                                    {workerStatus.total_workers} worker{workerStatus.total_workers !== 1 ? 's' : ''}
                                </Badge>
                            </Group>
                            <SimpleGrid cols={{ base: 2, md: 3 }} spacing="sm">
                                <Box>
                                    <Text size="xs" c="dimmed">Active Workers</Text>
                                    <Text fw={600}>{workerStatus.total_workers}</Text>
                                </Box>
                                <Box>
                                    <Text size="xs" c="dimmed">Active Tasks</Text>
                                    <Text fw={600}>{workerStatus.active_tasks}</Text>
                                </Box>
                                <Box>
                                    <Text size="xs" c="dimmed">Queues</Text>
                                    <Text fw={600}>{workerStatus.queues?.length ? workerStatus.queues.join(', ') : 'N/A'}</Text>
                                </Box>
                            </SimpleGrid>
                            {workerStatus.workers.length > 0 && (
                                <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xs" mt="sm">
                                    {workerStatus.workers.map((w, i) => (
                                        <Box key={i} p="xs" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}>
                                            <Text size="xs" fw={500} truncate>{w.name}</Text>
                                            <Text size="xs" c="dimmed">Pool: {w.pool_size} | Processed: {w.total_tasks}</Text>
                                        </Box>
                                    ))}
                                </SimpleGrid>
                            )}
                        </Card>
                    )}

                    {/* Abort Buttons */}
                    {(isBatchRunning || isLiveRunning) && (
                        <Group mb="md">
                            {isBatchRunning && (
                                <Button color="red" variant="light" leftSection={<StopCircle size={16} />}
                                    onClick={handleBatchAbort}>
                                    Abort Batch
                                </Button>
                            )}
                            {isLiveRunning && (
                                <Button color="red" variant="light" leftSection={<StopCircle size={16} />}
                                    onClick={handleLiveAbort}>
                                    Abort Live
                                </Button>
                            )}
                        </Group>
                    )}

                    {/* Combined Log Viewer */}
                    {((batchStatus?.log?.length ?? 0) > 0 || (liveStatus?.log?.length ?? 0) > 0) && (
                        <Card withBorder mb="md">
                            <Group mb="xs">
                                <Text fw={600}>Simulation Log</Text>
                                <Group gap="xs">
                                    {batchStatus?.log?.length ? (
                                        <Badge variant="light" color="blue" size="sm">Batch: {batchStatus.log.length}</Badge>
                                    ) : null}
                                    {liveStatus?.log?.length ? (
                                        <Badge variant="light" color="violet" size="sm">Live: {liveStatus.log.length}</Badge>
                                    ) : null}
                                </Group>
                            </Group>
                            <ScrollArea h={350} style={{
                                background: '#0d1117', borderRadius: 8, padding: 12,
                                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                            }}>
                                {batchStatus?.log?.map(([ts, msg], i) => (
                                    <Text key={`b-${i}`} size="xs" style={{
                                        color: msg.includes('ERROR') ? '#f85149'
                                            : msg.includes('⚠️') ? '#f0883e'
                                                : '#58a6ff',
                                        lineHeight: 1.6,
                                    }}>
                                        <Text span c="dimmed" size="xs">[B {ts}]</Text> {msg}
                                    </Text>
                                ))}
                                {liveStatus?.log?.map(([ts, msg], i) => (
                                    <Text key={`l-${i}`} size="xs" style={{
                                        color: msg.includes('ERROR') ? '#f85149'
                                            : msg.includes('⚠️') ? '#f0883e'
                                                : '#8b949e',
                                        lineHeight: 1.6,
                                    }}>
                                        <Text span c="dimmed" size="xs">[L {ts}]</Text> {msg}
                                    </Text>
                                ))}
                                <div ref={logEndRef} />
                            </ScrollArea>
                        </Card>
                    )}

                    {/* Back to wizard when everything done */}
                    {!anyRunning && (batchStatus || liveStatus) && (
                        <Button variant="light" onClick={() => {
                            setShowProgress(false);
                            setActiveStep(0);
                            setBatchStatus(null);
                            setLiveStatus(null);
                        }} leftSection={<RefreshCw size={16} />}>
                            New Simulation
                        </Button>
                    )}
                </Box>
            )}

            {/* ─── WIPE MODAL ──────────────────────────────────────────────── */}
            <Modal opened={wipeModalOpen} onClose={() => { setWipeModalOpen(false); setWipeConfirm(''); }}
                title={<Text fw={700} c="red">⚠️ Wipe All Data</Text>} centered>
                <Stack gap="md">
                    <Text size="sm">Type <b>DELETE ALL DATA</b> to confirm:</Text>
                    <input type="text" value={wipeConfirm}
                        onChange={(e) => setWipeConfirm(e.target.value)}
                        placeholder="Type DELETE ALL DATA"
                        style={{
                            padding: '8px 12px', border: '1px solid var(--mantine-color-red-6)',
                            borderRadius: 8, background: 'var(--surface-secondary)',
                            color: 'var(--text-primary)', fontSize: 14, width: '100%',
                        }} />
                    <Button color="red" fullWidth leftSection={<Trash2 size={16} />}
                        loading={wiping} disabled={wipeConfirm !== 'DELETE ALL DATA'} onClick={handleWipe}>
                        {wiping ? 'Wiping...' : 'Yes, Delete Everything'}
                    </Button>
                </Stack>
            </Modal>
        </Box>
    );
};
