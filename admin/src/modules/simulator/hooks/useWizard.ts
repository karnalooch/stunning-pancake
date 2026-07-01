import { useCallback, useMemo } from 'react';

export interface WizardStepDef<TValues> {
    id: string;
    label?: string;
    /** Form field paths validated when advancing forward from this step */
    fields?: string[];
    canLeave?: (values: TValues) => boolean;
}

export interface UseWizardOptions<TValues> {
    steps: WizardStepDef<TValues>[];
    current: number;
    setCurrent: (step: number) => void;
    values: TValues;
    validateFields?: (fields: string[]) => boolean;
}

export function getWizardNextIndex<TValues>({
    steps,
    current,
    values,
    validateFields,
}: Omit<UseWizardOptions<TValues>, 'setCurrent'>): number | null {
    const step = steps[current];
    const isLast = current >= steps.length - 1;
    if (!step || isLast) return null;
    if (step.fields?.length && validateFields && !validateFields(step.fields)) return null;
    if (step.canLeave && !step.canLeave(values)) return null;
    return current + 1;
}

export function useWizard<TValues>({
    steps,
    current,
    setCurrent,
    values,
    validateFields,
}: UseWizardOptions<TValues>) {
    const stepCount = steps.length;
    const isFirst = current <= 0;
    const isLast = current >= stepCount - 1;
    const step = steps[current];

    const canGoNext = useMemo(() => {
        if (!step || isLast) return false;
        if (step.canLeave && !step.canLeave(values)) return false;
        return true;
    }, [step, isLast, values]);

    const next = useCallback((): boolean => {
        const nextIndex = getWizardNextIndex({ steps, current, values, validateFields });
        if (nextIndex === null) return false;
        setCurrent(nextIndex);
        return true;
    }, [steps, current, validateFields, values, setCurrent]);

    const back = useCallback(() => {
        if (!isFirst) setCurrent(current - 1);
    }, [isFirst, current, setCurrent]);

    const goTo = useCallback(
        (target: number) => {
            const clamped = Math.max(0, Math.min(stepCount - 1, target));
            setCurrent(clamped);
        },
        [stepCount, setCurrent],
    );

    return {
        current,
        step,
        steps,
        isFirst,
        isLast,
        canGoNext,
        next,
        back,
        goTo,
    };
}
