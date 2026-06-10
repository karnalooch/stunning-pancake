import { describe, it, expect } from 'vitest';
import { resolvePendingQueue } from '../utils/moderationQueue';

// useTenantScope is hook-based; test the queue util used alongside tenant scoping.
describe('tenant scoping helpers', () => {
  it('scopes moderator queue to tenant row', () => {
    const data = {
      per_tenant: [
        { tenant_id: 'city-a', recent_unverified: [{ id: 1, user: 'a' }] },
        { tenant_id: 'city-b', recent_unverified: [{ id: 2, user: 'b' }] },
      ],
    };
    const scoped = resolvePendingQueue(data, 'city-a');
    expect(scoped).toHaveLength(1);
    expect(scoped[0].user).toBe('a');
  });
});
