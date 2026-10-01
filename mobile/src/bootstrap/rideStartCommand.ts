import type { ActivitySportType } from '../services/api';

/** One shared Promise per start, including callers outside the start button. */
export function createRideStartCommand(
  start: (sport?: ActivitySportType, eventId?: number) => Promise<boolean>,
  onStarted: () => void,
): (sport?: ActivitySportType, eventId?: number) => Promise<void> {
  let pending: Promise<void> | null = null;
  return (sport = 'BIKE', eventId) => {
    if (pending) return pending;
    pending = Promise.resolve()
      .then(() => start(sport, eventId))
      .then((started) => { if (started) onStarted(); })
      .finally(() => { pending = null; });
    return pending;
  };
}
