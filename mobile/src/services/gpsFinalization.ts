export interface GpsFinalizationDeps {
  postFinalize: (activityId: number, body: { end_time: string; distance: number }) => Promise<unknown>;
  capture: (error: unknown, code: string) => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export async function finalizeActivityWithRetry(
  activityId: number,
  distanceM: number,
  maxRetries: number,
  deps: GpsFinalizationDeps,
): Promise<boolean> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = deps.now ?? (() => new Date());

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await deps.postFinalize(activityId, {
        end_time: now().toISOString(),
        distance: distanceM,
      });
      return true;
    } catch (error) {
      if (attempt >= maxRetries) {
        deps.capture(error, 'GPS_FINALIZE_FAILED');
        return false;
      }
      await sleep(Math.min(2 ** attempt * 1_000, 30_000));
    }
  }

  return false;
}
