import { describe, expect, it } from 'vitest';
import {
  formatSimulatorConflict,
  isExpectedSimulatorConflict,
  parseSimulatorConflict,
} from './simulatorConflict';

describe('simulatorConflict', () => {
  it('parses wipe 409', () => {
    const info = parseSimulatorConflict({
      response: {
        status: 409,
        data: { code: 'WIPE_IN_PROGRESS', error: 'Wipe running' },
      },
    });
    expect(info?.expected).toBe(true);
    expect(info?.message).toBe('Wipe running');
  });

  it('parses sim-lab 503', () => {
    expect(
      isExpectedSimulatorConflict({
        response: { status: 503, data: { code: 'SIM_LAB_UNREACHABLE' } },
      }),
    ).toBe(true);
  });

  it('falls back for unknown errors', () => {
    expect(formatSimulatorConflict({ message: 'network' }, 'fail')).toContain('network');
  });
});
