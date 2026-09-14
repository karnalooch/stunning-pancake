import { useForm } from '@mantine/form';
import { useMemo } from 'react';
import { loadMassDraft } from '../utils/draftStorage';

export interface MassFormValues {
    cyclists: number;
    generateActivities: boolean;
    activePercent: number;
    cheatPercent: number;
    liveEnabled: boolean;
}

export const FORCE_SKIP_ACTIVITIES_ABOVE = 150_000;

export function shouldSkipActivityGeneration(cyclists: number, generateActivities: boolean) {
    return cyclists >= FORCE_SKIP_ACTIVITIES_ABOVE && generateActivities;
}

function buildInitialValues(): MassFormValues {
    const draft = loadMassDraft();
    return {
        cyclists: draft?.cyclists ?? 1000,
        generateActivities: draft?.generateActivities ?? true,
        activePercent: draft?.activePercent ?? 29,
        cheatPercent: draft?.cheatPercent ?? 6,
        liveEnabled: draft?.liveEnabled ?? true,
    };
}

export function validateMassPopulation(values: MassFormValues): Record<string, string> {
    const errors: Record<string, string> = {};
    if (values.cyclists < 10 || values.cyclists > 350_000) {
        errors.cyclists = 'Cyclists must be between 10 and 350,000';
    }
    return errors;
}

export function validateMassLiveMap(values: MassFormValues): Record<string, string> {
    const errors: Record<string, string> = {};
    if (values.activePercent < 8 || values.activePercent > 50) {
        errors.activePercent = 'Active percent must be between 8% and 50%';
    }
    if (values.cheatPercent < 0 || values.cheatPercent > 15) {
        errors.cheatPercent = 'Cheat percent must be between 0% and 15%';
    }
    return errors;
}

export function validateMassForm(values: MassFormValues): Record<string, string> {
    return { ...validateMassPopulation(values), ...validateMassLiveMap(values) };
}

export function useMassForm() {
    const initial = useMemo(() => buildInitialValues(), []);

    const form = useForm<MassFormValues>({
        initialValues: initial,
        validate: (values) => validateMassForm(values),
    });

    const validateStep = (step: number): boolean => {
        if (step === 0) {
            const errors = validateMassPopulation(form.values);
            form.setErrors(errors);
            return Object.keys(errors).length === 0;
        }
        if (step === 1) {
            const errors = validateMassLiveMap(form.values);
            form.setErrors(errors);
            return Object.keys(errors).length === 0;
        }
        return true;
    };

    const applyScale300k = () => {
        form.setValues({
            cyclists: 300_000,
            generateActivities: false,
            activePercent: 17,
            cheatPercent: 5,
        });
    };

    return { form, validateStep, applyScale300k };
}
