import { POLAND_SIM_CITIES } from '../modules/analytics/live-map/engine/liveMapCities';

/** Map tenant id/name to live-map city slug when possible. */
export function tenantToCitySlug(tenantId: string, tenantName?: string): string | null {
  const id = tenantId.trim().toLowerCase();
  const byId = POLAND_SIM_CITIES.find((c) => c.slug === id);
  if (byId) return byId.slug;

  const name = (tenantName || '').trim().toLowerCase();
  if (name) {
    const byName = POLAND_SIM_CITIES.find(
      (c) => c.name.toLowerCase() === name || c.slug === slugify(name),
    );
    if (byName) return byName.slug;
  }

  const slug = slugify(tenantName || tenantId);
  return POLAND_SIM_CITIES.some((c) => c.slug === slug) ? slug : slug;
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function tenantQuery(tenantId: string, tenantName?: string): string {
  const qs = new URLSearchParams({ tenant_id: tenantId });
  if (tenantName) qs.set('tenant_name', tenantName);
  return qs.toString();
}

export function tenantUsersUrl(tenantId: string, tenantName?: string): string {
  return `/owner/users?${tenantQuery(tenantId, tenantName)}`;
}

export function tenantActivitiesUrl(tenantId: string, tenantName?: string): string {
  return `/owner/activities?${tenantQuery(tenantId, tenantName)}`;
}

export function tenantLiveMapUrl(tenantId: string, tenantName?: string): string {
  const city = tenantToCitySlug(tenantId, tenantName);
  return city
    ? `/owner/analytics/live-map?city=${encodeURIComponent(city)}`
    : '/owner/analytics/live-map';
}
