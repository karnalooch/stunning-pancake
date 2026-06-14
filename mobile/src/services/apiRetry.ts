export type RideEdgeMessage = {
  title: string;
  message: string;
  variant?: 'error' | 'warning' | 'offline' | 'success';
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 400,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw last;
}
