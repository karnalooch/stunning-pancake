import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, Card, Group, Stack, Slider, NumberInput, Switch, Button, Badge, ThemeIcon, SimpleGrid, Alert, Progress, ScrollArea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Play, Settings, Map, Zap, Activity, Loader, CheckCircle2, AlertCircle, StopCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';

const CITIES = [
    "Warszawa", "Kraków", "Wrocław", "Poznań", "Gdańsk",
    "Łódź", "Lublin", "Bydgoszcz", "Katowice", "Siedlce",
];

interface SimStatus {
    running: boolean;
    elapsed_seconds: number;
    scale: number;
    days: number;
    error: string | null;
    log: [string, string][];
}

export const SimulatorPage: React.FC = () => {
    const [scale, setScale] = useState(0.1);
    const [days, setDays] = useState<number>(30);
    const [clear, setClear] = useState(true);
    const [starting, setStarting] = useState(false);
    const [aborting, setAborting] = useState(false);
    const [status, setStatus] = useState<SimStatus | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    const scaledUsers = Math.round(110_000 * scale).toLocaleString();
    const scaledActivities = Math.round(550_000 * scale).toLocaleString();
    const scaledDepts = Math.round(187 * scale);

    const fetchStatus = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/activities/admin/simulate/');
            setStatus(data);
            if (!data.running && pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchStatus(); return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, [fetchStatus]);

    // Auto-scroll log
    useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [status?.log]);

    const handleRun = async () => {
        setStarting(true);
        try {
            await apiClient.post('/activities/admin/simulate/', { scale, days, clear });
            notifications.show({ title: 'Simulation Started', message: `Scale: ${Math.round(scale * 100)}%, Days: ${days}`, color: 'green' });
            pollRef.current = setInterval(fetchStatus, 1500);
            fetchStatus();
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Failed to start simulation.';
            notifications.show({ title: 'Error', message: msg, color: 'red' });
        } finally { setStarting(false); }
    };

    const handleAbort = async () => {
        setAborting(true);
        try {
            await apiClient.delete('/activities/admin/simulate/');
            notifications.show({ title: 'Abort Requested', message: 'Simulation will stop at the next checkpoint.', color: 'orange' });
        } catch (err: any) {
            notifications.show({ title: 'Error', message: err?.response?.data?.error || 'Abort failed.', color: 'red' });
        } finally { setAborting(false); }
    };

    const isRunning = status?.running ?? false;
    const estMinutes = Math.max(1, Math.round(scale * 30));
    const progressPct = status ? Math.min(99, Math.round((status.elapsed_seconds / (estMinutes * 60)) * 100)) : 0;
    const hasError = !!status?.error;
    const isDone = status && !isRunning && !hasError && status.elapsed_seconds > 0;

    return (
        <Box p="md">
            <PageHeader
                title="Aktywne Miasta — Simulator"
                subtitle="Generate realistic competition data for stress-testing and demos"
            />

            {/* Status Banner */}
            {status && (isRunning || hasError || isDone) && (
                <Alert
                    mb="md"
                    color={isRunning ? 'blue' : hasError ? 'red' : 'green'}
                    icon={isRunning ? <Loader size={16} /> : hasError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                    title={
                        isRunning
                            ? `Running — ${Math.floor(status.elapsed_seconds / 60)}m ${Math.floor(status.elapsed_seconds % 60)}s`
                            : hasError ? 'Simulation Failed' : `Complete — ${Math.floor(status.elapsed_seconds / 60)}m ${Math.floor(status.elapsed_seconds % 60)}s`
                    }
                >
                    {isRunning && <Progress value={progressPct} size="xs" mt="xs" animated />}
                    {hasError && <Text size="sm" mt="xs" c="red">{status.error}</Text>}
                </Alert>
            )}

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="md">
                {/* Stats preview */}
                <Card withBorder>
                    <Group mb="md">
                        <ThemeIcon size={28} radius="sm" color="indigo" variant="light"><Zap size={14} /></ThemeIcon>
                        <Text fw={600}>Simulation Preview</Text>
                    </Group>
                    <SimpleGrid cols={2} spacing="sm">
                        <Box p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}>
                            <Text size="xs" c="dimmed">Cities</Text><Text fw={700} size="lg">10</Text>
                        </Box>
                        <Box p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}>
                            <Text size="xs" c="dimmed">Users</Text><Text fw={700} size="lg">{scaledUsers}</Text>
                        </Box>
                        <Box p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}>
                            <Text size="xs" c="dimmed">Activities</Text><Text fw={700} size="lg">{scaledActivities}</Text>
                        </Box>
                        <Box p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}>
                            <Text size="xs" c="dimmed">Departments</Text><Text fw={700} size="lg">~{scaledDepts}</Text>
                        </Box>
                    </SimpleGrid>
                </Card>

                {/* Controls */}
                <Card withBorder>
                    <Group mb="md">
                        <ThemeIcon size={28} radius="sm" color="violet" variant="light"><Settings size={14} /></ThemeIcon>
                        <Text fw={600}>Simulation Controls</Text>
                    </Group>
                    <Stack gap="md">
                        <Box>
                            <Group justify="space-between" mb={4}>
                                <Text size="sm" fw={500}>Scale</Text>
                                <Badge variant="light" size="sm">{Math.round(scale * 100)}%</Badge>
                            </Group>
                            <Slider value={scale} onChange={setScale} min={0.001} max={1.0} step={0.01}
                                label={(v) => `${Math.round(v * 100)}%`}
                                marks={[{ value: 0.001, label: '0.1%' }, { value: 0.01, label: '1%' }, { value: 0.1, label: '10%' }, { value: 0.5, label: '50%' }, { value: 1.0, label: '100%' }]}
                                disabled={isRunning} />
                        </Box>
                        <NumberInput label="Competition Days" value={days} onChange={(v) => setDays(Number(v) || 30)} min={1} max={90} disabled={isRunning} />
                        <Switch label="Clear existing simulation data first" checked={clear} onChange={(e) => setClear(e.currentTarget.checked)} disabled={isRunning} />
                        <Group grow>
                            <Button fullWidth size="md" color="violet" leftSection={isRunning ? <Loader size={16} /> : <Play size={16} />}
                                loading={starting} disabled={isRunning} onClick={handleRun}>
                                {isRunning ? `Running... ${Math.floor((status?.elapsed_seconds ?? 0) / 60)}m` : starting ? 'Starting...' : 'Run Simulation'}
                            </Button>
                            {isRunning && (
                                <Button size="md" color="red" variant="light" leftSection={<StopCircle size={16} />}
                                    loading={aborting} onClick={handleAbort}>
                                    Abort
                                </Button>
                            )}
                        </Group>
                    </Stack>
                </Card>
            </SimpleGrid>

            {/* Real-time Log */}
            {status && status.log.length > 0 && (
                <Card withBorder mb="md">
                    <Group mb="xs">
                        <ThemeIcon size={28} radius="sm" color="gray" variant="light"><Activity size={14} /></ThemeIcon>
                        <Text fw={600}>Simulation Log</Text>
                        <Badge variant="light" size="sm">{status.log.length} lines</Badge>
                    </Group>
                    <ScrollArea h={300} style={{ background: '#0d1117', borderRadius: 8, padding: 10, fontFamily: 'monospace' }}>
                        {status.log.map(([ts, msg], i) => (
                            <Text key={i} size="xs" style={{ color: msg.startsWith('ERROR') ? '#f85149' : msg.includes('⚠️') ? '#f0883e' : '#8b949e', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                <Text span c="dimmed" size="xs">[{ts}]</Text> {msg}
                            </Text>
                        ))}
                        <div ref={logEndRef} />
                    </ScrollArea>
                </Card>
            )}

            {/* City list */}
            <Card withBorder mb="md">
                <Group mb="md"><ThemeIcon size={28} radius="sm" color="cyan" variant="light"><Map size={14} /></ThemeIcon><Text fw={600}>Participating Cities</Text></Group>
                <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }}>
                    {CITIES.map((city) => (
                        <Box key={city} p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8, textAlign: 'center' }}>
                            <Text size="sm" fw={500}>{city}</Text>
                            <Text size="xs" c="dimmed">~{Math.round(11_000 * scale).toLocaleString()} users</Text>
                        </Box>
                    ))}
                </SimpleGrid>
            </Card>

            {/* Instructions */}
            <Card withBorder>
                <Group mb="xs"><ThemeIcon size={28} radius="sm" color="orange" variant="light"><Activity size={14} /></ThemeIcon><Text fw={600}>How it works</Text></Group>
                <Text size="sm" c="dimmed">Runs in a background thread. Creates tenants, users, departments, and activities with GPS tracks. Monitor progress in the log above.</Text>
                <Group mt="sm" gap="lg">
                    <Box><Badge color="green" variant="light" mb={4}>1% scale</Badge><Text size="xs" c="dimmed">~1,100 users / 30s</Text></Box>
                    <Box><Badge color="yellow" variant="light" mb={4}>10% scale</Badge><Text size="xs" c="dimmed">~11,000 users / 5 min</Text></Box>
                    <Box><Badge color="red" variant="light" mb={4}>100% scale</Badge><Text size="xs" c="dimmed">~110,000 users / 30 min</Text></Box>
                </Group>
            </Card>
        </Box>
    );
};
