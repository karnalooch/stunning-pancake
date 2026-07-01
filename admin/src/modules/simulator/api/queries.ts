import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    SimulatorApi,
    type SimTargetInfo,
    type WipeProgressStatus,
    type WipeTarget,
} from '../../../api/client';
import type { LiveStartParams } from '../../../api/simulatorBatch';
import type { BatchStatus, GarminSimStatus, LiveStatus } from './types';

export const simQueryKeys = {
    all: ['sim'] as const,
    target: () => [...simQueryKeys.all, 'target'] as const,
    batch: () => [...simQueryKeys.all, 'batch-status'] as const,
    live: () => [...simQueryKeys.all, 'live-status'] as const,
    garmin: () => [...simQueryKeys.all, 'garmin-status'] as const,
    wipe: (target: WipeTarget) => [...simQueryKeys.all, 'wipe', target] as const,
    capacity: (params: { target_users: number; active_ratio: number; cheat_ratio: number }) =>
        [...simQueryKeys.all, 'capacity', params] as const,
};

import {
    batchRefetchInterval,
    garminRefetchInterval,
    liveRefetchInterval,
} from './polling';

export { batchRefetchInterval, garminRefetchInterval, liveRefetchInterval };

export function useSimTarget() {
    return useQuery({
        queryKey: simQueryKeys.target(),
        queryFn: () => SimulatorApi.getSimTarget(),
        staleTime: 15_000,
        refetchInterval: 30_000,
        refetchIntervalInBackground: false,
    });
}

export function useBatchStatus(enabled = true) {
    return useQuery({
        queryKey: simQueryKeys.batch(),
        queryFn: () => SimulatorApi.getBatchStatus({ silent: true }) as Promise<BatchStatus>,
        enabled,
        refetchInterval: (q) => batchRefetchInterval(q.state.data),
        refetchIntervalInBackground: false,
        retry: 2,
        retryDelay: (attempt) => Math.min(15_000, 1500 * 2 ** attempt),
    });
}

export function useLiveStatus(enabled = true, light = true) {
    return useQuery({
        queryKey: [...simQueryKeys.live(), light ? 'light' : 'full'],
        queryFn: () =>
            SimulatorApi.getLiveStatus({ silent: true, light }) as Promise<LiveStatus>,
        enabled,
        refetchInterval: (q) => liveRefetchInterval(q.state.data),
        refetchIntervalInBackground: false,
        retry: 2,
        retryDelay: (attempt) => Math.min(15_000, 1500 * 2 ** attempt),
    });
}

export function useGarminStatus(enabled = true) {
    return useQuery({
        queryKey: simQueryKeys.garmin(),
        queryFn: () =>
            SimulatorApi.getGarminSimulationStatus({ silent: true }) as Promise<GarminSimStatus>,
        enabled,
        refetchInterval: (q) => garminRefetchInterval(q.state.data),
        refetchIntervalInBackground: false,
        retry: 2,
        retryDelay: (attempt) => Math.min(15_000, 1500 * 2 ** attempt),
    });
}

export function useWipeStatus(target: WipeTarget, enabled = true) {
    return useQuery({
        queryKey: simQueryKeys.wipe(target),
        queryFn: () => SimulatorApi.getWipeStatus(target),
        enabled,
        refetchInterval: (q) => {
            const data = q.state.data;
            if (SimulatorApi.isWipeBlocked(data)) return 1000;
            return false;
        },
        refetchIntervalInBackground: false,
    });
}

export function useSimCapacity(
    params: { target_users: number; active_ratio: number; cheat_ratio: number },
    enabled = true,
) {
    return useQuery({
        queryKey: simQueryKeys.capacity(params),
        queryFn: () => SimulatorApi.getSimCapacity(params),
        enabled,
        staleTime: 30_000,
    });
}

export function useScalePreflight() {
    return useMutation({
        mutationFn: (params: {
            target_users: number;
            active_ratio?: number;
            cheat_ratio?: number;
            skip_activities?: boolean;
        }) => SimulatorApi.getScalePreflight(params),
    });
}

export function useSetSimDataPlane() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (target: 'production' | 'sim-lab') => SimulatorApi.setSimDataPlane(target),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: simQueryKeys.target() });
        },
    });
}

export function useStartBatch() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: SimulatorApi.startBatch,
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: simQueryKeys.batch() });
            void qc.invalidateQueries({ queryKey: simQueryKeys.live() });
        },
    });
}

export function useStartLive() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (params: LiveStartParams) => SimulatorApi.startLive(params),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: simQueryKeys.live() });
        },
    });
}

export function useStartGarmin() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: SimulatorApi.startGarminSimulation,
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: simQueryKeys.garmin() });
        },
    });
}

export function useAbortBatch() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => SimulatorApi.abortBatch(),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: simQueryKeys.batch() });
        },
    });
}

export function useAbortLive() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => SimulatorApi.abortLive(),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: simQueryKeys.live() });
        },
    });
}

export function useAbortGarmin() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => SimulatorApi.abortGarminSimulation(),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: simQueryKeys.garmin() });
        },
    });
}

export function useResetSimulator() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (target: WipeTarget) => SimulatorApi.resetSimulator(target),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: simQueryKeys.batch() });
            void qc.invalidateQueries({ queryKey: simQueryKeys.live() });
            void qc.invalidateQueries({ queryKey: simQueryKeys.garmin() });
        },
    });
}

export function useClearGarminSummary() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => SimulatorApi.clearGarminSummary(),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: simQueryKeys.garmin() });
        },
    });
}

export function isAnySimActive(
    batch: BatchStatus | null | undefined,
    live: LiveStatus | null | undefined,
    garmin: GarminSimStatus | null | undefined,
): boolean {
    return Boolean(
        batch?.running
        || live?.running
        || garmin?.running
        || batch?.stuck
        || live?.stuck
        || live?.live_lock_held
        || batch?.batch_lock_held,
    );
}

export function resolveWipeTarget(simTarget: SimTargetInfo | null | undefined): WipeTarget {
    if (simTarget?.prod_local_writes || simTarget?.mode === 'prod-local-sim' || simTarget?.mode === 'local') {
        return 'prod-local';
    }
    return 'sim-lab';
}

export type { SimTargetInfo, WipeProgressStatus, WipeTarget };
