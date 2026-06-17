import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
    Box, Text, Card, Group, Stack, Slider, NumberInput, Button,
    Badge, ThemeIcon, SimpleGrid, Alert, ScrollArea, Checkbox, Switch,
    Modal, Divider, Stepper, TextInput, PasswordInput, Table,
} from '@mantine/core';
import { BatchProgressBar, WipeProgressBar } from './SimulationProgressBar';
import { notifications } from '@mantine/notifications';
import {
    Play, StopCircle, Bike, Trash2, AlertTriangle,
    RefreshCw, Users, Map, Activity, Zap, Loader, CheckCircle2,
    AlertCircle, ArrowRight, ArrowLeft, ShieldCheck, Database, Route,
    Upload, Gauge, Clock, Key,
} from 'lucide-react';
import {
    SimulatorApi,
    formatApiError,
    WipeStuckError,
    type SimTargetInfo,
    type WipeProgressStatus,
    type WipeTarget,
} from '../../api/client';
import {
    startLiveWithRetry,
    waitForBatchComplete,
    waitForLiveRunning,
    type LiveStartParams,
} from '../../api/simulatorBatch';
import { formatSimulatorConflict } from '../../api/simulatorConflict';
import { PageHeader } from '../../core/components/PageHeader';
import { useAuth } from '../../core/auth/useAuth';
import {
    fallbackLivePlan,
    formatRampSeconds,
    type LiveLaunchPlan,
} from './simInfraPlanner';

interface LiveStatus {
    running: boolean; elapsed_seconds: number; error: string | null;
    stuck?: boolean; live_lock_held?: boolean; pool_size?: number; active_rides?: number;
    async_routing_enabled?: boolean;
    ride_warming?: number; ride_routing?: number; ride_routed?: number; ride_active?: number;
    tick_stale?: boolean; worker_recovered_at?: number | null;
    routing_unroutable_total?: number;
    routing_queue_depth?: number;
    routing_backpressure_active?: boolean;
    dispatches_throttled?: boolean;
    max_routing_queue_depth?: number | null;
    total_users: number; active_ratio: number; cheat_ratio: number; tick_seconds: number;
    target_on_map?: number; slots_free_on_map?: number; starts_budget_last_tick?: number;
    max_pipeline_rides?: number; pipeline_capped_last_tick?: boolean;
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

const LIVE_POLL_BASE_MS = 1500;
const LIVE_POLL_MAX_MS = 15000;

const extractStartConflictMessage = (err: unknown): string =>
    formatSimulatorConflict(err, 'Start request failed');

interface GarminSimScheduleConfig {
    weekday_rides: number;
    weekday_distance_min: number;
    weekday_distance_max: number;
    weekend_distance_min: number;
    weekend_distance_max: number;
    speed_min: number;
    speed_max: number;
    weekday_start_h_min: number;
    weekday_start_h_max: number;
    weekend_start_h_min: number;
    weekend_start_h_max: number;
    start_radius_km: number;
}

interface GarminSimStatus {
    running: boolean;
    progress_pct: number;
    phase: string;
    total_rides: number;
    rides_scheduled: number;
    rides_active: number;
    rides_done: number;
    error: string | null;
    log: [string, string][];
    summary: GarminSummaryUser[];
}

interface GarminSummaryUser {
    index: number;
    username: string;
    display_name: string;
    first_name: string;
    last_name: string;
    email: string;
    user_id: number;
}

const DEFAULT_SCHEDULE: GarminSimScheduleConfig = {
    weekday_rides: 3,
    weekday_distance_min: 60,
    weekday_distance_max: 80,
    weekend_distance_min: 90,
    weekend_distance_max: 120,
    speed_min: 20,
    speed_max: 31,
    weekday_start_h_min: 14,
    weekday_start_h_max: 18,
    weekend_start_h_min: 8,
    weekend_start_h_max: 14,
    start_radius_km: 5,
};

const PL_FIRST_NAMES = [
    'Piotr', 'Krzysztof', 'Andrzej', 'Tomasz', 'Marcin', 'Michał', 'Jakub',
    'Mateusz', 'Łukasz', 'Rafał', 'Grzegorz', 'Maciej', 'Dawid', 'Adam',
    'Bartosz', 'Damian', 'Karol', 'Szymon', 'Paweł', 'Jan', 'Artur',
    'Kamil', 'Daniel', 'Sebastian', 'Mariusz', 'Robert', 'Wojciech',
    'Radosław', 'Przemysław', 'Jarosław', 'Kacper', 'Kuba',
    'Anna', 'Katarzyna', 'Magdalena', 'Agnieszka', 'Małgorzata', 'Joanna',
    'Marta', 'Natalia', 'Aleksandra', 'Monika', 'Dorota', 'Ewa', 'Karolina',
    'Paulina', 'Justyna', 'Patrycja', 'Barbara', 'Kinga', 'Izabela',
    'Weronika', 'Kamila', 'Martyna', 'Sylwia', 'Agata', 'Klaudia',
];
const PL_LAST_NAMES = [
    'Nowak', 'Kowalski', 'Wiśniewski', 'Wójcik', 'Kowalczyk', 'Kamiński',
    'Lewandowski', 'Zieliński', 'Szymański', 'Woźniak', 'Dąbrowski',
    'Kozłowski', 'Jankowski', 'Mazur', 'Kwiatkowski', 'Krawczyk',
    'Piotrowski', 'Grabowski', 'Nowakowski', 'Pawłowski', 'Michalski',
    'Nowicki', 'Adamczyk', 'Dudek', 'Zając', 'Wieczorek', 'Jabłoński',
    'Król', 'Majewski', 'Olszewski', 'Stępień', 'Jaworski', 'Malinowski',
    'Sadowski', 'Walczak', 'Baran', 'Czarnecki', 'Adamski', 'Sikora',
    'Górski', 'Borkowski', 'Rutkowski', 'Ostrowski', 'Szewczyk',
    'Tomaszewski', 'Pietrzak', 'Marciniak', 'Wróblewski', 'Zalewski',
    'Jakubowski', 'Jasiński', 'Bąk', 'Wilk', 'Duda', 'Sikorski',
    'Chmielewski', 'Przybylski', 'Kaźmierczak', 'Włodarczyk',
];

function generatePolishNames(count: number) {
    const result: Array<{ first: string; last: string; display: string }> = [];
    const used = new Set<string>();
    for (let i = 0; i < count; i++) {
        let first: string, last: string;
        do {
            first = PL_FIRST_NAMES[Math.floor(Math.random() * PL_FIRST_NAMES.length)];
            last = PL_LAST_NAMES[Math.floor(Math.random() * PL_LAST_NAMES.length)];
        } while (used.has(`${first} ${last}`));
        used.add(`${first} ${last}`);
        result.push({ first, last, display: `${first} ${last}` });
    }
    return result;
}

const GarminSimStepper: React.FC = () => {
    const [garminStep, setGarminStep] = useState(0);
    const [userCount, setUserCount] = useState(10);
    const [credentials, setCredentials] = useState<Array<{ email: string; password: string }>>(
        Array.from({ length: 10 }, (_, i) => ({ email: '', password: '' }))
    );
    const [names, setNames] = useState<Array<{ first: string; last: string; display: string }>>(
        generatePolishNames(10)
    );
    const [schedule, setSchedule] = useState<GarminSimScheduleConfig>({ ...DEFAULT_SCHEDULE });
    const [launching, setLaunching] = useState(false);
    const [status, setStatus] = useState<GarminSimStatus | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    const isRunning = status?.running ?? false;
    const totalRides = userCount * (schedule.weekday_rides + 1);

    useEffect(() => {
        setCredentials(prev => {
            const updated = [...prev];
            while (updated.length < userCount) {
                updated.push({ email: '', password: '' });
            }
            return updated.slice(0, userCount);
        });
        setNames(generatePolishNames(userCount));
    }, [userCount]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [status?.log]);

    const startPolling = useCallback(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const s = await SimulatorApi.getGarminSimulationStatus({ silent: true });
                setStatus(s);
                if (!s.running) {
                    if (pollRef.current) clearInterval(pollRef.current);
                }
            } catch { /* silent */ }
        }, 2000);
    }, []);

    useEffect(() => {
        SimulatorApi.getGarminSimulationStatus({ silent: true }).then(setStatus).catch(() => null);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    const updateCredential = (idx: number, field: 'email' | 'password', value: string) => {
        setCredentials(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const fillTestCredentials = () => {
        setCredentials(
            Array.from({ length: userCount }, (_, i) => ({
                email: `testsim${i + 1}@gmail.com`,
                password: `testpass${i + 1}`,
            }))
        );
    };

    const allCredentialsValid = credentials
        .slice(0, userCount)
        .every(c => c.email.trim() && c.password.trim());

    const handleLaunch = async () => {
        setLaunching(true);
        setGarminStep(2);
        try {
            await SimulatorApi.startGarminSimulation({
                user_count: userCount,
                credentials: credentials.slice(0, userCount),
                schedule,
                names: names.slice(0, userCount),
            });
            notifications.show({
                title: 'Garmin Simulation Started',
                message: `${userCount} users, ~${totalRides} rides`,
                color: 'teal',
            });
            startPolling();
        } catch (err: any) {
            notifications.show({
                title: 'Start Failed',
                message: formatApiError(err, 'Could not start Garmin simulation'),
                color: 'red',
            });
        }
        setLaunching(false);
    };

    const handleAbort = async () => {
        try {
            await SimulatorApi.abortGarminSimulation();
            if (pollRef.current) clearInterval(pollRef.current);
            setStatus(null);
            notifications.show({ title: 'Aborted', message: 'Garmin simulation stopped', color: 'orange' });
        } catch (err: any) {
            notifications.show({
                title: 'Abort Failed',
                message: formatApiError(err, 'Could not abort'),
                color: 'red',
            });
        }
    };

    const phaseLabel = (phase: string) => {
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
    };

    return (
        <Stepper active={garminStep} onStepClick={isRunning ? undefined : setGarminStep} breakpoint="sm" allowNextStepsSelect={false}>
            {/* STEP 1: CREDENTIALS */}
            <Stepper.Step label="Step 1" description="Garmin Accounts" icon={<Key size={16} />}>
                <Stack gap="lg" mt="xl" style={{ maxWidth: 700 }}>
                    <Alert color="indigo" icon={<Key size={18} />} title="Garmin Connect Credentials">
                        <Text size="sm">
                            Enter login and password for each Garmin Connect account.
                            Credentials are encrypted at rest (Fernet) and used only for uploading activities.
                        </Text>
                    </Alert>

                    <NumberInput
                        label="Number of Users"
                        description="1–20 athletes"
                        value={userCount}
                        onChange={(v) => setUserCount(Math.max(1, Math.min(50, Number(v) || 1)))}
                        min={1} max={50}
                        leftSection={<Users size={16} />}
                        size="md"
                    />

                    <Group gap="xs">
                        <Button variant="light" size="xs" onClick={fillTestCredentials}>
                            Fill test credentials
                        </Button>
                        <Button variant="light" size="xs" onClick={() => setNames(generatePolishNames(userCount))}>
                            Regenerate names
                        </Button>
                        <Button variant="light" size="xs" color="teal"
                            onClick={async () => {
                                try {
                                    const res = await SimulatorApi.generateGarminEmails({
                                        count: userCount,
                                        names: names.slice(0, userCount),
                                    });
                                    setCredentials(res.emails.map(e => ({ email: e.email, password: e.password })));
                                    notifications.show({
                                        title: 'Emails generated',
                                        message: `${userCount} email accounts created`,
                                        color: 'teal',
                                    });
                                } catch (err: any) {
                                    notifications.show({
                                        title: 'Generation failed',
                                        message: formatApiError(err, 'Could not generate emails'),
                                        color: 'red',
                                    });
                                }
                            }}>
                            Generate emails
                        </Button>
                    </Group>

                    <ScrollArea h={320}>
                        <Table striped highlightOnHover fontSize="xs">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>#</Table.Th>
                                    <Table.Th>Name</Table.Th>
                                    <Table.Th>Garmin Email</Table.Th>
                                    <Table.Th>Password</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {Array.from({ length: userCount }, (_, i) => (
                                    <Table.Tr key={i}>
                                        <Table.Td>{i + 1}</Table.Td>
                                        <Table.Td>
                                            <Text size="xs" fw={500}>{names[i]?.display || `User ${i + 1}`}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <TextInput
                                                size="xs"
                                                placeholder={`sim${i + 1}@gmail.com`}
                                                value={credentials[i]?.email || ''}
                                                onChange={(e) => updateCredential(i, 'email', e.target.value)}
                                            />
                                        </Table.Td>
                                        <Table.Td>
                                            <PasswordInput
                                                size="xs"
                                                placeholder="password"
                                                value={credentials[i]?.password || ''}
                                                onChange={(e) => updateCredential(i, 'password', e.target.value)}
                                            />
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </ScrollArea>

                    <Group justify="flex-end" mt="xl">
                        <Button
                            size="md" color="violet" rightSection={<ArrowRight size={16} />}
                            disabled={!allCredentialsValid}
                            onClick={() => setGarminStep(1)}
                        >
                            Next: Schedule
                        </Button>
                    </Group>
                </Stack>
            </Stepper.Step>

            {/* STEP 2: SCHEDULE */}
            <Stepper.Step label="Step 2" description="Ride Schedule" icon={<Clock size={16} />}>
                <Stack gap="lg" mt="xl" style={{ maxWidth: 700 }}>
                    <Alert color="teal" icon={<Clock size={18} />} title="Ride Schedule Configuration">
                        <Text size="sm">
                            Define riding patterns. Defaults match typical amateur cyclist behavior around Siedlce.
                        </Text>
                    </Alert>

                    <SimpleGrid cols={2} spacing="md">
                        <Card withBorder padding="xs" bg="var(--surface-secondary)">
                            <Text size="sm" fw={600} mb={4}>Weekday Rides (Mon–Fri)</Text>
                            <Text size="xs" c="dimmed" mb="xs">Randomly picks {schedule.weekday_rides} days</Text>
                            <Text size="xs">Rides per week:</Text>
                            <Slider
                                value={schedule.weekday_rides}
                                onChange={(v) => setSchedule(s => ({ ...s, weekday_rides: v }))}
                                min={1} max={5} step={1} mb="xs"
                                marks={[{ value: 1, label: '1' }, { value: 3, label: '3' }, { value: 5, label: '5' }]}
                            />
                            <Text size="xs">Distance: {schedule.weekday_distance_min}–{schedule.weekday_distance_max} km</Text>
                        </Card>

                        <Card withBorder padding="xs" bg="var(--surface-secondary)">
                            <Text size="sm" fw={600} mb={4}>Weekend Ride</Text>
                            <Text size="xs" c="dimmed" mb="xs">1 ride on Sat or Sun</Text>
                            <Text size="xs">Distance: {schedule.weekend_distance_min}–{schedule.weekend_distance_max} km</Text>
                            <Group gap="xs" mt="xs" wrap="nowrap">
                                <NumberInput size="xs" label="Min" value={schedule.weekend_distance_min}
                                    onChange={(v) => setSchedule(s => ({ ...s, weekend_distance_min: Number(v) || 90 }))}
                                    min={50} max={200} w={80} />
                                <NumberInput size="xs" label="Max" value={schedule.weekend_distance_max}
                                    onChange={(v) => setSchedule(s => ({ ...s, weekend_distance_max: Number(v) || 120 }))}
                                    min={50} max={200} w={80} />
                            </Group>
                        </Card>
                    </SimpleGrid>

                    <Card withBorder padding="md" bg="var(--surface-secondary)">
                        <Text size="sm" fw={600} mb="xs">Speed Range</Text>
                        <Slider
                            value={schedule.speed_min}
                            onChange={(v) => setSchedule(s => ({ ...s, speed_min: v }))}
                            min={10} max={40} step={1}
                            marks={[{ value: 20, label: '20' }, { value: 31, label: '31' }]}
                            mb={4}
                        />
                        <Text size="xs" c="dimmed">{schedule.speed_min}–{schedule.speed_max} km/h</Text>
                        <Slider
                            value={schedule.speed_max}
                            onChange={(v) => setSchedule(s => ({ ...s, speed_max: v }))}
                            min={10} max={40} step={1}
                            mb="xs"
                        />
                    </Card>

                    <SimpleGrid cols={2} spacing="md">
                        <Card withBorder padding="xs" bg="var(--surface-secondary)">
                            <Text size="sm" fw={600} mb={4}>Weekday Start</Text>
                            <Text size="xs" c="dimmed">{schedule.weekday_start_h_min}:00 – {schedule.weekday_start_h_max}:00</Text>
                        </Card>
                        <Card withBorder padding="xs" bg="var(--surface-secondary)">
                            <Text size="sm" fw={600} mb={4}>Weekend Start</Text>
                            <Text size="xs" c="dimmed">{schedule.weekend_start_h_min}:00 – {schedule.weekend_start_h_max}:00</Text>
                        </Card>
                    </SimpleGrid>

                    <Card withBorder padding="xs" bg="var(--surface-surface)">
                        <Text size="sm" fw={600} mb={4}>Start Radius from Siedlce Center</Text>
                        <Text size="xs" c="dimmed">{schedule.start_radius_km} km</Text>
                        <Slider
                            value={schedule.start_radius_km}
                            onChange={(v) => setSchedule(s => ({ ...s, start_radius_km: v }))}
                            min={1} max={15} step={1}
                            marks={[{ value: 1, label: '1' }, { value: 5, label: '5' }, { value: 10, label: '10' }]}
                        />
                    </Card>

                    <Alert color="indigo" icon={<Bike size={16} />} title="Summary">
                        <Text size="sm">
                            {userCount} athletes × {(schedule.weekday_rides + 1)} rides = <b>{totalRides} rides</b> total
                        </Text>
                    </Alert>

                    <Group justify="space-between" mt="xl">
                        <Button variant="default" leftSection={<ArrowLeft size={16} />} onClick={() => setGarminStep(0)}>
                            Back
                        </Button>
                        <Button size="md" color="teal" rightSection={<Upload size={16} />} onClick={handleLaunch} loading={launching}>
                            Launch Garmin Simulation
                        </Button>
                    </Group>
                </Stack>
            </Stepper.Step>

            {/* STEP 3: MONITORING */}
            <Stepper.Step label="Step 3" description="Progress" icon={<Gauge size={16} />}>
                <Stack gap="lg" mt="xl" style={{ maxWidth: 700 }}>
                    <Alert
                        color={isRunning ? 'teal' : status?.phase === 'complete' ? 'green' : status?.error ? 'red' : 'gray'}
                        icon={isRunning ? <Loader size={16} /> : status?.phase === 'complete' ? <CheckCircle2 size={16} /> : <Activity size={16} />}
                        title={phaseLabel(status?.phase || 'idle')}
                    >
                        <Stack gap={4}>
                            <Text size="sm">
                                {status ? `${status.rides_done} / ${status.total_rides} rides done (${status.progress_pct.toFixed(0)}%)` : 'Not started'}
                            </Text>
                            {status ? (
                                <SimpleGrid cols={3} spacing="xs" mt={4}>
                                    <Text size="xs" c="dimmed">Scheduled: <b>{status.rides_scheduled ?? 0}</b></Text>
                                    <Text size="xs" c="teal.7">Active now: <b>{status.rides_active ?? 0}</b></Text>
                                    <Text size="xs" c="green.7">Done: <b>{status.rides_done ?? 0}</b></Text>
                                </SimpleGrid>
                            ) : null}
                        </Stack>
                    </Alert>

                    {isRunning && (
                        <Box style={{ background: 'var(--surface-secondary)', borderRadius: 8, overflow: 'hidden', height: 12 }}>
                            <Box style={{
                                width: `${Math.min(100, status?.progress_pct ?? 0)}%`,
                                height: '100%',
                                background: 'var(--mantine-color-teal-6)',
                                transition: 'width 0.5s ease',
                                borderRadius: 8,
                            }} />
                        </Box>
                    )}

                    {/* User Summary — persists after completion */}
                    {(status?.summary?.length ?? 0) > 0 && (
                        <>
                            <Card withBorder padding="md" bg="var(--surface-secondary)">
                                <Group justify="space-between" mb="xs">
                                    <Text size="sm" fw={600}>Registered Users</Text>
                                    <Button variant="subtle" size="xs" color="red"
                                        onClick={async () => {
                                            await SimulatorApi.clearGarminSummary();
                                            setStatus(prev => prev ? { ...prev, summary: [] } : null);
                                        }}>
                                        Clear Summary
                                    </Button>
                                </Group>
                                <ScrollArea h={180}>
                                    <Table fontSize="xs" striped highlightOnHover>
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th>#</Table.Th>
                                                <Table.Th>Name</Table.Th>
                                                <Table.Th>Email</Table.Th>
                                                <Table.Th>Password</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {status.summary.map((u) => {
                                                const pwd = credentials[u.index - 1]?.password || '';
                                                return (
                                                    <Table.Tr key={u.index}>
                                                        <Table.Td>{u.index}</Table.Td>
                                                        <Table.Td><Text fw={500}>{u.display_name}</Text></Table.Td>
                                                        <Table.Td><Text ff="monospace">{u.email}</Text></Table.Td>
                                                        <Table.Td>{pwd ? '•'.repeat(Math.min(8, pwd.length)) : '—'}</Table.Td>
                                                    </Table.Tr>
                                                );
                                            })}
                                        </Table.Tbody>
                                    </Table>
                                </ScrollArea>
                            </Card>
                        </>
                    )}

                    {(status?.log?.length ?? 0) > 0 && (
                        <ScrollArea h={200} style={{
                            background: '#0d1117', borderRadius: 8, padding: 12,
                            fontFamily: 'monospace',
                        }}>
                            {status?.log?.map(([ts, msg], i) => {
                                const isErr = msg.toLowerCase().includes('error');
                                return (
                                    <Text key={i} size="2xs"
                                        style={{ color: isErr ? '#f85149' : '#8b949e', lineHeight: 1.5 }}>
                                        <Text span c="dimmed" size="2xs">[{ts}]</Text> {msg}
                                    </Text>
                                );
                            })}
                            <div ref={logEndRef} />
                        </ScrollArea>
                    )}

                    <Group justify="space-between" mt="xl">
                        <Button variant="default" leftSection={<ArrowLeft size={16} />}
                            disabled={isRunning}
                            onClick={() => setGarminStep(1)}>
                            Back to Config
                        </Button>
                        {isRunning ? (
                            <Button color="red" leftSection={<StopCircle size={16} />} onClick={handleAbort}>
                                Stop Simulation
                            </Button>
                        ) : (
                            <Button size="md" color="teal" rightSection={<Upload size={16} />}
                                onClick={handleLaunch} loading={launching}
                                disabled={status?.phase === 'complete'}>
                                {status?.phase === 'complete' ? 'Done' : 'Run Again'}
                            </Button>
                        )}
                    </Group>
                </Stack>
            </Stepper.Step>
        </Stepper>
    );
};

export const SimulatorPage: React.FC = () => {
    const { user } = useAuth();
    const isGlobalOwner = user?.role === 'GLOBAL_OWNER';
    const [activeStep, setActiveStep] = useState(0);

    const [cyclists, setCyclists] = useState<number>(1000);
    const [generateActivities, setGenerateActivities] = useState(true);
    const [activePercent, setActivePercent] = useState(29);
    const [cheatPercent, setCheatPercent] = useState(6);
    const [liveEnabled, setLiveEnabled] = useState(true);
    const [livePlan, setLivePlan] = useState<LiveLaunchPlan | null>(null);
    const [infraLoading, setInfraLoading] = useState(false);

    const activeRatio = (livePlan?.active_ratio ?? activePercent / 100);
    const cheatRatio = (livePlan?.cheat_ratio ?? cheatPercent / 100);
    const tickSeconds = livePlan?.tick_seconds ?? 4;

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
    const [simTarget, setSimTarget] = useState<SimTargetInfo | null>(null);
    const [prodLocalSim, setProdLocalSim] = useState(false);
    const [dataPlaneLoading, setDataPlaneLoading] = useState(false);
    const [lastLiveError, setLastLiveError] = useState<string | null>(null);
    const [startingLiveOnly, setStartingLiveOnly] = useState(false);

    const environmentLabel = useMemo(
        () => (import.meta.env.DEV ? 'DEVELOPMENT' : 'PRODUCTION'),
        [],
    );

    const wipeTarget: WipeTarget =
        simTarget?.prod_local_writes || simTarget?.mode === 'prod-local-sim' || simTarget?.mode === 'local'
            ? 'prod-local'
            : 'sim-lab';

    const requiredWipePhrase = useMemo(
        () => `DELETE ALL DATA — ${environmentLabel} — GLOBAL_OWNER`,
        [environmentLabel],
    );

    const batchPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const livePollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const livePollDelayRef = useRef(LIVE_POLL_BASE_MS);
    const livePollFailuresRef = useRef(0);
    const logEndRef = useRef<HTMLDivElement>(null);

    const simLabReachable = Boolean(simTarget?.prod_local_writes)
        || simTarget?.mode === 'prod-local-sim'
        || simTarget?.mode !== 'sim-lab-proxy'
        || simTarget?.sim_lab_health?.reachable !== false;
    const liveStartBlocked = liveEnabled && !simLabReachable;

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
    const warmingStuckOnMap = isLiveRunning
        && (liveStatus?.currently_riding ?? 0) === 0
        && (liveStatus?.ride_warming ?? 0) > 0;
    const showSimControls = anyRunning || isStuck || hasOrphanedLive;
    const showBatchProgress = launching || isBatchRunning || (batchStatus && batchStatus.progress_pct > 0 && batchStatus.progress_pct < 100);
    const batchCompleteReady = !isBatchRunning && !launching
        && (batchStatus?.current_phase || '').toLowerCase() === 'complete'
        && (batchStatus?.users_created ?? 0) > 0;
    const canStartLiveOnly = liveEnabled && batchCompleteReady && !isLiveRunning && !liveStartBlocked;

    const activeRiders = livePlan?.target_on_map ?? Math.round(cyclists * activeRatio);
    const cheaters = Math.round(activeRiders * cheatRatio);
    const estActivities = generateActivities ? Math.round(cyclists * 2) : 0;
    const FORCE_SKIP_ACTIVITIES_ABOVE = 150_000;

    const refreshSimTarget = useCallback(() => {
        SimulatorApi.getSimTarget()
            .then((info) => {
                setSimTarget(info);
                if (typeof info.prod_local_writes === 'boolean') {
                    setProdLocalSim(info.prod_local_writes);
                }
            })
            .catch(() => setSimTarget(null));
    }, []);

    const buildLiveStartParams = useCallback((): LiveStartParams => {
        const plan = livePlan ?? fallbackLivePlan(cyclists, activePercent, cheatPercent);
        return {
            pool_pct: plan.pool_pct,
            active_ratio: plan.active_ratio,
            cheat_ratio: plan.cheat_ratio,
            tick_seconds: plan.tick_seconds,
            scale_overrides: plan.scale_overrides,
        };
    }, [livePlan, cyclists, activePercent, cheatPercent]);

    const runLiveStart = useCallback(async (source: 'launch' | 'manual') => {
        setLastLiveError(null);
        if (!simLabReachable) {
            const msg = 'Sim-lab is unreachable. Enable Prod DB or wait for sim-lab recovery.';
            setLastLiveError(msg);
            notifications.show({ title: 'Live sim blocked', message: msg, color: 'orange' });
            return false;
        }
        try {
            await startLiveWithRetry(buildLiveStartParams());
            notifications.show({
                title: 'Live Simulation Started',
                message: `${activeRiders.toLocaleString()} riders target on map`,
                color: 'teal',
            });
            return true;
        } catch (err: unknown) {
            if ((err as { response?: { status?: number } })?.response?.status === 503) {
                refreshSimTarget();
            }
            const msg = extractStartConflictMessage(err);
            setLastLiveError(msg);
            notifications.show({
                title: source === 'manual' ? 'Start Live Failed' : 'Live Sim Error',
                message: msg,
                color: 'orange',
            });
            return false;
        }
    }, [simLabReachable, buildLiveStartParams, activeRiders, refreshSimTarget]);

    const canToggleDataPlane = isGlobalOwner && Boolean(simTarget?.prod_local_editable);

    const onProdLocalSimChange = async (checked: boolean) => {
        setDataPlaneLoading(true);
        try {
            const result = await SimulatorApi.setSimDataPlane(checked ? 'production' : 'sim-lab');
            setProdLocalSim(Boolean(result.prod_local_writes));
            refreshSimTarget();
            notifications.show({
                title: checked ? 'Symulacja na produkcji' : 'Symulacja na sim-lab',
                message: checked
                    ? 'Batch, live sim, mapa i KPI używają prod Postgres/Redis/Celery — jak prawdziwi użytkownicy.'
                    : 'Symulator znów działa na izolowanym 4velo-sim-lab (bez obciążania prod DB).',
                color: checked ? 'orange' : 'teal',
            });
        } catch (err: unknown) {
            notifications.show({
                title: 'Nie udało się zmienić data plane',
                message: formatApiError(err, 'Wymagany GLOBAL_OWNER.'),
                color: 'red',
            });
        } finally {
            setDataPlaneLoading(false);
        }
    };

    useEffect(() => {
        refreshSimTarget();
        const timer = window.setInterval(refreshSimTarget, 30_000);
        return () => window.clearInterval(timer);
    }, [refreshSimTarget]);

    useEffect(() => {
        if (cyclists >= FORCE_SKIP_ACTIVITIES_ABOVE && generateActivities) {
            setGenerateActivities(false);
        }
    }, [cyclists, generateActivities]);

    const refreshLivePlan = useCallback(async () => {
        setInfraLoading(true);
        const ratio = activePercent / 100;
        const cheat = cheatPercent / 100;
        try {
            const data = await SimulatorApi.getSimCapacity({
                target_users: cyclists,
                active_ratio: ratio,
                cheat_ratio: cheat,
            });
            if (data?.live_launch_plan) {
                setLivePlan(data.live_launch_plan as LiveLaunchPlan);
            } else {
                setLivePlan(fallbackLivePlan(cyclists, activePercent, cheatPercent));
            }
        } catch {
            setLivePlan(fallbackLivePlan(cyclists, activePercent, cheatPercent));
        }
        setInfraLoading(false);
    }, [cyclists, activePercent, cheatPercent]);

    useEffect(() => {
        if (activeStep >= 1 && liveEnabled) {
            refreshLivePlan();
        }
    }, [activeStep, liveEnabled, refreshLivePlan]);

    const runPreflight = async () => {
        setPreflightLoading(true);
        try {
            const report = await SimulatorApi.getScalePreflight({
                target_users: cyclists,
                active_ratio: activePercent / 100,
                cheat_ratio: cheatPercent / 100,
                skip_activities: !generateActivities,
            });
            setScaleReport(report);
            if (report?.live_launch_plan) {
                setLivePlan(report.live_launch_plan as LiveLaunchPlan);
            }
        } catch (err: any) {
            notifications.show({ title: 'Preflight failed', message: err?.message || 'Error', color: 'red' });
        }
        setPreflightLoading(false);
    };

    const applyScale300k = () => {
        setCyclists(300_000);
        setGenerateActivities(false);
        setActivePercent(17);
        setCheatPercent(5);
        setScaleReport(null);
    };

    const scheduleLivePoll = useCallback(() => {
        if (livePollTimerRef.current) clearTimeout(livePollTimerRef.current);
        livePollTimerRef.current = setTimeout(async () => {
            try {
                const d = await SimulatorApi.getLiveStatus({ silent: true, light: true });
                setLiveStatus(d);
                livePollFailuresRef.current = 0;
                livePollDelayRef.current = LIVE_POLL_BASE_MS;
            } catch (err: unknown) {
                livePollFailuresRef.current += 1;
                const status = (err as { response?: { status?: number } })?.response?.status;
                if (status === 503) {
                    livePollDelayRef.current = Math.min(LIVE_POLL_MAX_MS, 10_000);
                    refreshSimTarget();
                } else {
                    livePollDelayRef.current = Math.min(
                        LIVE_POLL_MAX_MS,
                        LIVE_POLL_BASE_MS * 2 ** livePollFailuresRef.current,
                    );
                }
            }
            scheduleLivePoll();
        }, livePollDelayRef.current);
    }, [refreshSimTarget]);

    const startPolling = useCallback(() => {
        if (batchPollRef.current) clearInterval(batchPollRef.current);
        if (livePollTimerRef.current) clearTimeout(livePollTimerRef.current);

        batchPollRef.current = setInterval(async () => {
            try { const d = await SimulatorApi.getBatchStatus({ silent: true }); setBatchStatus(d); } catch {}
        }, 2000);
        livePollDelayRef.current = LIVE_POLL_BASE_MS;
        livePollFailuresRef.current = 0;
        scheduleLivePoll();
    }, [scheduleLivePoll]);

    useEffect(() => {
        (async () => {
            const [bs, ls, ws] = await Promise.all([
                SimulatorApi.getBatchStatus().catch(() => null),
                SimulatorApi.getLiveStatus({ light: true }).catch(() => null),
                SimulatorApi.getWipeStatus(wipeTarget).catch(() => null),
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
            if (livePollTimerRef.current) clearTimeout(livePollTimerRef.current);
        };
    }, [startPolling, wipeTarget]);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [batchStatus?.log, liveStatus?.log]);

    const handleLaunch = async () => {
        setLaunching(true);
        setActiveStep(2);
        setLastLiveError(null);
        const liveParams = buildLiveStartParams();
        try {
            if (isLiveRunning || hasOrphanedLive) {
                await SimulatorApi.abortLive().catch(() => null);
            }
            await SimulatorApi.startBatch({
                total_users: cyclists,
                days: 7,
                clear: true,
                skip_activities: !generateActivities,
                scale_overrides: liveEnabled ? liveParams.scale_overrides : undefined,
                auto_start_live: liveEnabled,
                pool_pct: liveParams.pool_pct,
                active_ratio: liveParams.active_ratio,
                cheat_ratio: liveParams.cheat_ratio,
                tick_seconds: liveParams.tick_seconds,
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
            const autoStarted = await waitForLiveRunning({ timeoutMs: 20_000, pollMs: 1000 });
            if (!autoStarted) {
                await runLiveStart('launch');
            }
        }
        startPolling();
    };

    const handleStartLiveOnly = async () => {
        setStartingLiveOnly(true);
        await runLiveStart('manual');
        setStartingLiveOnly(false);
        startPolling();
    };

    const refreshStatus = async () => {
        const [bs, ls] = await Promise.all([
            SimulatorApi.getBatchStatus().catch(() => null),
            SimulatorApi.getLiveStatus({ light: false }).catch(() => null),
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
            await SimulatorApi.resetSimulator(wipeTarget);
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
                    target: wipeTarget,
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
                target: wipeTarget,
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
                    target: wipeTarget,
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
            const cleared = await SimulatorApi.forceUnstickWipe(wipeTarget);
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

            {simTarget?.mode === 'prod-local-sim' && (
                <Alert variant="light" color="orange" icon={<AlertTriangle size={18} />} title="Symulacja na produkcji">
                    Batch, live sim, mapa i telemetry trafiają do <b>prod Postgres / Redis / Celery</b>.
                    Symulowani użytkownicy są traktowani jak prawdziwi. Wipe w Simulatorze czyści prod DB symulacji.
                </Alert>
            )}
            {simTarget?.mode === 'sim-lab-proxy' && (
                <Alert variant="light" color="teal" icon={<ShieldCheck size={18} />} title="Symulacja na sim-lab">
                    Batch, live sim i wipe z tej strony działają na izolowanej infrastrukturze ({simTarget.sim_lab_label || 'sim-lab'}).
                    KPI na dashboardzie są federowane z sim-lab. Prod DB nietknięty.
                </Alert>
            )}
            {simTarget?.prod_heavy_sim_guard && simTarget.mode !== 'sim-lab-proxy' && (
                <Alert variant="light" color="orange" icon={<AlertTriangle size={18} />} title="Ciężkie testy zablokowane na prod">
                    Duże batch/live sim są odrzucane na tym backendzie. Włącz SIM_LAB_PROXY na backendzie prod lub użyj skryptów sim-lab.
                </Alert>
            )}
            {simTarget?.mode === 'sim-lab-proxy' && simTarget.sim_lab_health?.reachable === false && (
                <Alert variant="light" color="red" icon={<AlertCircle size={18} />} title="Sim-lab niedostępny">
                    Proxy nie dociera do {simTarget.sim_lab_label || 'sim-lab'}
                    {simTarget.sim_lab_health.error ? ` (${simTarget.sim_lab_health.error})` : ''}.
                    {simTarget.sim_lab_health.status_code === 502
                        ? ' Często to krótki restart po deployu Railway — odśwież za ~30 s.'
                        : ' Live sim jest zablokowany do czasu recovery; mapa może ładować się wolno lub być pusta.'}
                </Alert>
            )}

            {canToggleDataPlane && (
                <Card withBorder radius="md" p="md" mb="md">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={4} style={{ flex: 1 }}>
                            <Text fw={600}>Prawdziwe bazy produkcyjne</Text>
                            <Text size="sm" c="dimmed">
                                Włączone: symulator zapisuje do prod DB i endpointów (jak realni użytkownicy).
                                Wyłączone: izolowany {simTarget?.sim_lab_label || 'sim-lab'} — bez obciążania 4VELO OS.
                            </Text>
                        </Stack>
                        <Switch
                            checked={prodLocalSim}
                            onChange={(e) => onProdLocalSimChange(e.currentTarget.checked)}
                            disabled={dataPlaneLoading || (!prodLocalSim && !simLabReachable)}
                            label={prodLocalSim ? 'Prod DB' : 'Sim-lab'}
                            size="md"
                        />
                    </Group>
                </Card>
            )}

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

                    {/* STEP 2: LIVE MAP (infra-backed) */}
                    <Stepper.Step label="Step 2" description="Live Map" icon={<Zap size={16} />}>
                        <Stack gap="lg" mt="xl" style={{ maxWidth: 680 }}>
                            <Alert color="teal" icon={<Zap size={18} />} title="Mapa na żywo — pełna przepustowość infra">
                                <Text size="sm">
                                    Ustawiasz tylko udział puli na mapie i cheaterów. Tick, starty/tick i routing dispatch
                                    są liczone z limitów workerów Celery (simulation + routing) — bez abstrakcyjnych profili.
                                </Text>
                            </Alert>

                            <Checkbox
                                label="Włącz symulację live na mapie"
                                description="Po batchu automatycznie startuje live sim z poniższym planem"
                                checked={liveEnabled}
                                onChange={(e) => setLiveEnabled(e.currentTarget.checked)}
                                size="md"
                            />

                            {liveEnabled && (
                                <Stack gap="md" mt="xs">
                                    {liveStatus?.routing_backpressure_active && (
                                        <Alert color="red" icon={<AlertTriangle size={16} />} title="Backpressure routing">
                                            <Text size="xs">
                                                Kolejka routingu zbliża się do limitu infra — poczekaj na drain lub zmniejsz udział na mapie.
                                            </Text>
                                        </Alert>
                                    )}

                                    <Card withBorder padding="md" bg="var(--surface-secondary)">
                                        <Group justify="space-between" mb="xs">
                                            <Text size="sm" fw={600}>Kapasitet infra (z workerów)</Text>
                                            <Button variant="subtle" size="xs" loading={infraLoading} onClick={refreshLivePlan}>
                                                Odśwież
                                            </Button>
                                        </Group>
                                        {livePlan ? (
                                            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
                                                <Text size="xs">Starty/tick: <b>{livePlan.infra.max_starts_per_live_tick}</b></Text>
                                                <Text size="xs">Routing dispatch/tick: <b>{livePlan.infra.routing_dispatch_per_tick}</b></Text>
                                                <Text size="xs">Tick: <b>{livePlan.tick_seconds}s</b></Text>
                                                <Text size="xs">Kolejka routing cap: <b>{livePlan.infra.routing_queue_depth_cap ?? '∞'}</b></Text>
                                                <Text size="xs">Max na mapie (system): <b>{livePlan.infra.max_concurrent_riders.toLocaleString()}</b></Text>
                                                <Text size="xs">Async routing: <b>{livePlan.infra.async_routing ? 'tak' : 'nie'}</b></Text>
                                            </SimpleGrid>
                                        ) : (
                                            <Text size="xs" c="dimmed">Ładowanie limitów…</Text>
                                        )}
                                    </Card>

                                    <Box>
                                        <Text size="sm" fw={600} mb={4}>Udział puli na mapie: {activePercent}%</Text>
                                        <Text size="xs" c="dimmed" mb="md">
                                            Cel: <b>{activeRiders.toLocaleString()}</b> riderów ACTIVE
                                            · szac. ramp {formatRampSeconds(livePlan?.estimated_ramp_seconds ?? 0)}
                                        </Text>
                                        <Slider
                                            value={activePercent}
                                            onChange={setActivePercent}
                                            min={8}
                                            max={50}
                                            step={1}
                                            marks={[
                                                { value: 8, label: '8%' },
                                                { value: 29, label: '29%' },
                                                { value: 50, label: '50%' },
                                            ]}
                                        />
                                    </Box>

                                    <Box>
                                        <Text size="sm" fw={600} mb={4}>Cheaterzy: {cheatPercent}%</Text>
                                        <Text size="xs" c="dimmed" mb="md">
                                            ~{cheaters.toLocaleString()} z {activeRiders.toLocaleString()} na mapie
                                        </Text>
                                        <Slider
                                            value={cheatPercent}
                                            onChange={setCheatPercent}
                                            min={0}
                                            max={15}
                                            step={1}
                                            marks={[
                                                { value: 0, label: '0%' },
                                                { value: 6, label: '6%' },
                                                { value: 15, label: '15%' },
                                            ]}
                                        />
                                    </Box>

                                    {livePlan && (
                                        <Alert color="indigo" variant="light" icon={<Route size={16} />}>
                                            <Text size="xs">
                                                Plan launch: {livePlan.throughput.starts_per_tick} startów + do{' '}
                                                {livePlan.throughput.routes_dispatched_per_tick} route/tick co {livePlan.tick_seconds}s
                                                ({livePlan.throughput.starts_per_second}/s) → mapa w {formatRampSeconds(livePlan.estimated_ramp_seconds)}.
                                            </Text>
                                        </Alert>
                                    )}
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
                                        {liveEnabled && livePlan && (
                                            <>
                                                <Text size="sm" c="blue">• Na mapie (cel): <b>{activeRiders.toLocaleString()}</b> ({activePercent}% puli)</Text>
                                                <Text size="sm" c="red">• Cheaterzy: <b>~{cheaters.toLocaleString()}</b> ({cheatPercent}%)</Text>
                                                <Text size="sm">• Infra: tick <b>{livePlan.tick_seconds}s</b> · starts <b>{livePlan.scale_overrides.max_starts_per_live_tick}</b>/tick · routing <b>{livePlan.infra.routing_dispatch_per_tick}</b>/tick</Text>
                                                <Text size="sm" c="dimmed">• Szac. ramp: <b>{formatRampSeconds(livePlan.estimated_ramp_seconds)}</b></Text>
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
                                    {liveStartBlocked && (
                                        <Alert color="orange" variant="light" icon={<AlertTriangle size={16} />}>
                                            Live sim wyłączony do czasu powrotu sim-lab. Batch nadal możesz uruchomić z odznaczonym live.
                                        </Alert>
                                    )}
                                    {lastLiveError && !isLiveRunning && (
                                        <Alert color="red" variant="light" icon={<AlertCircle size={16} />} title="Live sim nie wystartował">
                                            <Text size="sm">{lastLiveError}</Text>
                                        </Alert>
                                    )}
                                    {canStartLiveOnly && (
                                        <Button size="md" color="teal" variant="light" fullWidth
                                            leftSection={<Play size={16} />}
                                            loading={startingLiveOnly}
                                            onClick={handleStartLiveOnly}>
                                            Start Live Sim ({activeRiders.toLocaleString()} on map)
                                        </Button>
                                    )}
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
                                        {isLiveRunning && liveStatus?.tick_stale && (
                                            <Badge variant="filled" color="red" title="live_tick_task not progressing">
                                                Tick stalled
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

                                {warmingStuckOnMap && (
                                    <Alert color="orange" variant="light" icon={<AlertTriangle size={16} />} mb="md" title="Warming bez riderów na mapie">
                                        <Text size="xs">
                                            {(liveStatus?.ride_warming ?? 0).toLocaleString()} przejazdów czeka na routing
                                            {(liveStatus?.ride_routing ?? 0) > 0 ? ` (${(liveStatus?.ride_routing ?? 0).toLocaleString()} w ROUTING)` : ''}.
                                            {liveStatus?.tick_stale
                                                ? ' Ticki się zatrzymały — self-heal restartuje worker; sprawdź celery-worker-simulation i celery-worker-routing na Railway.'
                                                : ' Jeśli liczba nie spada, sprawdź worker routing i BRouter.'}
                                        </Text>
                                    </Alert>
                                )}

                                {(anyRunning || hasOrphanedLive) ? (
                                    <SimpleGrid cols={2} spacing="xs" mb="md">
                                        <Card withBorder padding="xs" bg="var(--surface-secondary)">
                                            <Text size="2xs" c="dimmed">On map (ACTIVE)</Text>
                                            <Text fw={700} size="lg" c="blue">{liveStatus?.currently_riding?.toLocaleString() ?? '0'}</Text>
                                            {(liveStatus?.ride_warming ?? 0) > 0 && (
                                                <Text size="2xs" c="yellow.7">+{(liveStatus?.ride_warming ?? 0).toLocaleString()} warming</Text>
                                            )}
                                            {isLiveRunning && (liveStatus?.slots_free_on_map ?? 0) > 0 && (
                                                <Text size="2xs" c="teal.7">
                                                    Wolne sloty mapy: {(liveStatus?.slots_free_on_map ?? 0).toLocaleString()}
                                                    {' '}(startów/tick ≤ {(liveStatus?.starts_budget_last_tick ?? 0).toLocaleString()})
                                                </Text>
                                            )}
                                            {liveStatus?.pipeline_capped_last_tick && (
                                                <Text size="2xs" c="orange.7">Pipeline pełny — zwolnij warming lub obniż load</Text>
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
                                ) : batchCompleteReady && liveEnabled && !isLiveRunning ? (
                                    <Alert color="orange" icon={<AlertTriangle size={16} />} mb="md">
                                        <Text size="xs">
                                            Batch zakończony ({batchStatus?.users_created?.toLocaleString()} użytkowników), ale live sim nie działa.
                                            Kliknij „Start Live Sim” po lewej lub uruchom ponownie Launch.
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

            {/* ─── Garmin Siedlce Simulator ─── */}
            <Card withBorder radius="md" p="xl" mb="md" mt="md">
                <Text fw={700} size="lg" mb="xs">Garmin Edge 530 Simulation — Siedlce</Text>
                <Text size="sm" c="dimmed" mb="lg">
                    Generate realistic rides around Siedlce, export GPX files in Garmin Edge 530 format,
                    and upload them to real Garmin Connect accounts.
                </Text>
                <GarminSimStepper />
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
                title={<Text fw={700} c="red">⚠️ Wipe simulation data</Text>} centered>
                <Stack gap="md">
                    {simTarget?.mode === 'sim-lab-proxy' ? (
                        <Alert color="teal" variant="light" icon={<Database size={16} />} title="Cel: sim-lab">
                            Usuwa dane symulacji na {simTarget.sim_lab_label || 'sim-lab'}. Nie czyści KPI na dashboardzie prod.
                        </Alert>
                    ) : (
                        <Alert color="orange" variant="light" icon={<Database size={16} />} title="Cel: prod DB">
                            Usuwa lokalną bazę prod (użytkownicy, aktywności, tenanty).
                        </Alert>
                    )}
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
