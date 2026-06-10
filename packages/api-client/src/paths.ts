/**
 * Critical API paths (SSOT). Relative to admin baseURL ending in /api.
 * Mobile clients prefix with /api when baseURL is host root.
 */
export const API_PATHS = {
  authToken: '/auth/token/',
  authTokenRefresh: '/auth/token/refresh/',
  authTokenVerify: '/auth/token/verify/',
  usersProfile: '/users/profile/',
  usersRegister: '/users/register/',
  activitiesSessions: '/activities/sessions/',
  adminSimCapacity: '/activities/admin/sim-capacity/',
  adminScalePreflight: '/activities/admin/scale-preflight/',
  adminDiskAudit: '/activities/admin/disk-audit/',
  infraHealth: '/infra/health/',
} as const;

/** Full paths for mobile (host-root baseURL). */
export const API_PATHS_FULL = {
  authToken: '/api/auth/token/',
  authTokenRefresh: '/api/auth/token/refresh/',
  authTokenVerify: '/api/auth/token/verify/',
  usersProfile: '/api/users/profile/',
  usersRegister: '/api/users/register/',
  activitiesSessions: '/api/activities/sessions/',
  adminSimCapacity: '/api/activities/admin/sim-capacity/',
  adminScalePreflight: '/api/activities/admin/scale-preflight/',
  adminDiskAudit: '/api/activities/admin/disk-audit/',
  infraHealth: '/api/infra/health/',
} as const;

export const CRITICAL_PATHS = Object.values(API_PATHS_FULL);
