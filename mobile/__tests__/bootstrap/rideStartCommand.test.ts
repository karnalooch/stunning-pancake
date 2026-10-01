import { createRideStartCommand } from '../../src/bootstrap/rideStartCommand';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('ride start command Promise and single-flight boundary', () => {
  test('coalesces repeated callers and preserves the unresolved Promise', async () => {
    const wait = deferred<boolean>();
    const start = jest.fn(() => wait.promise);
    const navigate = jest.fn();
    const command = createRideStartCommand(start, navigate);
    const first = command('BIKE', 42);
    const second = command('BIKE', 42);
    expect(second).toBe(first);
    await Promise.resolve();
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith('BIKE', 42);
    expect(navigate).not.toHaveBeenCalled();
    wait.resolve(true);
    await first;
    expect(navigate).toHaveBeenCalledTimes(1);
  });
  test('does not navigate after an unsuccessful start and permits a retry', async () => {
    const start = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const navigate = jest.fn();
    const command = createRideStartCommand(start, navigate);
    await command();
    expect(navigate).not.toHaveBeenCalled();
    await command();
    expect(start).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledTimes(1);
  });
  test('releases the lock after rejection without swallowing the error', async () => {
    const start = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(true);
    const navigate = jest.fn();
    const command = createRideStartCommand(start, navigate);
    await expect(command()).rejects.toThrow('offline');
    expect(navigate).not.toHaveBeenCalled();
    await command();
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
