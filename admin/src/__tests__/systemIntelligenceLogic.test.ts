import { describe, expect, it } from 'vitest';
import { normalizeInsightsPayload } from '../modules/analytics/systemIntelligenceLogic';

describe('normalizeInsightsPayload', () => {
  it('accepts a plain array', () => {
    const rows = normalizeInsightsPayload([
      { title: 'Platform Health', desc: '94.2% verification rate', type: 'positive', color: 'green' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Platform Health');
  });

  it('unwraps { insights: [...] } responses', () => {
    const rows = normalizeInsightsPayload({
      insights: [{ title: 'Growth Insight', desc: 'up', type: 'warning', color: 'orange' }],
    });
    expect(rows[0].title).toBe('Growth Insight');
  });

  it('returns empty array for invalid payloads', () => {
    expect(normalizeInsightsPayload(null)).toEqual([]);
    expect(normalizeInsightsPayload({ insights: 'bad' })).toEqual([]);
  });
});
