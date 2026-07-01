import { useForm } from '@mantine/form';
import { useMemo } from 'react';
import type { GarminSimScheduleConfig } from '../api/types';
import { DEFAULT_GARMIN_SCHEDULE } from '../api/types';
import { generatePolishNames } from './polishNames';
import { loadGarminDraft } from '../utils/draftStorage';

export interface GarminCredentialRow {
    email: string;
    password: string;
}

export interface GarminFormValues {
    userCount: number;
    credentials: GarminCredentialRow[];
    names: Array<{ first: string; last: string; display: string }>;
    schedule: GarminSimScheduleConfig;
}

function emptyCredentials(count: number): GarminCredentialRow[] {
    return Array.from({ length: count }, () => ({ email: '', password: '' }));
}

function buildInitialValues(): GarminFormValues {
    const draft = loadGarminDraft();
    const userCount = draft?.userCount ?? 10;
    const names = draft?.names?.length
        ? draft.names.slice(0, userCount)
        : generatePolishNames(userCount);
    const credentials = emptyCredentials(userCount);
    if (draft?.emails?.length) {
        draft.emails.slice(0, userCount).forEach((email, i) => {
            credentials[i] = { email, password: '' };
        });
    }
    return {
        userCount,
        credentials,
        names,
        schedule: draft?.schedule ?? { ...DEFAULT_GARMIN_SCHEDULE },
    };
}

export function validateGarminCredentials(values: GarminFormValues): Record<string, string> {
    const errors: Record<string, string> = {};
    for (let i = 0; i < values.userCount; i += 1) {
        const row = values.credentials[i];
        if (!row?.email?.trim()) {
            errors[`credentials.${i}.email`] = 'Email required';
        }
        if (!row?.password?.trim()) {
            errors[`credentials.${i}.password`] = 'Password required';
        }
    }
    if (values.userCount < 1 || values.userCount > 50) {
        errors.userCount = 'User count must be between 1 and 50';
    }
    return errors;
}

export function validateGarminSchedule(values: GarminFormValues): Record<string, string> {
    const errors: Record<string, string> = {};
    const s = values.schedule;
    if (s.speed_min >= s.speed_max) {
        errors['schedule.speed_max'] = 'Max speed must be greater than min speed';
    }
    if (s.weekday_distance_min > s.weekday_distance_max) {
        errors['schedule.weekday_distance_max'] = 'Invalid weekday distance range';
    }
    if (s.weekend_distance_min > s.weekend_distance_max) {
        errors['schedule.weekend_distance_max'] = 'Invalid weekend distance range';
    }
    if (s.weekday_start_h_min > s.weekday_start_h_max) {
        errors['schedule.weekday_start_h_max'] = 'Invalid weekday start hour range';
    }
    if (s.weekend_start_h_min > s.weekend_start_h_max) {
        errors['schedule.weekend_start_h_max'] = 'Invalid weekend start hour range';
    }
    return errors;
}

export function validateGarminForm(values: GarminFormValues): Record<string, string> {
    return { ...validateGarminCredentials(values), ...validateGarminSchedule(values) };
}

export const GARMIN_STEP_FIELDS: Record<number, string[]> = {
    0: ['userCount'],
    1: [],
};

export function useGarminForm() {
    const initial = useMemo(() => buildInitialValues(), []);

    const form = useForm<GarminFormValues>({
        initialValues: initial,
        validate: (values) => validateGarminForm(values),
    });

    const resizeForUserCount = (count: number) => {
        const clamped = Math.max(1, Math.min(50, count));
        const credentials = [...form.values.credentials];
        while (credentials.length < clamped) {
            credentials.push({ email: '', password: '' });
        }
        const names = generatePolishNames(clamped);
        form.setValues({
            userCount: clamped,
            credentials: credentials.slice(0, clamped),
            names,
        });
    };

    const validateStep = (step: number): boolean => {
        if (step === 0) {
            const credErrors = validateGarminCredentials(form.values);
            form.setErrors(credErrors);
            return Object.keys(credErrors).length === 0;
        }
        if (step === 1) {
            const schedErrors = validateGarminSchedule(form.values);
            form.setErrors(schedErrors);
            return Object.keys(schedErrors).length === 0;
        }
        return true;
    };

    const totalRides = form.values.userCount * (form.values.schedule.weekday_rides + 1);

    return { form, resizeForUserCount, validateStep, totalRides };
}
