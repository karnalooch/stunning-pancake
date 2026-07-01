import React from 'react';
import {
    Alert, Box, Button, Card, Checkbox, Group, SimpleGrid, Slider, Stack, Text,
} from '@mantine/core';
import { ArrowLeft, ArrowRight, Route, Zap, AlertTriangle } from 'lucide-react';
import type { UseFormReturnType } from '@mantine/form';
import type { LiveLaunchPlan } from '../../../analytics/simInfraPlanner';
import { formatRampSeconds } from '../../../analytics/simInfraPlanner';
import type { MassFormValues } from '../massSimForm';

interface LiveMapStepProps {
    form: UseFormReturnType<MassFormValues>;
    livePlan: LiveLaunchPlan | null;
    infraLoading: boolean;
    activeRiders: number;
    cheaters: number;
    routingBackpressure: boolean;
    onRefreshPlan: () => void;
    onBack: () => void;
    onNext: () => void;
}

export const LiveMapStep: React.FC<LiveMapStepProps> = ({
    form,
    livePlan,
    infraLoading,
    activeRiders,
    cheaters,
    routingBackpressure,
    onRefreshPlan,
    onBack,
    onNext,
}) => {
    const { liveEnabled, activePercent, cheatPercent } = form.values;

    return (
        <Stack gap="lg" mt="xl" style={{ maxWidth: 680 }}>
            <Alert color="teal" icon={<Zap size={18} />} title="Mapa na żywo — pełna przepustowość infra">
                <Text size="sm">
                    Ustawiasz tylko udział puli na mapie i cheaterów. Tick, starty/tick i routing dispatch
                    są liczone z limitów workerów Celery (simulation + routing).
                </Text>
            </Alert>

            <Checkbox
                label="Włącz symulację live na mapie"
                description="Po batchu automatycznie startuje live sim z poniższym planem"
                checked={liveEnabled}
                onChange={(e) => form.setFieldValue('liveEnabled', e.currentTarget.checked)}
                size="md"
            />

            {liveEnabled && (
                <Stack gap="md" mt="xs">
                    {routingBackpressure && (
                        <Alert color="red" icon={<AlertTriangle size={16} />} title="Backpressure routing">
                            <Text size="xs">
                                Kolejka routingu zbliża się do limitu infra — poczekaj na drain lub zmniejsz udział na mapie.
                            </Text>
                        </Alert>
                    )}

                    <Card withBorder padding="md" bg="var(--surface-secondary)">
                        <Group justify="space-between" mb="xs">
                            <Text size="sm" fw={600}>Kapasitet infra (z workerów)</Text>
                            <Button variant="subtle" size="xs" loading={infraLoading} onClick={onRefreshPlan}>
                                Odśwież
                            </Button>
                        </Group>
                        {livePlan ? (
                            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
                                <Text size="xs">Starty/tick: <b>{livePlan.infra.max_starts_per_live_tick}</b></Text>
                                <Text size="xs">Routing dispatch/tick: <b>{livePlan.infra.routing_dispatch_per_tick}</b></Text>
                                <Text size="xs">Tick: <b>{livePlan.tick_seconds}s</b></Text>
                                <Text size="xs">Kolejka routing cap: <b>{livePlan.infra.routing_queue_depth_cap ?? '∞'}</b></Text>
                                <Text size="xs">Max na mapie: <b>{livePlan.infra.max_concurrent_riders.toLocaleString()}</b></Text>
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
                            onChange={(v) => form.setFieldValue('activePercent', v)}
                            min={8}
                            max={50}
                            step={1}
                            marks={[
                                { value: 8, label: '8%' },
                                { value: 29, label: '29%' },
                                { value: 50, label: '50%' },
                            ]}
                            error={form.errors.activePercent}
                        />
                    </Box>

                    <Box>
                        <Text size="sm" fw={600} mb={4}>Cheaterzy: {cheatPercent}%</Text>
                        <Text size="xs" c="dimmed" mb="md">
                            ~{cheaters.toLocaleString()} z {activeRiders.toLocaleString()} na mapie
                        </Text>
                        <Slider
                            value={cheatPercent}
                            onChange={(v) => form.setFieldValue('cheatPercent', v)}
                            min={0}
                            max={15}
                            step={1}
                            marks={[
                                { value: 0, label: '0%' },
                                { value: 6, label: '6%' },
                                { value: 15, label: '15%' },
                            ]}
                            error={form.errors.cheatPercent}
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
                <Button variant="light" size="md" color="gray" leftSection={<ArrowLeft size={16} />} onClick={onBack}>
                    Back
                </Button>
                <Button size="md" color="violet" rightSection={<ArrowRight size={16} />} onClick={onNext}>
                    Next: Review & Launch
                </Button>
            </Group>
        </Stack>
    );
};
