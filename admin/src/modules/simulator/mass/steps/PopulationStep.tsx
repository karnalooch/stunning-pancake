import React from 'react';
import {
    Alert, Button, Checkbox, Group, NumberInput, Stack, Text,
} from '@mantine/core';
import { ArrowRight, Bike, Users, AlertTriangle } from 'lucide-react';
import type { UseFormReturnType } from '@mantine/form';
import type { MassFormValues } from '../massSimForm';

interface PopulationStepProps {
    form: UseFormReturnType<MassFormValues>;
    scaleReport: Record<string, unknown> | null;
    preflightLoading: boolean;
    onPreflight: () => void;
    onApply300k: () => void;
    onNext: () => void;
}

export const PopulationStep: React.FC<PopulationStepProps> = ({
    form,
    scaleReport,
    preflightLoading,
    onPreflight,
    onApply300k,
    onNext,
}) => (
    <Stack gap="lg" mt="xl" style={{ maxWidth: 600 }}>
        <Alert color="indigo" icon={<Users size={18} />} title="Cycling Population Setup">
            <Text size="sm">
                Choose how many cyclists should exist in your Smart City database.
                These users will be dynamically generated across various municipalities.
            </Text>
        </Alert>

        <Group gap="xs">
            <Button variant="light" size="xs" onClick={onApply300k}>
                Preset: 300k (bez aktywności)
            </Button>
            <Button variant="light" size="xs" loading={preflightLoading} onClick={onPreflight}>
                Analiza ryzyka
            </Button>
        </Group>

        <NumberInput
            label="Number of Cyclists to Generate"
            description="Do 350k — przy >150k aktywności historyczne są wyłączane automatycznie"
            value={form.values.cyclists}
            onChange={(v) => form.setFieldValue('cyclists', Number(v) || 100)}
            min={10}
            max={350000}
            step={1000}
            leftSection={<Bike size={16} />}
            size="md"
            error={form.errors.cyclists}
        />

        {scaleReport && (
            <Alert color="orange" icon={<AlertTriangle size={18} />} title="Scale preflight">
                <Text size="sm" mb="xs">
                    Pula: {(scaleReport.target_users as number)?.toLocaleString()} · jednocześnie na mapie max{' '}
                    {(scaleReport.estimated_concurrent_riders as number)?.toLocaleString()}
                </Text>
                {Boolean(scaleReport.batch_plan) && (
                    <Text size="sm" mb="xs" c="dimmed">
                        Batch: {(scaleReport.batch_plan as { num_cities: number }).num_cities} miast ×{' '}
                        {(scaleReport.batch_plan as { users_per_city: number }).users_per_city?.toLocaleString()} użytk./miasto
                    </Text>
                )}
                <Stack gap={4}>
                    {((scaleReport.risks as Array<{ severity: string; title: string; detail: string }>) || [])
                        .filter((r) => r.severity !== 'resolved')
                        .slice(0, 5)
                        .map((r, i) => (
                            <Text key={i} size="xs">[{r.severity}] {r.title}: {r.detail}</Text>
                        ))}
                </Stack>
            </Alert>
        )}

        <Checkbox
            label="Generate historical GPS-tracked activities"
            description="Populates the database with realistic completed rides of varying coordinates"
            checked={form.values.generateActivities}
            onChange={(e) => form.setFieldValue('generateActivities', e.currentTarget.checked)}
            size="md"
        />

        <Group justify="flex-end" mt="xl">
            <Button size="md" color="violet" rightSection={<ArrowRight size={16} />} onClick={onNext}>
                Next: Live Telemetry Tuning
            </Button>
        </Group>
    </Stack>
);
