import React from 'react';
import { Alert, Button, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { ArrowLeft, Database, Upload } from 'lucide-react';
import type { UseFormReturnType } from '@mantine/form';
import type { SimTargetInfo } from '../../../../api/client';
import type { GarminFormValues } from '../garminForm';

interface ReviewStepProps {
    form: UseFormReturnType<GarminFormValues>;
    totalRides: number;
    simTarget: SimTargetInfo | null | undefined;
    launching: boolean;
    conflictBlocked: boolean;
    onBack: () => void;
    onLaunch: () => void;
}

export const GarminReviewStep: React.FC<ReviewStepProps> = ({
    form,
    totalRides,
    simTarget,
    launching,
    conflictBlocked,
    onBack,
    onLaunch,
}) => {
    const { userCount, schedule, names } = form.values;

    return (
        <Stack gap="lg" mt="xl" style={{ maxWidth: 700 }}>
            {simTarget?.prod_heavy_sim_guard && simTarget.mode !== 'sim-lab-proxy' && (
                <Alert color="orange" title="Heavy sim guard">
                    Garmin simulation may be blocked on this backend. Use sim-lab proxy if needed.
                </Alert>
            )}

            <Alert color="indigo" icon={<Database size={18} />} title="Review & Launch">
                <Stack gap="xs" mt="xs">
                    <Text size="sm">• Athletes: <b>{userCount}</b></Text>
                    <Text size="sm">• Total rides: <b>{totalRides}</b></Text>
                    <Text size="sm">
                        • Speed: <b>{schedule.speed_min}–{schedule.speed_max} km/h</b>
                    </Text>
                    <Text size="sm">
                        • Data plane: <b>{simTarget?.mode || 'unknown'}</b>
                    </Text>
                </Stack>
            </Alert>

            <SimpleGrid cols={2} spacing="xs">
                {names.slice(0, userCount).map((n, i) => (
                    <Text key={i} size="xs" c="dimmed">
                        {i + 1}. {n.display}
                    </Text>
                ))}
            </SimpleGrid>

            <Group justify="space-between" mt="xl">
                <Button variant="default" leftSection={<ArrowLeft size={16} />} onClick={onBack} disabled={launching}>
                    Back
                </Button>
                <Button
                    size="md"
                    color="teal"
                    rightSection={<Upload size={16} />}
                    onClick={onLaunch}
                    loading={launching}
                    disabled={conflictBlocked}
                >
                    Launch Garmin Simulation
                </Button>
            </Group>
        </Stack>
    );
};
