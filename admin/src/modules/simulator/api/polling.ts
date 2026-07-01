import type { BatchStatus, GarminSimStatus, LiveStatus } from './types';

const LIVE_POLL_RUNNING_MS = 1500;
const LIVE_POLL_IDLE_MS = 15_000;
const BATCH_POLL_RUNNING_MS = 2000;
const BATCH_POLL_IDLE_MS = 15_000;
const GARMIN_POLL_RUNNING_MS = 2000;
const GARMIN_POLL_IDLE_MS = 15_000;

export function liveRefetchInterval(data: LiveStatus | undefined): number | false {
    if (!data) return LIVE_POLL_IDLE_MS;
    if (data.running || data.stuck || data.live_lock_held) return LIVE_POLL_RUNNING_MS;
    return LIVE_POLL_IDLE_MS;
}

export function batchRefetchInterval(data: BatchStatus | undefined): number | false {
    if (!data) return BATCH_POLL_IDLE_MS;
    if (data.running || data.stuck || data.batch_lock_held) return BATCH_POLL_RUNNING_MS;
    const phase = (data.current_phase || 'idle').toLowerCase();
    if (phase !== 'idle' && phase !== 'complete') return BATCH_POLL_RUNNING_MS;
    return BATCH_POLL_IDLE_MS;
}

export function garminRefetchInterval(data: GarminSimStatus | undefined): number | false {
    if (!data) return GARMIN_POLL_IDLE_MS;
    if (data.running) return GARMIN_POLL_RUNNING_MS;
    return GARMIN_POLL_IDLE_MS;
}
