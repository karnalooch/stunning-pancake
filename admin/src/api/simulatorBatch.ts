import { SimulatorApi } from './client';

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
