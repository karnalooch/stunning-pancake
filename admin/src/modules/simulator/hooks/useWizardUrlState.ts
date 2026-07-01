import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SimulatorTab } from '../api/types';

const MASS_STEPS = 3;
const GARMIN_STEPS = 3;

export function parseSimulatorTab(raw: string | null): SimulatorTab {
    return raw === 'garmin' ? 'garmin' : 'mass';
}

export function parseWizardStep(raw: string | null, max: number): number {
    const n = Number.parseInt(raw ?? '0', 10);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(max - 1, n));
}

export function useWizardUrlState() {
    const [searchParams, setSearchParams] = useSearchParams();

    const tab = useMemo(() => parseSimulatorTab(searchParams.get('tab')), [searchParams]);
    const maxSteps = tab === 'garmin' ? GARMIN_STEPS : MASS_STEPS;
    const step = useMemo(
        () => parseWizardStep(searchParams.get('step'), maxSteps),
        [searchParams, maxSteps],
    );

    const setTab = useCallback(
        (nextTab: SimulatorTab) => {
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    next.set('tab', nextTab);
                    next.set('step', '0');
                    return next;
                },
                { replace: true },
            );
        },
        [setSearchParams],
    );

    const setStep = useCallback(
        (nextStep: number) => {
            const clamped = Math.max(0, Math.min(maxSteps - 1, nextStep));
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    next.set('tab', tab);
                    next.set('step', String(clamped));
                    return next;
                },
                { replace: true },
            );
        },
        [maxSteps, setSearchParams, tab],
    );

    return { tab, step, maxSteps, setTab, setStep };
}

export { MASS_STEPS, GARMIN_STEPS };
