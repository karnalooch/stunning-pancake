import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    AlertCircle, ArrowRight, ArrowLeft, ShieldCheck, Database
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
    total_users: number; users_created: number; activities_created: number;
    current_phase: string; progress_pct: number;
    log: [string, string][];
}

interface WipeStatus {
    running?: boolean;
    progress_pct?: number;
    phase?: string;
    error?: string | null;
}

export const SimulatorPage: React.FC = () => {
    const [activeStep, setActiveStep] = useState(0);

    const [cyclists, setCyclists] = useState<number>(1000);
    const [generateActivities, setGenerateActivities] = useState(true);
    const [activeRatio, setActiveRatio] = useState(0.3);
    const [cheatRatio, setCheatRatio] = useState(0.05);
    const [tickSeconds, setTickSeconds] = useState<number>(8);
    const [liveEnabled, setLiveEnabled] = useState(true);

    const [launching, setLaunching] = useState(false);
    const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
    const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);

    const [wipeModalOpen, setWipeModalOpen] = useState(false);
    const [wipeConfirm, setWipeConfirm] = useState('');
    const [wiping, setWiping] = useState(false);
    const [wipeProgress, setWipeProgress] = useState(0);
    const [wipePhase, setWipePhase] = useState('');
    const [scaleReport, setScaleReport] = useState<any | null>(null);
    const [preflightLoading, setPreflightLoading] = useState(false);

    const batchPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const livePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    const isBatchRunning = batchStatus?.running ?? false;
    const isLiveRunning = liveStatus?.running ?? false;
    const anyRunning = isBatchRunning || isLiveRunning;
    const showBatchProgress = launching || isBatchRunning || (batchStatus && batchStatus.progress_pct > 0 && batchStatus.progress_pct < 100);

    const MAX_CONCURRENT = 5000;
    const rawActive = Math.round(cyclists * activeRatio);
    const activeRiders = Math.min(rawActive, MAX_CONCURRENT);
    const cheaters = Math.round(activeRiders * cheatRatio);
    const estActivities = generateActivities ? Math.round(cyclists * 2) : 0;

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
        setActiveRatio(0.1);
        setTickSeconds(15);
        setScaleReport(null);
    };

    const startPolling = useCallback(() => {
        if (batchPollRef.current) clearInterval(batchPollRef.current);
        if (livePollRef.current) clearInterval(livePollRef.current);

        batchPollRef.current = setInterval(async () => {
            try { const d = await SimulatorApi.getBatchStatus(); setBatchStatus(d); } catch {}
        }, 2000);
        livePollRef.current = setInterval(async () => {
            try { const d = await SimulatorApi.getLiveStatus(); setLiveStatus(d); } catch {}
        }, 1500);
    }, []);

    useEffect(() => {
        (async () => {
            const [bs, ls] = await Promise.all([
                SimulatorApi.getBatchStatus().catch(() => null),
                SimulatorApi.getLiveStatus().catch(() => null),
            ]);
            setBatchStatus(bs);
            setLiveStatus(ls);
            if (bs?.running || ls?.running) {
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
            });
            notifications.show({ title: 'Generowanie…', message: `Tworzenie ${cyclists.toLocaleString()} użytkowników — postęp poniżej.`, color: 'yellow' });

            await new Promise<void>((resolve, reject) => {
                let attempts = 0;
                const check = setInterval(async () => {
                    attempts++;
                    try {
                        const status = await SimulatorApi.getBatchStatus();
                        setBatchStatus(status);
                        if (!status.running) {
                            clearInterval(check);
                            resolve();
                        }
                    } catch (e) {
                        if (attempts > 10) {
                            clearInterval(check);
                            reject(e);
                        }
                    }
                }, 800);
            });
            notifications.show({ title: 'Cyclists Created', message: `${cyclists.toLocaleString()} users generated`, color: 'green' });
        } catch (err: any) {
            notifications.show({ title: 'Generation Error', message: err?.response?.data?.error || err.message, color: 'red' });
            setLaunching(false);
            return;
        }
        setLaunching(false);

        if (liveEnabled) {
            try {
                await SimulatorApi.startLive({
                    pool_pct: 1.0,
                    active_ratio: activeRatio,
                    cheat_ratio: cheatRatio,
                    tick_seconds: tickSeconds,
                });
                notifications.show({ title: 'Live Simulation Started', message: `${activeRiders.toLocaleString()} visible on map`, color: 'teal' });
            } catch (err: any) {
                notifications.show({ title: 'Live Sim Error', message: err?.response?.data?.error || err.message, color: 'orange' });
            }
        }
        startPolling();
    };

    const handleStop = async () => {
        try {
            await SimulatorApi.abortLive();
            await SimulatorApi.abortBatch();
            notifications.show({ title: 'Simulation Stopped', message: 'Riders will finish current rides', color: 'blue' });
        } catch {}
    };

    const handleWipe = async () => {
        if (wipeConfirm !== 'DELETE ALL DATA') return;
        setWiping(true);
        setWipeProgress(0);
        setWipePhase('Start…');
        try {
            await SimulatorApi.wipeData((s: WipeStatus) => {
                setWipeProgress(s.progress_pct ?? 0);
                setWipePhase(s.phase || '');
            });
            setBatchStatus(null); setLiveStatus(null);
            setWipeModalOpen(false); setWipeConfirm('');
            setActiveStep(0);
            notifications.show({ title: 'Wipe Complete', message: 'All simulation and activity data has been wiped.', color: 'green' });
        } catch (err: any) {
            notifications.show({ title: 'Error', message: err?.response?.data?.error || err.message || 'Wipe failed', color: 'red' });
        }
        setWiping(false);
        setWipeProgress(0);
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
                                    <Box>
                                        <Text size="sm" fw={600} mb={4}>Active Riders Pool: {(activeRatio * 100).toFixed(0)}%</Text>
                                        <Text size="xs" c="dimmed" mb="md">
                                            Na mapie jednocześnie max {MAX_CONCURRENT.toLocaleString()} (z {rawActive.toLocaleString()} żądanych)
                                        </Text>
                                        <Slider value={activeRatio} onChange={setActiveRatio} min={0.01} max={1.0} step={0.01}
                                            marks={[{ value: 0.1, label: '10%' }, { value: 0.3, label: '30%' }, { value: 0.6, label: '60%' }]} />
                                    </Box>

                                    <Box mt="md">
                                        <Group justify="space-between">
                                            <Text size="sm" fw={600}>Simulated Cheater Ratio: {(cheatRatio * 100).toFixed(0)}%</Text>
                                            <Badge color="red" variant="light">Anti-Cheat Testing</Badge>
                                        </Group>
                                        <Text size="xs" c="dimmed" mb="md">Percentage of riders generating non-compliant, fraudulent routes (~{cheaters.toLocaleString()} cheaters)</Text>
                                        <Slider value={cheatRatio} onChange={setCheatRatio} min={0} max={0.3} step={0.01}
                                            marks={[{ value: 0, label: '0%' }, { value: 0.05, label: '5%' }, { value: 0.15, label: '15%' }]} />
                                    </Box>

                                    <NumberInput
                                        label="Telemetry Tick Interval"
                                        description="How frequently (in seconds) the simulator pushes geographical updates"
                                        value={tickSeconds} onChange={(v) => setTickSeconds(Number(v) || 8)}
                                        min={3} max={60} leftSection={<Zap size={16} />}
                                        size="md"
                                        mt="md"
                                    />
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
                                                <Text size="sm" c="blue">• Live Riders Pool: <b>~{activeRiders.toLocaleString()} ({(activeRatio * 100).toFixed(0)}%)</b></Text>
                                                <Text size="sm" c="red">• Active Cheaters Pool: <b>~{cheaters.toLocaleString()} ({(cheatRatio * 100).toFixed(0)}%)</b></Text>
                                                <Text size="sm">• Tick telemetry push: <b>Every {tickSeconds} seconds</b></Text>
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

                                    {anyRunning && (
                                        <Button size="md" color="red" variant="light" fullWidth
                                            leftSection={<StopCircle size={16} />} onClick={handleStop}>
                                            Stop Active Simulation
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
                                    <Badge variant="light" color={anyRunning ? 'green' : 'gray'}>
                                        {anyRunning ? 'RUNNING' : 'IDLE'}
                                    </Badge>
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

                                {anyRunning ? (
                                    <SimpleGrid cols={2} spacing="xs" mb="md">
                                        <Card withBorder padding="xs" bg="var(--surface-secondary)">
                                            <Text size="2xs" c="dimmed">Active Riders</Text>
                                            <Text fw={700} size="lg" c="blue">{liveStatus?.currently_riding?.toLocaleString() ?? '0'}</Text>
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
                                            <Text size="2xs" c="dimmed">Users Created</Text>
                                            <Text fw={700} size="lg">{batchStatus?.users_created?.toLocaleString() ?? '—'}</Text>
                                        </Card>
                                    </SimpleGrid>
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
                                        {liveStatus?.log?.map(([ts, msg], i) => (
                                            <Text key={`l-${i}`} size="2xs"
                                                style={{ color: msg.includes('ERROR') ? '#f85149' : '#8b949e', lineHeight: 1.5 }}>
                                                <Text span c="dimmed" size="2xs">[L {ts}]</Text> {msg}
                                            </Text>
                                        ))}
                                        <div ref={logEndRef} />
                                    </ScrollArea>
                                )}

                                {/* Wipe Data (Danger Zone) */}
                                {!anyRunning && (
                                    <Button color="red" variant="subtle" size="xs" fullWidth mt="md"
                                        leftSection={<Trash2 size={12} />}
                                        onClick={() => setWipeModalOpen(true)}>
                                        Wipe Simulator DB Data
                                    </Button>
                                )}
                            </Card>
                        </SimpleGrid>
                    </Stepper.Step>
                </Stepper>
            </Card>

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
                    {wiping && (
                        <WipeProgressBar progressPct={wipeProgress} phase={wipePhase} />
                    )}
                    <Button color="red" fullWidth loading={wiping}
                        disabled={wipeConfirm !== 'DELETE ALL DATA'} onClick={handleWipe}>
                        {wiping ? `Wiping… ${wipeProgress.toFixed(0)}%` : 'Yes, Delete Everything'}
                    </Button>
                </Stack>
            </Modal>
        </Box>
    );
};
