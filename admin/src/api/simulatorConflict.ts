import { formatApiError } from './apiErrors';

export type SimulatorConflictInfo = {
  status: number;
  code?: string;
  message: string;
  expected: boolean;
};

/** Parse expected 409 / sim-lab 503 conflicts from simulator admin APIs. */
export function parseSimulatorConflict(err: unknown): SimulatorConflictInfo | null {
  const ax = err as {
    response?: { status?: number; data?: Record<string, unknown> };
  };
  const status = ax.response?.status;
  if (!status) return null;

  const data = ax.response?.data ?? {};
  const code = typeof data.code === 'string' ? data.code : undefined;
  const errorMsg = typeof data.error === 'string' ? data.error : undefined;

  if (status === 409) {
    return {
      status,
      code,
      message: errorMsg || default409Message(code),
      expected: true,
    };
  }

  if (status === 503 && code === 'SIM_LAB_UNREACHABLE') {
    return {
      status,
      code,
      message: errorMsg || 'Sim-lab is unreachable. Retry after recovery.',
      expected: true,
    };
  }

  return null;
}

function default409Message(code?: string): string {
  switch (code) {
    case 'WIPE_IN_PROGRESS':
      return 'Data wipe in progress. Wait before starting simulation.';
    default:
      return 'Simulation start blocked by current system state.';
  }
}

export function formatSimulatorConflict(err: unknown, fallback = 'Start request failed'): string {
  return parseSimulatorConflict(err)?.message ?? formatApiError(err, fallback);
}

export function isExpectedSimulatorConflict(err: unknown): boolean {
  return parseSimulatorConflict(err)?.expected === true;
}
