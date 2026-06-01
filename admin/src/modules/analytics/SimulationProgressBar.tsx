import React from 'react';
import { Box, Group, Progress, Text } from '@mantine/core';

const PHASE_LABELS: Record<string, string> = {
    initializing: 'Inicjalizacja',
    clearing: 'Czyszczenie bazy',
    creating_tenants: 'Tworzenie miast',
    creating_admins: 'Administratorzy',
    creating_departments: 'Działy',
    creating_users: 'Użytkownicy (zawodnicy)',
    creating_activities: 'Aktywności GPS',
    generating: 'Generowanie',
    complete: 'Zakończono',
    starting: 'Start',
    idle: 'Oczekiwanie',
};

function formatPhase(phase?: string) {
    if (!phase) return 'Przetwarzanie…';
    return PHASE_LABELS[phase] || phase.replace(/_/g, ' ');
}

function formatElapsed(seconds?: number) {
    if (!seconds || seconds < 1) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

export interface BatchProgressProps {
    running: boolean;
    progressPct?: number;
    currentPhase?: string;
    usersCreated?: number;
    targetUsers?: number;
    activitiesCreated?: number;
    elapsedSeconds?: number;
    error?: string | null;
}

export const BatchProgressBar: React.FC<BatchProgressProps> = ({
    running,
    progressPct = 0,
    currentPhase,
    usersCreated = 0,
    targetUsers = 0,
    activitiesCreated = 0,
    elapsedSeconds = 0,
    error,
}) => {
    const pct = Math.min(100, Math.max(0, progressPct));
    const showCounts = targetUsers > 0 || usersCreated > 0;

    return (
        <Box mb="md">
            <Group justify="space-between" mb={6} gap="xs">
                <Text size="sm" fw={600}>
                    {running ? formatPhase(currentPhase) : error ? 'Błąd generacji' : 'Postęp batch'}
                </Text>
                <Text size="xs" c="dimmed">
                    {running ? `${pct.toFixed(0)}%` : error ? '—' : '100%'}
                    {elapsedSeconds ? ` · ${formatElapsed(elapsedSeconds)}` : ''}
                </Text>
            </Group>
            <Progress
                value={running ? pct : error ? 100 : 100}
                color={error ? 'red' : running ? 'violet' : 'green'}
                size="lg"
                radius="xl"
                striped={running && pct < 100}
                animated={running && pct < 100}
            />
            {showCounts && (
                <Group justify="space-between" mt={6} gap="xs">
                    <Text size="xs" c="dimmed">
                        Użytkownicy: <b>{usersCreated.toLocaleString()}</b>
                        {targetUsers > 0 ? ` / ${targetUsers.toLocaleString()}` : ''}
                    </Text>
                    {activitiesCreated > 0 && (
                        <Text size="xs" c="dimmed">
                            Aktywności: <b>{activitiesCreated.toLocaleString()}</b>
                        </Text>
                    )}
                </Group>
            )}
            {error && (
                <Text size="xs" c="red" mt={4}>
                    {error}
                </Text>
            )}
        </Box>
    );
};

export interface WipeProgressProps {
    progressPct: number;
    phase?: string;
}

export const WipeProgressBar: React.FC<WipeProgressProps> = ({ progressPct, phase }) => (
    <Box>
        <Group justify="space-between" mb={6}>
            <Text size="sm" fw={600}>{phase || 'Czyszczenie danych'}</Text>
            <Text size="xs" c="dimmed">{progressPct.toFixed(0)}%</Text>
        </Group>
        <Progress
            value={progressPct}
            color="red"
            size="md"
            radius="xl"
            striped={progressPct < 100}
            animated={progressPct < 100}
        />
    </Box>
);
