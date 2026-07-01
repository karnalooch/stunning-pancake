import React from 'react';
import {
    Alert, Button, Card, Group, NumberInput, SimpleGrid, Slider, Stack, Text,
} from '@mantine/core';
import { ArrowLeft, ArrowRight, Bike, Clock } from 'lucide-react';
import type { UseFormReturnType } from '@mantine/form';
import type { GarminFormValues } from '../garminForm';

interface ScheduleStepProps {
    form: UseFormReturnType<GarminFormValues>;
    totalRides: number;
    onBack: () => void;
    onNext: () => void;
}

export const ScheduleStep: React.FC<ScheduleStepProps> = ({ form, totalRides, onBack, onNext }) => {
    const { userCount, schedule } = form.values;
    const setSchedule = (patch: Partial<GarminFormValues['schedule']>) => {
        form.setFieldValue('schedule', { ...schedule, ...patch });
    };

    return (
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
                        onChange={(v) => setSchedule({ weekday_rides: v })}
                        min={1}
                        max={5}
                        step={1}
                        mb="xs"
                        marks={[{ value: 1, label: '1' }, { value: 3, label: '3' }, { value: 5, label: '5' }]}
                    />
                    <Text size="xs">
                        Distance: {schedule.weekday_distance_min}–{schedule.weekday_distance_max} km
                    </Text>
                </Card>

                <Card withBorder padding="xs" bg="var(--surface-secondary)">
                    <Text size="sm" fw={600} mb={4}>Weekend Ride</Text>
                    <Text size="xs" c="dimmed" mb="xs">1 ride on Sat or Sun</Text>
                    <Text size="xs">
                        Distance: {schedule.weekend_distance_min}–{schedule.weekend_distance_max} km
                    </Text>
                    <Group gap="xs" mt="xs" wrap="nowrap">
                        <NumberInput
                            size="xs"
                            label="Min"
                            value={schedule.weekend_distance_min}
                            onChange={(v) => setSchedule({ weekend_distance_min: Number(v) || 90 })}
                            min={50}
                            max={200}
                            w={80}
                        />
                        <NumberInput
                            size="xs"
                            label="Max"
                            value={schedule.weekend_distance_max}
                            error={form.errors['schedule.weekend_distance_max']}
                            onChange={(v) => setSchedule({ weekend_distance_max: Number(v) || 120 })}
                            min={50}
                            max={200}
                            w={80}
                        />
                    </Group>
                </Card>
            </SimpleGrid>

            <Card withBorder padding="md" bg="var(--surface-secondary)">
                <Text size="sm" fw={600} mb="xs">Speed Range</Text>
                <Slider
                    value={schedule.speed_min}
                    onChange={(v) => setSchedule({ speed_min: v })}
                    min={10}
                    max={40}
                    step={1}
                    marks={[{ value: 20, label: '20' }, { value: 31, label: '31' }]}
                    mb={4}
                />
                <Text size="xs" c="dimmed">{schedule.speed_min}–{schedule.speed_max} km/h</Text>
                <Slider
                    value={schedule.speed_max}
                    onChange={(v) => setSchedule({ speed_max: v })}
                    min={10}
                    max={40}
                    step={1}
                    mb="xs"
                    error={form.errors['schedule.speed_max']}
                />
            </Card>

            <SimpleGrid cols={2} spacing="md">
                <Card withBorder padding="xs" bg="var(--surface-secondary)">
                    <Text size="sm" fw={600} mb={4}>Weekday Start</Text>
                    <Text size="xs" c="dimmed">
                        {schedule.weekday_start_h_min}:00 – {schedule.weekday_start_h_max}:00
                    </Text>
                </Card>
                <Card withBorder padding="xs" bg="var(--surface-secondary)">
                    <Text size="sm" fw={600} mb={4}>Weekend Start</Text>
                    <Text size="xs" c="dimmed">
                        {schedule.weekend_start_h_min}:00 – {schedule.weekend_start_h_max}:00
                    </Text>
                </Card>
            </SimpleGrid>

            <Card withBorder padding="xs" bg="var(--surface-surface)">
                <Text size="sm" fw={600} mb={4}>Start Radius from Siedlce Center</Text>
                <Text size="xs" c="dimmed">{schedule.start_radius_km} km</Text>
                <Slider
                    value={schedule.start_radius_km}
                    onChange={(v) => setSchedule({ start_radius_km: v })}
                    min={1}
                    max={15}
                    step={1}
                    marks={[{ value: 1, label: '1' }, { value: 5, label: '5' }, { value: 10, label: '10' }]}
                />
            </Card>

            <Alert color="indigo" icon={<Bike size={16} />} title="Summary">
                <Text size="sm">
                    {userCount} athletes × {(schedule.weekday_rides + 1)} rides = <b>{totalRides} rides</b> total
                </Text>
            </Alert>

            <Group justify="space-between" mt="xl">
                <Button variant="default" leftSection={<ArrowLeft size={16} />} onClick={onBack}>
                    Back
                </Button>
                <Button size="md" color="violet" rightSection={<ArrowRight size={16} />} onClick={onNext}>
                    Next: Review & Launch
                </Button>
            </Group>
        </Stack>
    );
};
