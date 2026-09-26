import { useRideLifecycle } from '../../../bootstrap/useRideLifecycle';
import type { RideController, RideControllerOptions } from './RideController';

export function useProductionRideController(options: RideControllerOptions = {}): RideController {
  return useRideLifecycle(options);
}
