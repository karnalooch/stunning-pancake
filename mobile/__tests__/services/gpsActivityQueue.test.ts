import { ActivitySerialQueue } from '../../src/services/gpsActivityQueue';

describe('ActivitySerialQueue', () => {
  test('runs same-activity batches sequentially and preserves each result', async () => {
    const queue = new ActivitySerialQueue();
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    let markFirstStarted: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });

    const first = queue.run(42, async () => {
      events.push('first:start');
      markFirstStarted?.();
      await firstGate;
      events.push('first:end');
      return 'ack-first';
    });
    const second = queue.run(42, async () => {
      events.push('second:start');
      events.push('second:end');
      return 'ack-second';
    });

    await firstStarted;
    expect(events).toEqual(['first:start']);

    releaseFirst?.();
    await expect(first).resolves.toBe('ack-first');
    await expect(second).resolves.toBe('ack-second');
    expect(events).toEqual([
      'first:start',
      'first:end',
      'second:start',
      'second:end',
    ]);
  });

  test('does not serialize different activities behind each other', async () => {
    const queue = new ActivitySerialQueue();
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.run(42, async () => {
      events.push('42:start');
      await firstGate;
      return '42';
    });
    const other = queue.run(43, async () => {
      events.push('43:start');
      return '43';
    });

    await Promise.resolve();
    await expect(other).resolves.toBe('43');
    expect(events).toContain('43:start');

    releaseFirst?.();
    await expect(first).resolves.toBe('42');
  });
});
