import React, { useState } from 'react';
import { Box, Text, Card, Group, Stack, Slider, NumberInput, Switch, Button, Badge, ThemeIcon, SimpleGrid } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Play, Settings, Map, Zap, Activity } from 'lucide-react';
import { apiClient } from '../../api/client';
import { PageHeader } from '../../core/components/PageHeader';

const CITIES = [
    "Warszawa", "Kraków", "Wrocław", "Poznań", "Gdańsk",
    "Łódź", "Lublin", "Bydgoszcz", "Katowice", "Siedlce",
];

export const SimulatorPage: React.FC = () => {
    const [scale, setScale] = useState(0.1);
    const [days, setDays] = useState<number>(30);
    const [clear, setClear] = useState(false);
    const [running, setRunning] = useState(false);

    const scaledUsers = Math.round(110_000 * scale).toLocaleString();
    const scaledActivities = Math.round(550_000 * scale).toLocaleString();
    const scaledDepts = Math.round(187 * scale);

    const handleRun = async () => {
        setRunning(true);
        try {
            await apiClient.post('/activities/admin/simulate/', {
                scale,
                days,
                clear,
            });
            notifications.show({
                title: 'Simulation Started',
                message: `Scale: ${scale}, Days: ${days}. Check Railway logs for progress.`,
                color: 'green',
            });
        } catch (err: any) {
            notifications.show({
                title: 'Error',
                message: err?.response?.data?.error || 'Failed to start simulation.',
                color: 'red',
            });
        } finally {
            setRunning(false);
        }
    };

    return (
        <Box p="md">
            <PageHeader
                title="Aktywne Miasta — Simulator"
                subtitle="Generate realistic competition data for stress-testing and demos"
            />

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="xl">
                {/* Stats preview */}
                <Card withBorder>
                    <Group mb="md">
                        <ThemeIcon size={28} radius="sm" color="indigo" variant="light">
                            <Zap size={14} />
                        </ThemeIcon>
                        <Text fw={600}>Simulation Preview</Text>
                    </Group>
                    <SimpleGrid cols={2} spacing="sm">
                        <Box p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}>
                            <Text size="xs" c="dimmed">Cities</Text>
                            <Text fw={700} size="lg">10</Text>
                        </Box>
                        <Box p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}>
                            <Text size="xs" c="dimmed">Users</Text>
                            <Text fw={700} size="lg">{scaledUsers}</Text>
                        </Box>
                        <Box p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}>
                            <Text size="xs" c="dimmed">Activities</Text>
                            <Text fw={700} size="lg">{scaledActivities}</Text>
                        </Box>
                        <Box p="sm" style={{ background: 'var(--surface-secondary)', borderRadius: 8 }}>
                            <Text size="xs" c="dimmed">Departments</Text>
                            <Text fw={700} size="lg">~{scaledDepts}</Text>
                        </Box>
                    </SimpleGrid>
                </Card>

                {/* Controls */}
                <Card withBorder>
                    <Group mb="md">
                        <ThemeIcon size={28} radius="sm" color="violet" variant="light">
                            <Settings size={14} />
                        </ThemeIcon>
                        <Text fw={600}>Simulation Controls</Text>
                    </Group>
                    <Stack gap="md">
                        <Box>
                            <Group justify="space-between" mb={4}>
                                <Text size="sm" fw={500}>Scale</Text>
                                <Badge variant="light" size="sm">{Math.round(scale * 100)}%</Badge>
                            </Group>
                            <Slider
                                value={scale}
                                onChange={setScale}
                                min={0.001}
                                max={1.0}
                                step={0.01}
                                label={(v) => `${Math.round(v * 100)}%`}
                                marks={[
                                    { value: 0.001, label: '0.1%' },
                                    { value: 0.01, label: '1%' },
                                    { value: 0.1, label: '10%' },
                                    { value: 0.5, label: '50%' },
                                    { value: 1.0, label: '100%' },
                                ]}
                            />
                        </Box>

                        <NumberInput
                            label="Competition Days"
                            value={days}
                            onChange={(v) => setDays(Number(v) || 30)}
                            min={1}
                            max={90}
                        />

                        <Switch
                            label="Clear existing simulation data first"
                            checked={clear}
                            onChange={(e) => setClear(e.currentTarget.checked)}
                        />

                        <Button
                            fullWidth
                            size="md"
                            color="violet"
                            leftSection={<Play size={16} />}
                            loading={running}
                            onClick={handleRun}
                        >
                            {running ? 'Starting Simulation...' : 'Run Simulation'}
                        </Button>
                    </Stack>
                </Card>
            </SimpleGrid>

            {/* City list */}
            <Card withBorder mb="xl">
                <Group mb="md">
                    <ThemeIcon size={28} radius="sm" color="cyan" variant="light">
                        <Map size={14} />
                    </ThemeIcon>
                    <Text fw={600}>Participating Cities</Text>
                </Group>
                <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }}>
                    {CITIES.map((city) => (
                        <Box
                            key={city}
                            p="sm"
                            style={{
                                background: 'var(--surface-secondary)',
                                borderRadius: 8,
                                textAlign: 'center',
                            }}
                        >
                            <Text size="sm" fw={500}>{city}</Text>
                            <Text size="xs" c="dimmed">~{Math.round(11_000 * scale).toLocaleString()} users</Text>
                        </Box>
                    ))}
                </SimpleGrid>
            </Card>

            {/* Instructions */}
            <Card withBorder>
                <Group mb="xs">
                    <ThemeIcon size={28} radius="sm" color="orange" variant="light">
                        <Activity size={14} />
                    </ThemeIcon>
                    <Text fw={600}>How it works</Text>
                </Group>
                <Text size="sm" c="dimmed">
                    The simulation runs in a background thread on the server. It creates tenants, users, departments,
                    and activities with realistic GPS tracks for each city. Progress is visible in Railway logs.
                </Text>
                <Group mt="sm" gap="lg">
                    <Box>
                        <Badge color="green" variant="light" mb={4}>1% scale</Badge>
                        <Text size="xs" c="dimmed">~1,100 users / ~5,000 activities / ~30s</Text>
                    </Box>
                    <Box>
                        <Badge color="yellow" variant="light" mb={4}>10% scale</Badge>
                        <Text size="xs" c="dimmed">~11,000 users / ~50,000 activities / ~5 min</Text>
                    </Box>
                    <Box>
                        <Badge color="red" variant="light" mb={4}>100% scale</Badge>
                        <Text size="xs" c="dimmed">~110,000 users / ~500,000 activities / ~30 min</Text>
                    </Box>
                </Group>
            </Card>
        </Box>
    );
};
