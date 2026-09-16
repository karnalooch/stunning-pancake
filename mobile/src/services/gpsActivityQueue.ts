export class ActivitySerialQueue {
  private readonly tails = new Map<number, Promise<void>>();

  async run<T>(activityId: number, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(activityId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(task);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(activityId, tail);

    try {
      return await run;
    } finally {
      if (this.tails.get(activityId) === tail) {
        this.tails.delete(activityId);
      }
    }
  }
}
