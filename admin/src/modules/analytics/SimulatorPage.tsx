import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box, Text, Card, Group, Stack, Slider, NumberInput, Button,
    Badge, ThemeIcon, SimpleGrid, Alert, ScrollArea, Checkbox,
    Modal, Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
    Play, StopCircle, Bike, Trash2, AlertTriangle,
    RefreshCw, Users, Map, Activity, Zap, Loader, CheckCircle2,
    AlertCircle,
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

export const SimulatorPage: React.FC = () => {
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

    const batchPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const livePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    const isBatchRunning = batchStatus?.running ?? false;
    const isLiveRunning = liveStatus?.running ?? false;
    const anyRunning = isBatchRunning || isLiveRunning;

    const activeRiders = Math.round(cyclists * activeRatio);
    const cheaters = Math.round(activeRiders * cheatRatio);
    const estActivities = generateActivities ? Math.round(cyclists * 2) : 0;

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
        try {
            await SimulatorApi.startBatch({
                total_users: cyclists,
                days: 7,
                clear: true,
                skip_activities: !generateActivities,
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
        try {
            await SimulatorApi.wipeData();
            setBatchStatus(null); setLiveStatus(null);
            setWipeModalOpen(false); setWipeConfirm('');
        } catch (err: any) {
            notifications.show({ title: 'Error', message: err?.response?.data?.error || 'Wipe failed', color: 'red' });
        }
        setWiping(false);
    };

    return (
        <Box p="md">
            <PageHeader title="🚴 Cycling Simulator" subtitle="Generate cyclists that ride in real-time — visible on the live map" />

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                {/* ── LEFT: Configuration ──────────────────────────────── */}
                <Card withBorder>
                    <Group mb="md">
                        <ThemeIcon size={28} radius="sm" color="indigo" variant="light"><Users size={14} /></ThemeIcon>
                        <Text fw={600}>Configuration</Text>
                    </Group>

                    <Stack gap="md">
                        <NumberInput
                            label="Number of Cyclists"
                            value={cyclists}
                            onChange={(v) => setCyclists(Number(v) || 100)}
                            min={10} max={100000} step={100}
                            leftSection={<Bike size={16} />}
                        />

                        <Checkbox
                            label="Generate GPS-tracked activities"
                            description="Creates rides with realistic route paths on the map"
                            checked={generateActivities}
                            onChange={(e) => setGenerateActivities(e.currentTarget.checked)}
                        />

                        <Divider label="Live Simulation" labelPosition="center" />

                        <Checkbox
                            label="Enable live ride simulation"
                            description="Cyclists will ride in real-time and appear on the live map"
                            checked={liveEnabled}
                            onChange={(e) => setLiveEnabled(e.currentTarget.checked)}
                        />

                        {liveEnabled && (
                            <>
                                <Box>
                                    <Text size="sm" fw={500} mb={4}>Active Riders: {(activeRatio * 100).toFixed(0)}%</Text>
                                    <Slider value={activeRatio} onChange={setActiveRatio} min={0.01} max={1.0} step={0.01}
                                        marks={[{ value: 0.1, label: '10%' }, { value: 0.3, label: '30%' }, { value: 0.6, label: '60%' }]} />
                                </Box>
                                <Box>
                                    <Text size="sm" fw={500} mb={4}>Cheaters: {(cheatRatio * 100).toFixed(0)}%</Text>
                                    <Slider value={cheatRatio} onChange={setCheatRatio} min={0} max={0.3} step={0.01}
                                        marks={[{ value: 0, label: '0%' }, { value: 0.05, label: '5%' }, { value: 0.15, label: '15%' }]} />
                                </Box>
                                <NumberInput
                                    label="Tick Interval (s)"
                                    value={tickSeconds} onChange={(v) => setTickSeconds(Number(v) || 8)}
                                    min={3} max={60} leftSection={<Zap size={16} />}
                                />
                            </>
                        )}

                        <Card withBorder bg="var(--mantine-color-dark-8)" padding="sm">
                            <Text size="xs" c="dimmed" mb={4}>Preview</Text>
                            <SimpleGrid cols={2} spacing="xs">
                                <Text size="xs">Cyclists: <b>{cyclists.toLocaleString()}</b></Text>
                                <Text size="xs">Activities: <b>{estActivities.toLocaleString()}</b></Text>
                                {liveEnabled && (
                                    <>
                                        <Text size="xs" c="blue">Riding: <b>~{activeRiders.toLocaleString()}</b></Text>
                                        <Text size="xs" c="red">Cheaters: <b>~{cheaters.toLocaleString()}</b></Text>
                                    </>
                                )}
                            </SimpleGrid>
                        </Card>

                        <Button size="lg" color="violet" fullWidth
                            leftSection={anyRunning ? <Loader size={16} /> : <Play size={18} />}
                            loading={launching} disabled={anyRunning}
                            onClick={handleLaunch}>
                            {launching ? 'Creating...' : `Start ${cyclists.toLocaleString()} Cyclists`}
                        </Button>

                        {anyRunning && (
                            <Button size="md" color="red" variant="light" fullWidth
                                leftSection={<StopCircle size={16} />} onClick={handleStop}>
                                Stop Simulation
                            </Button>
                        )}
                    </Stack>
                </Card>

                {/* ── RIGHT: Live Monitoring ───────────────────────────── */}
                <Card withBorder>
                    <Group mb="md">
                        <ThemeIcon size={28} radius="sm" color="teal" variant="light"><Activity size={14} /></ThemeIcon>
                        <Text fw={600}>Live Monitoring</Text>
                        <Badge variant="light" color={anyRunning ? 'green' : 'gray'}>
                            {anyRunning ? 'RUNNING' : 'IDLE'}
                        </Badge>
                    </Group>

                    {anyRunning ? (
                        <SimpleGrid cols={{ base: 2, md: 3 }} spacing="sm" mb="md">
                            <Card withBorder padding="sm">
                                <Text size="xs" c="dimmed">Cyclists Riding</Text>
                                <Text fw={700} size="xl" c="blue">{liveStatus?.currently_riding?.toLocaleString() ?? '0'}</Text>
                            </Card>
                            <Card withBorder padding="sm">
                                <Text size="xs" c="dimmed">Rides Completed</Text>
                                <Text fw={700} size="xl" c="green">{liveStatus?.total_completed?.toLocaleString() ?? '0'}</Text>
                            </Card>
                            <Card withBorder padding="sm">
                                <Text size="xs" c="dimmed">Cheaters Caught</Text>
                                <Text fw={700} size="xl" c="red">{liveStatus?.cheaters_caught?.toLocaleString() ?? '0'}</Text>
                            </Card>
                            <Card withBorder padding="sm">
                                <Text size="xs" c="dimmed">Users Created</Text>
                                <Text fw={700} size="xl">{batchStatus?.users_created?.toLocaleString() ?? '—'}</Text>
                            </Card>
                            <Card withBorder padding="sm">
                                <Text size="xs" c="dimmed">Activities</Text>
                                <Text fw={700} size="xl" c="cyan">{batchStatus?.activities_created?.toLocaleString() ?? '—'}</Text>
                            </Card>
                            <Card withBorder padding="sm">
                                <Text size="xs" c="dimmed">Phase</Text>
                                <Text fw={700} size="xl">{batchStatus?.current_phase ?? '...'}</Text>
                            </Card>
                        </SimpleGrid>
                    ) : (
                        <Alert color="gray" icon={<Activity size={16} />} mb="md">
                            <Text size="sm">No simulation running. Configure and launch from the left panel.</Text>
                        </Alert>
                    )}

                    {/* View on Map */}
                    <Button variant="light" color="cyan" fullWidth mb="md"
                        leftSection={<Map size={16} />}
                        component="a" href="#/owner/dashboard">
                        View Cyclists on Live Map
                    </Button>

                    {/* Logs */}
                    {((batchStatus?.log?.length ?? 0) > 0 || (liveStatus?.log?.length ?? 0) > 0) && (
                        <ScrollArea h={280} style={{
                            background: '#0d1117', borderRadius: 8, padding: 12,
                            fontFamily: 'monospace',
                        }}>
                            {batchStatus?.log?.map(([ts, msg], i) => (
                                <Text key={`b-${i}`} size="xs"
                                    style={{ color: msg.includes('ERROR') ? '#f85149' : '#58a6ff', lineHeight: 1.5 }}>
                                    <Text span c="dimmed" size="xs">[{ts}]</Text> {msg}
                                </Text>
                            ))}
                            {liveStatus?.log?.map(([ts, msg], i) => (
                                <Text key={`l-${i}`} size="xs"
                                    style={{ color: msg.includes('ERROR') ? '#f85149' : '#8b949e', lineHeight: 1.5 }}>
                                    <Text span c="dimmed" size="xs">[L {ts}]</Text> {msg}
                                </Text>
                            ))}
                            <div ref={logEndRef} />
                        </ScrollArea>
                    )}

                    {/* Danger Zone */}
                    <Card withBorder mt="md" style={{ border: '1px solid var(--mantine-color-red-6)' }}>
                        <Button color="red" variant="subtle" fullWidth
                            leftSection={<Trash2 size={14} />} disabled={anyRunning}
                            onClick={() => setWipeModalOpen(true)}>
                            Wipe All Data
                        </Button>
                    </Card>
                </Card>
            </SimpleGrid>

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
                    <Button color="red" fullWidth loading={wiping}
                        disabled={wipeConfirm !== 'DELETE ALL DATA'} onClick={handleWipe}>
                        {wiping ? 'Wiping...' : 'Yes, Delete Everything'}
                    </Button>
                </Stack>
            </Modal>
        </Box>
    );
};
