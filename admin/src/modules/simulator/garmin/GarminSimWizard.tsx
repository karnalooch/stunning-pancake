import React, { useEffect } from 'react';
import { Stepper } from '@mantine/core';
import { Key, Clock, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { useWizard } from '../hooks/useWizard';
import { useGarminForm } from './garminForm';
import { CredentialsStep } from './steps/CredentialsStep';
import { ScheduleStep } from './steps/ScheduleStep';
import { GarminReviewStep } from './steps/ReviewStep';
import {
    isAnySimActive,
    useBatchStatus,
    useGarminStatus,
    useLiveStatus,
    useSimTarget,
    useStartGarmin,
} from '../api/queries';
import { saveGarminDraft } from '../utils/draftStorage';
import { formatApiError } from '../../../api/client';

const STEPS = [
    { id: 'credentials', label: 'Garmin Accounts' },
    { id: 'schedule', label: 'Ride Schedule' },
    { id: 'review', label: 'Review & Launch' },
];

interface GarminSimWizardProps {
    step: number;
    setStep: (n: number) => void;
}

export const GarminSimWizard: React.FC<GarminSimWizardProps> = ({ step, setStep }) => {
    const navigate = useNavigate();
    const { form, resizeForUserCount, validateStep, totalRides } = useGarminForm();
    const startGarmin = useStartGarmin();
    const { data: simTarget } = useSimTarget();
    const { data: garminStatus } = useGarminStatus();
    const { data: batchStatus } = useBatchStatus();
    const { data: liveStatus } = useLiveStatus();

    const conflictBlocked = isAnySimActive(batchStatus, liveStatus, garminStatus);

    const wizard = useWizard({
        steps: STEPS,
        current: step,
        setCurrent: setStep,
        values: form.values,
        validateFields: (fields) => {
            if (fields.includes('userCount')) return validateStep(0);
            return true;
        },
    });

    useEffect(() => {
        const { userCount, schedule, names, credentials } = form.values;
        saveGarminDraft({
            userCount,
            schedule,
            names: names.slice(0, userCount),
            emails: credentials.slice(0, userCount).map((c) => c.email),
        });
    }, [form.values]);

    const handleNextFromCredentials = () => {
        if (validateStep(0)) wizard.next();
    };

    const handleNextFromSchedule = () => {
        if (validateStep(1)) wizard.next();
    };

    const handleLaunch = async () => {
        if (!validateStep(0) || !validateStep(1)) return;
        const { userCount, credentials, schedule, names } = form.values;
        try {
            await startGarmin.mutateAsync({
                user_count: userCount,
                credentials: credentials.slice(0, userCount),
                schedule,
                names: names.slice(0, userCount),
            });
            notifications.show({
                title: 'Garmin Simulation Started',
                message: `${userCount} users, ~${totalRides} rides`,
                color: 'teal',
            });
            navigate('/owner/analytics/simulator/monitor');
        } catch (err: unknown) {
            notifications.show({
                title: 'Start Failed',
                message: formatApiError(err, 'Could not start Garmin simulation'),
                color: 'red',
            });
        }
    };

    const running = garminStatus?.running ?? false;

    return (
        <Stepper
            active={step}
            onStepClick={running ? undefined : setStep}
            breakpoint="sm"
            allowNextStepsSelect={false}
        >
            <Stepper.Step label="Step 1" description={STEPS[0].label} icon={<Key size={16} />}>
                <CredentialsStep
                    form={form}
                    onNext={handleNextFromCredentials}
                    resizeForUserCount={resizeForUserCount}
                />
            </Stepper.Step>
            <Stepper.Step label="Step 2" description={STEPS[1].label} icon={<Clock size={16} />}>
                <ScheduleStep
                    form={form}
                    totalRides={totalRides}
                    onBack={wizard.back}
                    onNext={handleNextFromSchedule}
                />
            </Stepper.Step>
            <Stepper.Step label="Step 3" description={STEPS[2].label} icon={<Upload size={16} />}>
                <GarminReviewStep
                    form={form}
                    totalRides={totalRides}
                    simTarget={simTarget}
                    launching={startGarmin.isPending}
                    conflictBlocked={conflictBlocked && !garminStatus?.running}
                    onBack={wizard.back}
                    onLaunch={handleLaunch}
                />
            </Stepper.Step>
        </Stepper>
    );
};
