import { useCallback, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import {
    SimulatorApi,
    WipeStuckError,
    formatApiError,
    type WipeProgressStatus,
    type WipeTarget,
} from '../../../api/client';

export interface UseWipeHandlersOptions {
    wipeTarget: WipeTarget;
    onWipeComplete?: () => void;
}

export function useWipeHandlers({ wipeTarget, onWipeComplete }: UseWipeHandlersOptions) {
    const [wipeModalOpen, setWipeModalOpen] = useState(false);
    const [wipeConfirmPhrase, setWipeConfirmPhrase] = useState('');
    const [wipeMfaAck, setWipeMfaAck] = useState(false);
    const [wiping, setWiping] = useState(false);
    const [wipeStatus, setWipeStatus] = useState<WipeProgressStatus | null>(null);

    const isWipeActive = SimulatorApi.isWipeActive(wipeStatus);
    const isWipeBlocked = wiping || SimulatorApi.isWipeBlocked(wipeStatus);
    const isWipeStuck = Boolean(wipeStatus?.stuck) && !wiping;

    const environmentLabel = useMemo(
        () => (import.meta.env.DEV ? 'DEVELOPMENT' : 'PRODUCTION'),
        [],
    );

    const requiredWipePhrase = useMemo(
        () => `DELETE ALL DATA — ${environmentLabel} — GLOBAL_OWNER`,
        [environmentLabel],
    );

    const openWipeModal = useCallback(() => setWipeModalOpen(true), []);

    const closeWipeModal = useCallback(() => {
        if (isWipeBlocked) return;
        setWipeModalOpen(false);
        setWipeConfirmPhrase('');
        setWipeMfaAck(false);
    }, [isWipeBlocked]);

    const handleWipe = useCallback(async () => {
        setWiping(true);
        setWipeStatus({ running: true, phase: 'queued', progress_pct: 0, message: 'Starting wipe…' });
        try {
            const result = await SimulatorApi.wipeData(
                (s) => setWipeStatus(s),
                {
                    confirmPhrase: wipeConfirmPhrase,
                    mfaConfirmed: wipeMfaAck,
                    target: wipeTarget,
                },
            );
            setWipeStatus(result);
            setWipeModalOpen(false);
            setWipeConfirmPhrase('');
            setWipeMfaAck(false);
            onWipeComplete?.();
            const warn = result?.warning;
            notifications.show({
                title: 'Wipe Complete',
                message: warn || 'All simulation and activity data has been wiped.',
                color: warn ? 'yellow' : 'green',
            });
        } catch (err: unknown) {
            if (err instanceof WipeStuckError) {
                setWipeStatus(err.status);
                notifications.show({ title: 'Wipe stuck', message: err.message, color: 'orange' });
            } else {
                notifications.show({
                    title: 'Wipe failed',
                    message: formatApiError(err, 'Wipe failed'),
                    color: 'red',
                });
            }
        } finally {
            setWiping(false);
        }
    }, [wipeConfirmPhrase, wipeMfaAck, wipeTarget, onWipeComplete]);

    const handleWipeRecover = useCallback(async () => {
        setWiping(true);
        try {
            const restarted = await SimulatorApi.recoverStuckWipe({
                confirmPhrase: wipeConfirmPhrase,
                mfaConfirmed: wipeMfaAck,
                target: wipeTarget,
            });
            setWipeStatus(restarted);
            notifications.show({
                title: 'Wipe restarted',
                message: 'Simulator reset and wipe force-restarted.',
                color: 'blue',
            });
            const result = await SimulatorApi.wipeData(
                (s) => setWipeStatus(s),
                {
                    confirmPhrase: wipeConfirmPhrase,
                    mfaConfirmed: wipeMfaAck,
                    target: wipeTarget,
                },
            );
            setWipeStatus(result);
            setWipeModalOpen(false);
            setWipeConfirmPhrase('');
            setWipeMfaAck(false);
            onWipeComplete?.();
            notifications.show({
                title: 'Wipe Complete',
                message: result?.warning || 'All simulation and activity data has been wiped.',
                color: result?.warning ? 'yellow' : 'green',
            });
        } catch (err: unknown) {
            if (err instanceof WipeStuckError) {
                setWipeStatus(err.status);
            }
            notifications.show({
                title: 'Recovery failed',
                message: formatApiError(err, 'Could not recover stuck wipe.'),
                color: 'red',
            });
        } finally {
            setWiping(false);
        }
    }, [wipeConfirmPhrase, wipeMfaAck, wipeTarget, onWipeComplete]);

    const handleWipeUnstick = useCallback(async () => {
        try {
            const cleared = await SimulatorApi.forceUnstickWipe(wipeTarget);
            setWipeStatus(cleared);
            setWiping(false);
            notifications.show({
                title: 'Wipe cleared',
                message: 'Locks cleared. You can close this dialog or retry wipe.',
                color: 'teal',
            });
        } catch (err: unknown) {
            notifications.show({
                title: 'Unstick failed',
                message: formatApiError(err, 'Could not clear wipe locks.'),
                color: 'red',
            });
        }
    }, [wipeTarget]);

    return {
        wipeModalOpen,
        setWipeModalOpen,
        wipeConfirmPhrase,
        setWipeConfirmPhrase,
        wipeMfaAck,
        setWipeMfaAck,
        wiping,
        wipeStatus,
        setWipeStatus,
        isWipeActive,
        isWipeBlocked,
        isWipeStuck,
        requiredWipePhrase,
        openWipeModal,
        closeWipeModal,
        handleWipe,
        handleWipeRecover,
        handleWipeUnstick,
    };
}
