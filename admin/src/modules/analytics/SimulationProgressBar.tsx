import React from 'react';
import { Alert, Box, Group, Progress, Text } from '@mantine/core';

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
    queued: 'W kolejce',
    quiescing: 'Zatrzymywanie symulacji',
    activities: 'Usuwanie aktywności',
    departments: 'Usuwanie działów',
    users: 'Usuwanie użytkowników',
    tenants: 'Usuwanie tenantów',
    finalizing: 'Finalizacja (owner, VACUUM)',
    error: 'Błąd',
};

function formatPhase(phase?: string, phaseLabel?: string | null) {
    if (phaseLabel) return phaseLabel;
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
    running?: boolean;
    progressPct?: number;
    phase?: string;
    phaseLabel?: string | null;
    message?: string | null;
    tablesDone?: number;
    tablesTotal?: number;
    rowsDeleted?: number;
    deleted?: Record<string, number>;
    error?: string | null;
    startedAt?: number | null;
    stuck?: boolean;
    stuckReason?: string | null;
}

export const WipeProgressBar: React.FC<WipeProgressProps> = ({
    running = true,
    progressPct = 0,
    phase,
    phaseLabel,
    message,
    tablesDone = 0,
    tablesTotal = 0,
    rowsDeleted = 0,
    deleted,
    error,
    startedAt,
    stuck = false,
    stuckReason,
}) => {
    const pct = Math.min(100, Math.max(0, progressPct));
    const elapsed = startedAt ? Math.max(0, Date.now() / 1000 - startedAt) : 0;
    const title = formatPhase(phase, phaseLabel || message);
    const showTables = tablesTotal > 0;

    return (
        <Box>
            <Group justify="space-between" mb={6} gap="xs">
                <Text size="sm" fw={600}>
                    {error ? 'Błąd czyszczenia' : title}
                </Text>
                <Text size="xs" c="dimmed">
                    {running && !error ? `${pct.toFixed(0)}%` : error ? '—' : '100%'}
                    {elapsed > 0 ? ` · ${formatElapsed(elapsed)}` : ''}
                </Text>
            </Group>
            <Progress
                value={error ? 100 : pct}
                color={error ? 'red' : 'red'}
                size="lg"
                radius="xl"
                striped={running && pct < 100 && !error}
                animated={running && pct < 100 && !error}
            />
            <Group justify="space-between" mt={6} gap="xs">
                {showTables && (
                    <Text size="xs" c="dimmed">
                        Etap: <b>{tablesDone}</b> / {tablesTotal}
                    </Text>
                )}
                {(rowsDeleted > 0 || (deleted && Object.keys(deleted).length > 0)) && (
                    <Text size="xs" c="dimmed">
                        Wiersze: <b>{(rowsDeleted || Object.values(deleted || {}).reduce((a, b) => a + b, 0)).toLocaleString()}</b>
                    </Text>
                )}
            </Group>
            {message && running && !error && (
                <Text size="xs" c="dimmed" mt={4}>{message}</Text>
            )}
            {error && (
                <Text size="xs" c="red" mt={4}>{error}</Text>
            )}
            {stuck && running && !error && (
                <Alert color="orange" variant="light" mt="sm" title="Czyszczenie zatrzymane">
                    Brak postępu przez dłuższy czas
                    {stuckReason ? ` (${stuckReason})` : ''}.
                    Panel spróbuje automatycznie zresetować blokadę i wznowić wipe.
                    Jeśli problem wraca, użyj ręcznego resetu symulatora i ponów operację.
                </Alert>
            )}
        </Box>
    );
};
