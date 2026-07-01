import React from 'react';
import {
    Alert, Button, Checkbox, Group, Modal, Stack, Text,
} from '@mantine/core';
import { Database } from 'lucide-react';
import { WipeProgressBar } from '../../analytics/SimulationProgressBar';
import { SimulatorApi } from '../../../api/client';
import type { SimTargetInfo } from '../../../api/client';
import type { useWipeHandlers } from './useWipeHandlers';

type WipeState = ReturnType<typeof useWipeHandlers>;

interface WipeModalProps {
    opened: boolean;
    simTarget: SimTargetInfo | null | undefined;
    wipe: WipeState;
}

export const WipeModal: React.FC<WipeModalProps> = ({ opened, simTarget, wipe }) => {
    const {
        closeWipeModal,
        wipeConfirmPhrase,
        setWipeConfirmPhrase,
        wipeMfaAck,
        setWipeMfaAck,
        wipeStatus,
        isWipeBlocked,
        isWipeStuck,
        requiredWipePhrase,
        handleWipe,
        handleWipeRecover,
        handleWipeUnstick,
        wiping,
    } = wipe;

    return (
        <Modal
            opened={opened}
            onClose={closeWipeModal}
            closeOnClickOutside={!isWipeBlocked}
            closeOnEscape={!isWipeBlocked}
            title={<Text fw={700} c="red">⚠️ Wipe simulation data</Text>}
            centered
        >
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
                <Text size="sm" c="dimmed">Stop 1/2: Type the exact phrase (role + environment).</Text>
                <Text size="sm">
                    Type <b>exactly</b>:
                    <span style={{ fontFamily: 'monospace' }}> &quot;{requiredWipePhrase}&quot;</span>
                </Text>
                <input
                    type="text"
                    value={wipeConfirmPhrase}
                    onChange={(e) => setWipeConfirmPhrase(e.target.value)}
                    placeholder={requiredWipePhrase}
                    style={{
                        padding: '8px 12px',
                        border: '1px solid var(--mantine-color-red-6)',
                        borderRadius: 8,
                        background: 'var(--surface-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: 14,
                        width: '100%',
                        fontFamily: 'monospace',
                    }}
                />
                <Checkbox
                    checked={wipeMfaAck}
                    onChange={(e) => setWipeMfaAck(e.currentTarget.checked)}
                    label="Stop 2/2: I confirm (MFA-like checkbox) that I understand the consequences."
                />
                {(SimulatorApi.isWipeActive(wipeStatus) || wipeStatus) && (
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
                <Button
                    color="red"
                    fullWidth
                    loading={isWipeBlocked}
                    disabled={isWipeBlocked || wipeConfirmPhrase !== requiredWipePhrase || !wipeMfaAck}
                    onClick={handleWipe}
                >
                    {isWipeBlocked
                        ? `Wiping… ${(wipeStatus?.progress_pct ?? 0).toFixed(0)}%`
                        : 'Yes, Delete Everything'}
                </Button>
            </Stack>
        </Modal>
    );
};
