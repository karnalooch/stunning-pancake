/** Shared moderation queue resolution for dashboard + inbox. */

export interface UnverifiedActivity {
  id?: number;
  activity_id?: number;
  user?: string;
  username?: string;
  type?: string;
  distance?: number;
  score?: number;
}

export function resolvePendingQueue(
  data: Record<string, unknown>,
  tenantId: string | null | undefined,
  options?: { limit?: number },
): UnverifiedActivity[] {
  const limit = options?.limit ?? 50;

  if (Array.isArray(data.recent_unverified) && data.recent_unverified.length > 0) {
    return (data.recent_unverified as UnverifiedActivity[]).slice(0, limit);
  }

  const perTenant = data.per_tenant;
  if (!Array.isArray(perTenant)) {
    return [];
  }

  if (tenantId) {
    const row = perTenant.find(
      (t) => String((t as { tenant_id?: string }).tenant_id) === String(tenantId),
    );
    const scoped = (row as { recent_unverified?: UnverifiedActivity[] } | undefined)
      ?.recent_unverified;
    return Array.isArray(scoped) ? scoped.slice(0, limit) : [];
  }

  const merged: UnverifiedActivity[] = [];
  for (const row of perTenant) {
    const items = (row as { recent_unverified?: UnverifiedActivity[] }).recent_unverified;
    if (Array.isArray(items)) {
      merged.push(...items);
    }
  }
  return merged.slice(0, limit);
}
