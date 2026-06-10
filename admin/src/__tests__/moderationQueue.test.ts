import { describe, it, expect } from 'vitest';
import { resolvePendingQueue } from '../utils/moderationQueue';

describe('resolvePendingQueue', () => {
  const data = {
    recent_unverified: [{ id: 1, user: 'alice' }],
    per_tenant: [
      { tenant_id: 't1', recent_unverified: [{ id: 2, user: 'bob' }] },
      { tenant_id: 't2', recent_unverified: [{ id: 3, user: 'carol' }] },
    ],
  };

  it('prefers top-level recent_unverified for global owner', () => {
    const items = resolvePendingQueue(data, null);
    expect(items).toHaveLength(1);
    expect(items[0].user).toBe('alice');
  });

  it('scopes to tenant for moderators', () => {
    const items = resolvePendingQueue(
      { per_tenant: data.per_tenant },
      't2',
    );
    expect(items).toHaveLength(1);
    expect(items[0].user).toBe('carol');
  });

  it('flattens per_tenant when no top-level queue', () => {
    const items = resolvePendingQueue({ per_tenant: data.per_tenant }, null);
    expect(items).toHaveLength(2);
  });
});
