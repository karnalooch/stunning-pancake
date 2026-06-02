import { formatApiError, SimulatorApi } from './client';

export type BatchSimStatus = {
  running?: boolean;
  batch_lock_held?: boolean;
  current_phase?: string;
  error?: string | null;
};

/** True while batch is running, lock held, or phase is not idle/complete. */
export function isBatchInProgress(status: BatchSimStatus | null | undefined): boolean {
  if (!status) return false;
  if (status.running || status.batch_lock_held) return true;
  const phase = (status.current_phase || 'idle').toLowerCase();
  return phase !== 'idle' && phase !== 'complete';
}

/**
 * Poll until batch fully finishes (saw active → idle + lock released).
 * Fixes race where an early poll saw running=false before Celery started the batch.
 */
export async function waitForBatchComplete(options?: {
  onStatus?: (status: BatchSimStatus) => void;
  pollMs?: number;
  startTimeoutMs?: number;
  totalTimeoutMs?: number;
}): Promise<BatchSimStatus> {
  const pollMs = options?.pollMs ?? 800;
  const startTimeoutMs = options?.startTimeoutMs ?? 120_000;
  const totalTimeoutMs = options?.totalTimeoutMs ?? 3_600_000;
  const startedAt = Date.now();
  let sawActive = false;

  while (Date.now() - startedAt < totalTimeoutMs) {
    const status = await SimulatorApi.getBatchStatus();
    options?.onStatus?.(status);
    if (isBatchInProgress(status)) {
      sawActive = true;
    } else if (sawActive) {
      if (status.error) {
        throw new Error(String(status.error));
      }
      return status;
    } else if (Date.now() - startedAt > startTimeoutMs) {
      throw new Error('Batch did not start within 2 minutes (check Celery worker).');
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error('Batch did not finish within the timeout.');
}

export class QuickLaunchBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuickLaunchBlockedError';
  }
}

/** One-click live map: ensure batch idle, seed athletes if needed, start live sim. */
export async function quickLaunchLiveMap(options?: {
  pool_pct?: number;
  active_ratio?: number;
  cheat_ratio?: number;
  tick_seconds?: number;
  bootstrapUsers?: number;
}): Promise<void> {
  const pool_pct = options?.pool_pct ?? 1.0;
  const active_ratio = options?.active_ratio ?? 0.3;
  const cheat_ratio = options?.cheat_ratio ?? 0.05;
  const tick_seconds = options?.tick_seconds ?? 8;
  const bootstrapUsers = options?.bootstrapUsers ?? 500;

  const batch = await SimulatorApi.getBatchStatus().catch(() => null);
  if (isBatchInProgress(batch)) {
    throw new QuickLaunchBlockedError(
      'Batch generation is still running. Wait for it to finish, then try Quick Launch again.',
    );
  }

  const startLive = () =>
    SimulatorApi.startLive({ pool_pct, active_ratio, cheat_ratio, tick_seconds });

  try {
    await startLive();
    return;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status !== 400) {
      throw err;
    }
  }

  await SimulatorApi.startBatch({
    total_users: bootstrapUsers,
    days: 1,
    clear: false,
    skip_activities: true,
  });
  await waitForBatchComplete({
    pollMs: 1000,
    startTimeoutMs: 120_000,
    totalTimeoutMs: 600_000,
  });
  await startLive();
}

export function formatQuickLaunchError(err: unknown): string {
  if (err instanceof QuickLaunchBlockedError) {
    return err.message;
  }
  return formatApiError(err, 'Quick launch failed');
}
