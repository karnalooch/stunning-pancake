import { describe, it, expect } from 'vitest';
import { computeControlPlaneStatus, controlPlaneLabel } from '../utils/goHealth';

describe('computeControlPlaneStatus', () => {
  it('returns go for healthy prod', () => {
    expect(
      computeControlPlaneStatus({ apiLatencyMs: 120, simOn: false }),
    ).toBe('go');
  });

  it('returns no-go when simulator backpressure active', () => {
    expect(
      computeControlPlaneStatus({
        simOn: true,
        routingBackpressure: true,
        routingQueueDepth: 90,
      }),
    ).toBe('no-go');
  });

  it('returns warn for synthetic KPI', () => {
    expect(computeControlPlaneStatus({ synthetic: true })).toBe('warn');
  });

  it('returns warn (not no-go) for slow stats when sim is off', () => {
    expect(
      computeControlPlaneStatus({ apiLatencyMs: 6976, simOn: false }),
    ).toBe('warn');
  });

  it('returns no-go for very slow API with sim running', () => {
    expect(
      computeControlPlaneStatus({ apiLatencyMs: 3200, simOn: true }),
    ).toBe('no-go');
  });

  it('returns warn when queue exceeds cap', () => {
    expect(
      computeControlPlaneStatus({
        simOn: true,
        routingQueueDepth: 95,
        maxRoutingQueueDepth: 80,
      }),
    ).toBe('warn');
  });

  it('labels status', () => {
    expect(controlPlaneLabel('go')).toBe('GO');
    expect(controlPlaneLabel('no-go')).toBe('NO-GO');
  });
});
