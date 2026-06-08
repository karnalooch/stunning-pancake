import { apiClient } from '../../api/client';
import type { LiveMapPosition } from './liveMapMarkers';

export type ServerReplayFrame = {
    at: string;
    positions: LiveMapPosition[];
    meta?: { count?: number };
};

export type ServerReplayResponse = {
    frames: ServerReplayFrame[];
    step_ms: number;
    meta?: {
        timescale_available?: boolean;
        frame_count?: number;
        latency_ms?: number;
    };
    compare?: {
        baseline_count: number;
        current_count: number;
        delta: number;
        city_deltas: Record<string, number>;
        compare_offset_hours?: number;
    };
};

export type ServerReplayStep = '5s' | '30s' | '60s';

export function defaultReplayRange(hoursBack = 1): { from: string; to: string } {
    const to = new Date();
    const from = new Date(to.getTime() - hoursBack * 3600_000);
    return { from: from.toISOString(), to: to.toISOString() };
}

export async function fetchServerReplay(
    params: Record<string, string | number>,
    options?: { compare?: boolean; signal?: AbortSignal },
): Promise<ServerReplayResponse> {
    const path = options?.compare
        ? '/activities/telemetry/live/replay/compare/'
        : '/activities/telemetry/live/replay/';
    const { data } = await apiClient.get(path, {
        params,
        signal: options?.signal,
        skipGlobalError: true,
    } as { params: Record<string, string | number>; signal?: AbortSignal; skipGlobalError: boolean });
    return data as ServerReplayResponse;
}

export function serverFramesToBuffer(
    frames: ServerReplayFrame[],
): { at: number; positions: LiveMapPosition[]; meta?: Record<string, unknown> }[] {
    return frames.map((f) => ({
        at: Date.parse(f.at) || Date.now(),
        positions: f.positions ?? [],
        meta: f.meta as Record<string, unknown> | undefined,
    }));
}
