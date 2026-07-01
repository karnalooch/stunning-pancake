import React, { useEffect, useMemo, useState } from 'react';
import { Stepper } from '@mantine/core';
import { Users, Zap, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { useWizard } from '../hooks/useWizard';
import { useMassForm } from './massSimForm';
import { PopulationStep } from './steps/PopulationStep';
import { LiveMapStep } from './steps/LiveMapStep';
import { MassReviewStep } from './steps/ReviewStep';
import {
    isAnySimActive,
    useBatchStatus,
    useGarminStatus,
    useLiveStatus,
    useScalePreflight,
    useSimCapacity,
    useSimTarget,
    useStartBatch,
} from '../api/queries';
import { saveMassDraft } from '../utils/draftStorage';
import {
    fallbackLivePlan,
    type LiveLaunchPlan,
} from '../../analytics/simInfraPlanner';
import {
    startLiveWithRetry,
    waitForBatchComplete,
    waitForLiveRunning,
    type LiveStartParams,
} from '../../../api/simulatorBatch';
import { extractStartConflictMessage } from '../utils/conflict';
import { SimulatorApi } from '../../../api/client';

const STEPS = [
    { id: 'population', label: 'Configure Cyclists' },
    { id: 'livemap', label: 'Live Map' },
    { id: 'review', label: 'Review & Launch' },
];

interface MassSimWizardProps {
    step: number;
    setStep: (n: number) => void;
}

export const MassSimWizard: React.FC<MassSimWizardProps> = ({ step, setStep }) => {
    const navigate = useNavigate();
    const { form, validateStep, applyScale300k, enforceActivitySkip } = useMassForm();
    const { data: simTarget } = useSimTarget();
    const { data: batchStatus } = useBatchStatus();
    const { data: liveStatus } = useLiveStatus();
    const { data: garminStatus } = useGarminStatus();
    const startBatch = useStartBatch();
    const scalePreflight = useScalePreflight();

    const [livePlan, setLivePlan] = useState<LiveLaunchPlan | null>(null);
    const [scaleReport, setScaleReport] = useState<Record<string, unknown> | null>(null);
    const [launching, setLaunching] = useState(false);

    const { cyclists, generateActivities, activePercent, cheatPercent, liveEnabled } = form.values;

    const capacityParams = useMemo(
        () => ({
            target_users: cyclists,
            active_ratio: activePercent / 100,
            cheat_ratio: cheatPercent / 100,
        }),
        [cyclists, activePercent, cheatPercent],
    );

    const { data: capacityData, isFetching: infraLoading, refetch: refetchCapacity } = useSimCapacity(
        capacityParams,
        step >= 1 && liveEnabled,
    );

    useEffect(() => {
        if (capacityData?.live_launch_plan) {
            setLivePlan(capacityData.live_launch_plan as LiveLaunchPlan);
        } else if (step >= 1 && liveEnabled) {
            setLivePlan(fallbackLivePlan(cyclists, activePercent, cheatPercent));
        }
    }, [capacityData, step, liveEnabled, cyclists, activePercent, cheatPercent]);

    useEffect(() => {
        enforceActivitySkip();
    }, [cyclists, generateActivities]);

    useEffect(() => {
        saveMassDraft({
            cyclists,
            generateActivities,
            activePercent,
            cheatPercent,
            liveEnabled,
        });
    }, [cyclists, generateActivities, activePercent, cheatPercent, liveEnabled]);

    const activeRatio = livePlan?.active_ratio ?? activePercent / 100;
    const cheatRatio = livePlan?.cheat_ratio ?? cheatPercent / 100;
    const activeRiders = livePlan?.target_on_map ?? Math.round(cyclists * activeRatio);
    const cheaters = Math.round(activeRiders * cheatRatio);
    const estActivities = generateActivities ? Math.round(cyclists * 2) : 0;

    const simLabReachable = Boolean(simTarget?.prod_local_writes)
        || simTarget?.mode === 'prod-local-sim'
        || simTarget?.mode !== 'sim-lab-proxy'
        || simTarget?.sim_lab_health?.reachable !== false;
    const liveStartBlocked = liveEnabled && !simLabReachable;
    const conflictBlocked = isAnySimActive(batchStatus, liveStatus, garminStatus);

    const wizard = useWizard({
        steps: STEPS,
        current: step,
        setCurrent: setStep,
        values: form.values,
        validateFields: () => true,
    });

    const buildLiveStartParams = (): LiveStartParams => {
        const plan = livePlan ?? fallbackLivePlan(cyclists, activePercent, cheatPercent);
        return {
            pool_pct: plan.pool_pct,
            active_ratio: plan.active_ratio,
            cheat_ratio: plan.cheat_ratio,
            tick_seconds: plan.tick_seconds,
            scale_overrides: plan.scale_overrides,
        };
    };

    const handlePreflight = async () => {
        try {
            const report = await scalePreflight.mutateAsync({
                target_users: cyclists,
                active_ratio: activePercent / 100,
                cheat_ratio: cheatPercent / 100,
                skip_activities: !generateActivities,
            });
            setScaleReport(report);
            if (report?.live_launch_plan) {
                setLivePlan(report.live_launch_plan as LiveLaunchPlan);
            }
        } catch (err: unknown) {
            notifications.show({
                title: 'Preflight failed',
                message: err instanceof Error ? err.message : 'Error',
                color: 'red',
            });
        }
    };

    const handleLaunch = async () => {
        if (!validateStep(0) || !validateStep(1)) return;
        setLaunching(true);
        const liveParams = buildLiveStartParams();
        const hasOrphanedLive = !liveStatus?.running && (
            (liveStatus?.pool_size ?? 0) > 0
            || (liveStatus?.currently_riding ?? 0) > 0
            || (liveStatus?.active_rides ?? 0) > 0
        );

        try {
            if (liveStatus?.running || hasOrphanedLive) {
                await SimulatorApi.abortLive().catch(() => null);
            }
            await startBatch.mutateAsync({
                total_users: cyclists,
                days: 7,
                clear: true,
                skip_activities: !generateActivities,
                scale_overrides: liveEnabled ? liveParams.scale_overrides : undefined,
                auto_start_live: liveEnabled,
                pool_pct: liveParams.pool_pct,
                active_ratio: liveParams.active_ratio,
                cheat_ratio: liveParams.cheat_ratio,
                tick_seconds: liveParams.tick_seconds,
            });
            notifications.show({
                title: 'Generowanie…',
                message: `Tworzenie ${cyclists.toLocaleString()} użytkowników`,
                color: 'yellow',
            });
            await waitForBatchComplete();
            notifications.show({
                title: 'Cyclists Created',
                message: `${cyclists.toLocaleString()} users generated`,
                color: 'green',
            });
        } catch (err: unknown) {
            notifications.show({
                title: 'Generation Error',
                message: extractStartConflictMessage(err),
                color: 'red',
            });
            setLaunching(false);
            return;
        }

        if (liveEnabled) {
            const autoStarted = await waitForLiveRunning({ timeoutMs: 20_000, pollMs: 1000 });
            if (!autoStarted && simLabReachable) {
                try {
                    await startLiveWithRetry(liveParams);
                } catch (err: unknown) {
                    notifications.show({
                        title: 'Live Sim Error',
                        message: extractStartConflictMessage(err),
                        color: 'orange',
                    });
                }
            }
        }

        setLaunching(false);
        navigate('/owner/analytics/simulator/monitor');
    };

    const anyRunning = conflictBlocked;

    return (
        <Stepper
            active={step}
            onStepClick={anyRunning ? undefined : setStep}
            breakpoint="sm"
            allowNextStepsSelect={false}
        >
            <Stepper.Step label="Step 1" description={STEPS[0].label} icon={<Users size={16} />}>
                <PopulationStep
                    form={form}
                    scaleReport={scaleReport}
                    preflightLoading={scalePreflight.isPending}
                    onPreflight={handlePreflight}
                    onApply300k={() => {
                        applyScale300k();
                        setScaleReport(null);
                    }}
                    onNext={() => {
                        if (validateStep(0)) wizard.next();
                    }}
                />
            </Stepper.Step>
            <Stepper.Step label="Step 2" description={STEPS[1].label} icon={<Zap size={16} />}>
                <LiveMapStep
                    form={form}
                    livePlan={livePlan}
                    infraLoading={infraLoading}
                    activeRiders={activeRiders}
                    cheaters={cheaters}
                    routingBackpressure={Boolean(liveStatus?.routing_backpressure_active)}
                    onRefreshPlan={() => void refetchCapacity()}
                    onBack={wizard.back}
                    onNext={() => {
                        if (validateStep(1)) wizard.next();
                    }}
                />
            </Stepper.Step>
            <Stepper.Step label="Step 3" description={STEPS[2].label} icon={<Play size={16} />}>
                <MassReviewStep
                    form={form}
                    livePlan={livePlan}
                    activeRiders={activeRiders}
                    cheaters={cheaters}
                    estActivities={estActivities}
                    simTarget={simTarget}
                    liveStartBlocked={liveStartBlocked}
                    conflictBlocked={conflictBlocked}
                    launching={launching}
                    onBack={wizard.back}
                    onLaunch={handleLaunch}
                />
            </Stepper.Step>
        </Stepper>
    );
};
