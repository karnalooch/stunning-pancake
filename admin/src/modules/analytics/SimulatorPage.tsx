import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, Card, Group, Stack, Slider, NumberInput, Button, Badge, ThemeIcon, SimpleGrid, Alert, ScrollArea, Tabs, Modal } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Play, Settings, Map, Zap, Activity, Loader, CheckCircle2, AlertCircle, StopCircle, Bike, Trash2, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';

const CITIES = ["Warszawa", "Kraków", "Wrocław", "Poznań", "Gdańsk", "Łódź", "Lublin", "Bydgoszcz", "Katowice", "Siedlce"];

interface LiveStatus {
    running: boolean; elapsed_seconds: number; error: string | null;
    total_users: number; active_ratio: number; cheat_ratio: number; tick_seconds: number;
    currently_riding: number; total_completed: number; cheaters_caught: number;
    log: [string, string][];
}

export const SimulatorPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<string | null>('live');
    const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
    const [liveStarting, setLiveStarting] = useState(false);
    const [liveAborting, setLiveAborting] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    const [poolPct, setPoolPct] = useState(0.5);
    const [activeRatio, setActiveRatio] = useState(0.25);
    const [cheatRatio, setCheatRatio] = useState(0.05);
    const [tickSeconds, setTickSeconds] = useState<number>(10);

    const [userCount, setUserCount] = useState<number>(1100);
    const [days, setDays] = useState<number>(30);
    const [batchStarting, setBatchStarting] = useState(false);

    const [wipeModalOpen, setWipeModalOpen] = useState(false);
    const [wipeConfirm, setWipeConfirm] = useState('');
    const [wiping, setWiping] = useState(false);

    const isLiveRunning = liveStatus?.running ?? false;

    const fetchLiveStatus = useCallback(async () => {
        try { const { data } = await apiClient.get('/activities/admin/live-simulate/'); setLiveStatus(data); if (!data.running && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } } catch { }
    }, []);

    useEffect(() => { fetchLiveStatus(); return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, [fetchLiveStatus]);
    useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [liveStatus?.log]);

    const handleLiveStart = async () => {
        setLiveStarting(true);
        try {
            await apiClient.post('/activities/admin/live-simulate/', { pool_pct: poolPct, active_ratio: activeRatio, cheat_ratio: cheatRatio, tick_seconds: tickSeconds });
            notifications.show({ title: 'Live Simulation Started', message: `Pool: ${(poolPct * 100).toFixed(0)}% of athletes`, color: 'green' });
            pollRef.current = setInterval(fetchLiveStatus, 1500); fetchLiveStatus();
        } catch (err: any) { notifications.show({ title: 'Error', message: err?.response?.data?.error || 'Failed', color: 'red' }); }
        finally { setLiveStarting(false); }
    };

    const handleLiveAbort = async () => {
        setLiveAborting(true);
        try { await apiClient.delete('/activities/admin/live-simulate/'); notifications.show({ title: 'Abort Requested', message: 'Stopping.', color: 'orange' }); }
        catch (err: any) { notifications.show({ title: 'Error', message: err?.response?.data?.error || 'Failed', color: 'red' }); }
        finally { setLiveAborting(false); }
    };

    const handleBatchRun = async () => {
        setBatchStarting(true);
        const scale = Math.min(1.0, userCount / 11_000); // convert user count to scale
        try { await apiClient.post('/activities/admin/simulate/', { scale, days, clear: true, skip_activities: true }); notifications.show({ title: 'Users Generated', message: `~${userCount.toLocaleString()} users (no activities)`, color: 'green' }); }
        catch (err: any) { notifications.show({ title: 'Error', message: err?.response?.data?.error || 'Failed', color: 'red' }); }
        finally { setBatchStarting(false); }
    };

    const handleWipe = async () => {
        if (wipeConfirm !== 'DELETE ALL DATA') return;
        setWiping(true);
        try { await apiClient.delete('/activities/admin/wipe-data/', { data: { confirm: true } }); notifications.show({ title: 'Data Wiped', message: 'All data except Global Owner deleted.', color: 'green' }); setWipeModalOpen(false); setWipeConfirm(''); }
        catch (err: any) { notifications.show({ title: 'Error', message: err?.response?.data?.error || 'Failed', color: 'red' }); }
        finally { setWiping(false); }
    };

    return (
        <Box p="md">
            <PageHeader title="Aktywne Miasta — Simulator" subtitle="Generate realistic competition data" />
            <Tabs value={activeTab} onChange={setActiveTab} mb="md">
                <Tabs.List>
                    <Tabs.Tab value="live" leftSection={<Activity size={14} />}>Live Ride Simulator</Tabs.Tab>
                    <Tabs.Tab value="batch" leftSection={<Zap size={14} />}>Batch Generator</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="live" pt="md">
                    {liveStatus && (isLiveRunning || liveStatus.error || (!isLiveRunning && liveStatus.elapsed_seconds > 0)) && (
                        <Alert mb="md" color={isLiveRunning ? 'blue' : liveStatus.error ? 'red' : 'green'}
                            icon={isLiveRunning ? <Loader size={16} /> : liveStatus.error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                            title={isLiveRunning ? `Live — ${Math.floor(liveStatus.elapsed_seconds / 60)}m ${Math.floor(liveStatus.elapsed_seconds % 60)}s` : liveStatus.error ? 'Error' : 'Complete'}>
                            {liveStatus.error && <Text size="sm" c="red">{liveStatus.error}</Text>}
                        </Alert>
                    )}
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="md">
                        <Card withBorder><Group mb="md"><ThemeIcon size={28} radius="sm" color="violet" variant="light"><Settings size={14} /></ThemeIcon><Text fw={600}>Live Controls</Text></Group>
                            <Stack gap="md">
                                <Box><Group justify="space-between" mb={4}><Text size="sm" fw={500}>Pool Size (% of all athletes)</Text><Badge variant="light">{(poolPct * 100).toFixed(0)}%</Badge></Group>
                                    <Slider value={poolPct} onChange={setPoolPct} min={0.01} max={1.0} step={0.01} label={(v) => `${(v * 100).toFixed(0)}%`} marks={[{ value: 0.1, label: '10%' }, { value: 0.25, label: '25%' }, { value: 0.5, label: '50%' }, { value: 1, label: '100%' }]} disabled={isLiveRunning} /></Box>
                                <Box><Group justify="space-between" mb={4}><Text size="sm" fw={500}>Active Riders</Text><Badge variant="light">{(activeRatio * 100).toFixed(0)}%</Badge></Group>
                                    <Slider value={activeRatio} onChange={setActiveRatio} min={0.01} max={1.0} step={0.01} label={(v) => `${(v * 100).toFixed(0)}%`} marks={[{ value: 0.1, label: '10%' }, { value: 0.25, label: '25%' }, { value: 0.5, label: '50%' }]} disabled={isLiveRunning} /></Box>
                                <Box><Group justify="space-between" mb={4}><Text size="sm" fw={500}>Cheaters</Text><Badge color="red" variant="light">{(cheatRatio * 100).toFixed(0)}%</Badge></Group>
                                    <Slider value={cheatRatio} onChange={setCheatRatio} min={0} max={0.5} step={0.01} label={(v) => `${(v * 100).toFixed(0)}%`} marks={[{ value: 0, label: '0%' }, { value: 0.05, label: '5%' }, { value: 0.15, label: '15%' }]} disabled={isLiveRunning} /></Box>
                                <NumberInput label="Tick Interval (s)" value={tickSeconds} onChange={(v) => setTickSeconds(Number(v) || 10)} min={2} max={120} disabled={isLiveRunning} />
                                <Group grow>
                                    <Button fullWidth size="md" color="violet" leftSection={isLiveRunning ? <Loader size={16} /> : <Play size={16} />} loading={liveStarting} disabled={isLiveRunning} onClick={handleLiveStart}>
                                        {isLiveRunning ? 'Running...' : 'Start Live'}</Button>
                                    {isLiveRunning && <Button size="md" color="red" variant="light" leftSection={<StopCircle size={16} />} loading={liveAborting} onClick={handleLiveAbort}>Abort</Button>}
                                </Group>
                            </Stack></Card>
                        <SimpleGrid cols={1} spacing="md">
                            <Card withBorder><Group mb="md"><ThemeIcon size={28} radius="sm" color="cyan" variant="light"><Bike size={14} /></ThemeIcon><Text fw={600}>Live Stats</Text></Group>
                                <SimpleGrid cols={2} spacing="sm">
                                    <Box p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}><Text size="xs" c="dimmed">Pool</Text><Text fw={700} size="lg">{liveStatus?.total_users?.toLocaleString() ?? '—'}</Text></Box>
                                    <Box p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}><Text size="xs" c="dimmed">Riding</Text><Text fw={700} size="lg" c="blue">{liveStatus?.currently_riding?.toLocaleString() ?? '0'}</Text></Box>
                                    <Box p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}><Text size="xs" c="dimmed">Completed</Text><Text fw={700} size="lg" c="green">{liveStatus?.total_completed?.toLocaleString() ?? '0'}</Text></Box>
                                    <Box p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}><Text size="xs" c="dimmed">Cheaters</Text><Text fw={700} size="lg" c="red">{liveStatus?.cheaters_caught?.toLocaleString() ?? '0'}</Text></Box>
                                </SimpleGrid></Card>
                            <Card withBorder><Text fw={600} mb="xs">How it works</Text><Text size="sm" c="dimmed">Pick a percentage of all athletes as the pool. Each tick: some start rides, some finish. Cheaters get flagged.</Text></Card>
                        </SimpleGrid>
                    </SimpleGrid>
                    {liveStatus && liveStatus.log.length > 0 && (
                        <Card withBorder mb="md"><Group mb="xs"><Text fw={600}>Live Log</Text><Badge variant="light">{liveStatus.log.length} lines</Badge></Group>
                            <ScrollArea h={250} style={{ background: '#0d1117', borderRadius: 8, padding: 10, fontFamily: 'monospace' }}>
                                {liveStatus.log.map(([ts, msg], i) => (<Text key={i} size="xs" style={{ color: msg.includes('ERROR') ? '#f85149' : msg.includes('⚠️') ? '#f0883e' : '#8b949e', lineHeight: 1.6 }}><Text span c="dimmed" size="xs">[{ts}]</Text> {msg}</Text>))}
                                <div ref={logEndRef} /></ScrollArea></Card>)}
                </Tabs.Panel>

                <Tabs.Panel value="batch" pt="md">
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="md">
                        <Card withBorder><Group mb="md"><ThemeIcon size={28} radius="sm" color="indigo" variant="light"><Zap size={14} /></ThemeIcon><Text fw={600}>Batch Preview</Text></Group>
                            <SimpleGrid cols={2} spacing="sm">
                                <Box p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}><Text size="xs" c="dimmed">Cities</Text><Text fw={700} size="lg">10</Text></Box>
                                <Box p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}><Text size="xs" c="dimmed">Users</Text><Text fw={700} size="lg">{userCount.toLocaleString()}</Text></Box>
                                <Box p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}><Text size="xs" c="dimmed">Departments</Text><Text fw={700} size="lg">~{Math.round(187 * Math.min(1, userCount / 110_000))}</Text></Box>
                                <Box p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}><Text size="xs" c="dimmed">Activities</Text><Text fw={700} size="lg" c="red">None (disabled)</Text></Box>
                            </SimpleGrid></Card>
                        <Card withBorder><Group mb="md"><ThemeIcon size={28} radius="sm" color="violet" variant="light"><Settings size={14} /></ThemeIcon><Text fw={600}>Batch Controls</Text></Group>
                            <Stack gap="md">
                                <NumberInput label="Users per city" value={Math.round(userCount / 10)} onChange={(v) => setUserCount(Number(v) * 10)} min={10} max={11000} step={10} />
                                <Text size="xs" c="dimmed">Total: {userCount.toLocaleString()} users across 10 cities</Text>
                                <NumberInput label="Days (history)" value={days} onChange={(v) => setDays(Number(v) || 30)} min={1} max={90} />
                                <Button fullWidth size="md" color="violet" leftSection={<Zap size={16} />} loading={batchStarting} onClick={handleBatchRun}>
                                    Generate Users Only</Button>
                            </Stack></Card>
                    </SimpleGrid>
                    <Card withBorder mb="md"><Group mb="md"><ThemeIcon size={28} radius="sm" color="cyan" variant="light"><Map size={14} /></ThemeIcon><Text fw={600}>Cities</Text></Group>
                        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }}>{CITIES.map(c => <Box key={c} p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8, textAlign: 'center' }}><Text size="sm" fw={500}>{c}</Text><Text size="xs" c="dimmed">~{Math.round(userCount / 10).toLocaleString()} users</Text></Box>)}</SimpleGrid></Card>
                    <Card withBorder style={{ border: '2px solid var(--mantine-color-red-6)' }}>
                        <Group mb="md"><ThemeIcon size={28} radius="sm" color="red" variant="light"><AlertTriangle size={14} /></ThemeIcon><Text fw={600} c="red">Danger Zone</Text></Group>
                        <Text size="sm" c="dimmed" mb="sm">Delete ALL data except Global Owner.</Text>
                        <Button color="red" variant="outline" size="xs" leftSection={<Trash2 size={14} />} onClick={() => setWipeModalOpen(true)}>Wipe All Data</Button>
                    </Card>
                </Tabs.Panel>
            </Tabs>
            <Modal opened={wipeModalOpen} onClose={() => { setWipeModalOpen(false); setWipeConfirm(''); }} title={<Text fw={700} c="red">⚠️ Wipe All Data</Text>} centered>
                <Stack gap="md"><Text size="sm">Type <b>DELETE ALL DATA</b> to confirm:</Text>
                    <input type="text" value={wipeConfirm} onChange={(e) => setWipeConfirm(e.target.value)} placeholder="Type DELETE ALL DATA"
                        style={{ padding: '8px 12px', border: '1px solid var(--mantine-color-red-6)', borderRadius: 8, background: 'var(--surface-secondary)', color: 'var(--text-primary)', fontSize: 14, width: '100%' }} />
                    <Button color="red" fullWidth leftSection={<Trash2 size={16} />} loading={wiping} disabled={wipeConfirm !== 'DELETE ALL DATA'} onClick={handleWipe}>
                        {wiping ? 'Wiping...' : 'Yes, Delete Everything'}</Button></Stack>
            </Modal>
        </Box>
    );
};
