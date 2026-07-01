import React from 'react';
import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { ArrowLeft, Database, Play } from 'lucide-react';
import type { UseFormReturnType } from '@mantine/form';
import type { LiveLaunchPlan } from '../../../analytics/simInfraPlanner';
import { formatRampSeconds } from '../../../analytics/simInfraPlanner';
import type { SimTargetInfo } from '../../../../api/client';
import type { MassFormValues } from '../massSimForm';

interface ReviewStepProps {
    form: UseFormReturnType<MassFormValues>;
    livePlan: LiveLaunchPlan | null;
    activeRiders: number;
    cheaters: number;
    estActivities: number;
    simTarget: SimTargetInfo | null | undefined;
    liveStartBlocked: boolean;
    conflictBlocked: boolean;
    launching: boolean;
    onBack: () => void;
    onLaunch: () => void;
}

export const MassReviewStep: React.FC<ReviewStepProps> = ({
    form,
    livePlan,
    activeRiders,
    cheaters,
    estActivities,
    simTarget,
    liveStartBlocked,
    conflictBlocked,
    launching,
    onBack,
    onLaunch,
}) => {
    const { cyclists, generateActivities, liveEnabled, activePercent, cheatPercent } = form.values;

    return (
        <Stack gap="lg" mt="xl" style={{ maxWidth: 600 }}>
            <Alert color="indigo" icon={<Database size={18} />} title="Simulation Configuration Summary">
                <Stack gap="xs" mt="xs">
                    <Text size="sm">• Total Cyclists: <b>{cyclists.toLocaleString()}</b></Text>
                    <Text size="sm">• Historical Activities: <b>{estActivities.toLocaleString()}</b></Text>
                    <Text size="sm">• Live Ride Simulation: <b>{liveEnabled ? 'Enabled' : 'Disabled'}</b></Text>
                    <Text size="sm">• Data plane: <b>{simTarget?.mode || 'unknown'}</b></Text>
                    {liveEnabled && livePlan && (
                        <>
                            <Text size="sm" c="blue">
                                • Na mapie (cel): <b>{activeRiders.toLocaleString()}</b> ({activePercent}% puli)
                            </Text>
                            <Text size="sm" c="red">
                                • Cheaterzy: <b>~{cheaters.toLocaleString()}</b> ({cheatPercent}%)
                            </Text>
                            <Text size="sm">
                                • Infra: tick <b>{livePlan.tick_seconds}s</b> · starts{' '}
                                <b>{livePlan.scale_overrides.max_starts_per_live_tick}</b>/tick
                            </Text>
                            <Text size="sm" c="dimmed">
                                • Szac. ramp: <b>{formatRampSeconds(livePlan.estimated_ramp_seconds)}</b>
                            </Text>
                        </>
                    )}
                </Stack>
            </Alert>

            {liveStartBlocked && liveEnabled && (
                <Alert color="orange" title="Live sim blocked">
                    Sim-lab is unreachable. You can still launch batch with live disabled.
                </Alert>
            )}

            <Group justify="space-between" mt="xl">
                <Button variant="light" size="md" color="gray" leftSection={<ArrowLeft size={16} />} onClick={onBack} disabled={launching}>
                    Back
                </Button>
                <Button
                    size="lg"
                    color="violet"
                    leftSection={<Play size={18} />}
                    loading={launching}
                    disabled={conflictBlocked || (liveStartBlocked && liveEnabled)}
                    onClick={onLaunch}
                >
                    Launch {cyclists.toLocaleString()} Cyclists
                </Button>
            </Group>

            {!generateActivities && (
                <Text size="xs" c="dimmed" ta="center">
                    Historical activities skipped for this run.
                </Text>
            )}
        </Stack>
    );
};
