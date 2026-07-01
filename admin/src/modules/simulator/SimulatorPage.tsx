import React, { useEffect, useState } from 'react';
import {
    Alert, Box, Card, Group, Stack, Switch, Tabs, Text,
} from '@mantine/core';
import { AlertCircle, AlertTriangle, Bike, ShieldCheck, Users } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { PageHeader } from '../../core/components/PageHeader';
import { useAuth } from '../../core/auth/useAuth';
import { formatApiError } from '../../api/client';
import { MassSimWizard } from './mass/MassSimWizard';
import { GarminSimWizard } from './garmin/GarminSimWizard';
import { useWizardUrlState } from './hooks/useWizardUrlState';
import {
    isAnySimActive,
    useBatchStatus,
    useGarminStatus,
    useLiveStatus,
    useSetSimDataPlane,
    useSimTarget,
} from './api/queries';

export const SimulatorPage: React.FC = () => {
    const { user } = useAuth();
    const isGlobalOwner = user?.role === 'GLOBAL_OWNER';
    const { tab, step, setTab, setStep } = useWizardUrlState();

    const { data: simTarget } = useSimTarget();
    const { data: batchStatus } = useBatchStatus();
    const { data: liveStatus } = useLiveStatus();
    const { data: garminStatus } = useGarminStatus();
    const setDataPlane = useSetSimDataPlane();

    const [prodLocalSim, setProdLocalSim] = useState(false);

    useEffect(() => {
        if (typeof simTarget?.prod_local_writes === 'boolean') {
            setProdLocalSim(simTarget.prod_local_writes);
        }
    }, [simTarget?.prod_local_writes]);

    const simLabReachable = Boolean(simTarget?.prod_local_writes)
        || simTarget?.mode === 'prod-local-sim'
        || simTarget?.mode !== 'sim-lab-proxy'
        || simTarget?.sim_lab_health?.reachable !== false;

    const canToggleDataPlane = isGlobalOwner && Boolean(simTarget?.prod_local_editable);
    const simActive = isAnySimActive(batchStatus, liveStatus, garminStatus);

    if (simActive) {
        return <Navigate to="/owner/analytics/simulator/monitor" replace />;
    }

    const onProdLocalSimChange = async (checked: boolean) => {
        try {
            const result = await setDataPlane.mutateAsync(checked ? 'production' : 'sim-lab');
            setProdLocalSim(Boolean(result.prod_local_writes));
            notifications.show({
                title: checked ? 'Symulacja na produkcji' : 'Symulacja na sim-lab',
                message: checked
                    ? 'Batch, live sim, mapa i KPI używają prod Postgres/Redis/Celery.'
                    : 'Symulator znów działa na izolowanym sim-lab.',
                color: checked ? 'orange' : 'teal',
            });
        } catch (err: unknown) {
            notifications.show({
                title: 'Nie udało się zmienić data plane',
                message: formatApiError(err, 'Wymagany GLOBAL_OWNER.'),
                color: 'red',
            });
        }
    };

    return (
        <Box p="md">
            <PageHeader
                title="🚴 Cycling Simulator"
                subtitle="Step-by-step wizard to configure, generate, and monitor live cyclists"
            />

            {simTarget?.mode === 'prod-local-sim' && (
                <Alert variant="light" color="orange" icon={<AlertTriangle size={18} />} title="Symulacja na produkcji" mb="md">
                    Batch, live sim, mapa i telemetry trafiają do <b>prod Postgres / Redis / Celery</b>.
                </Alert>
            )}
            {simTarget?.mode === 'sim-lab-proxy' && (
                <Alert variant="light" color="teal" icon={<ShieldCheck size={18} />} title="Symulacja na sim-lab" mb="md">
                    Batch, live sim i wipe działają na izolowanej infrastrukturze ({simTarget.sim_lab_label || 'sim-lab'}).
                </Alert>
            )}
            {simTarget?.prod_heavy_sim_guard && simTarget.mode !== 'sim-lab-proxy' && (
                <Alert variant="light" color="orange" icon={<AlertTriangle size={18} />} title="Ciężkie testy zablokowane na prod" mb="md">
                    Duże batch/live sim są odrzucane na tym backendzie.
                </Alert>
            )}
            {simTarget?.mode === 'sim-lab-proxy' && simTarget.sim_lab_health?.reachable === false && (
                <Alert variant="light" color="red" icon={<AlertCircle size={18} />} title="Sim-lab niedostępny" mb="md">
                    Proxy nie dociera do {simTarget.sim_lab_label || 'sim-lab'}.
                    Live sim jest zablokowany do czasu recovery.
                </Alert>
            )}

            {canToggleDataPlane && (
                <Card withBorder radius="md" p="md" mb="md">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={4} style={{ flex: 1 }}>
                            <Text fw={600}>Prawdziwe bazy produkcyjne</Text>
                            <Text size="sm" c="dimmed">
                                Włączone: symulator zapisuje do prod DB. Wyłączone: izolowany sim-lab.
                            </Text>
                        </Stack>
                        <Switch
                            checked={prodLocalSim}
                            onChange={(e) => void onProdLocalSimChange(e.currentTarget.checked)}
                            disabled={setDataPlane.isPending || (!prodLocalSim && !simLabReachable)}
                            label={prodLocalSim ? 'Prod DB' : 'Sim-lab'}
                            size="md"
                        />
                    </Group>
                </Card>
            )}

            <Tabs value={tab} onChange={(v) => setTab(v === 'garmin' ? 'garmin' : 'mass')} variant="outline" mb="md">
                <Tabs.List>
                    <Tabs.Tab value="mass" leftSection={<Users size={16} />}>
                        Masowy Symulator (Active Cities)
                    </Tabs.Tab>
                    <Tabs.Tab value="garmin" leftSection={<Bike size={16} />}>
                        Precyzyjny Kolarz Garmin (Edge 530)
                    </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="mass" pt="md">
                    <Card withBorder radius="md" p="xl">
                        <MassSimWizard step={tab === 'mass' ? step : 0} setStep={setStep} />
                    </Card>
                </Tabs.Panel>

                <Tabs.Panel value="garmin" pt="md">
                    <Card withBorder radius="md" p="xl">
                        <Text fw={700} size="lg" mb="xs">Garmin Edge 530 Simulation — Siedlce</Text>
                        <Text size="sm" c="dimmed" mb="lg">
                            Generate realistic rides around Siedlce and upload to Garmin Connect accounts.
                        </Text>
                        <GarminSimWizard step={tab === 'garmin' ? step : 0} setStep={setStep} />
                    </Card>
                </Tabs.Panel>
            </Tabs>
        </Box>
    );
};
