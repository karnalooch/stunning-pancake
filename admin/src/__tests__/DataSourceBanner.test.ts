import { describe, expect, it } from 'vitest';
import { resolveDataSourceBannerView } from '../core/components/dataSourceBannerLogic';

describe('resolveDataSourceBannerView', () => {
  it('returns hidden for production data', () => {
    expect(resolveDataSourceBannerView({ dataSource: 'production', synthetic: false })).toEqual({
      kind: 'hidden',
    });
  });

  it('returns sim-lab for federated synthetic KPIs', () => {
    expect(
      resolveDataSourceBannerView({ dataSource: 'sim-lab', synthetic: true, simLabLabel: 'sim-lab' }),
    ).toEqual({
      kind: 'sim-lab',
      simLabLabel: 'sim-lab',
    });
  });

  it('returns fallback when prod stats are degraded', () => {
    expect(
      resolveDataSourceBannerView({ dataSource: 'production', federationFallback: true }),
    ).toEqual({
      kind: 'fallback',
    });
  });
});
