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
  sponsorStats: '/rewards/sponsor-stats/',
  moderationQueue: '/activities/admin/moderation/queue/',
  moderationHistory: '/activities/admin/moderation/history/',
  moderationAssign: '/activities/admin/moderation/assign/',
  activitiesApprove: '/activities/admin/approve/',
  activitiesReject: '/activities/admin/reject/',
  tenantBranding: '/users/branding/',
  userPreferences: '/users/preferences/',
  sponsorStatsTimeseries: '/rewards/sponsor-stats/timeseries/',
  sponsorActivity: '/rewards/sponsor-activity/',
  sponsorCampaigns: '/rewards/campaigns/',
  revenueSummary: '/rewards/admin/revenue-summary/',
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
  sponsorStats: '/api/rewards/sponsor-stats/',
  moderationQueue: '/api/activities/admin/moderation/queue/',
  moderationHistory: '/api/activities/admin/moderation/history/',
  moderationAssign: '/api/activities/admin/moderation/assign/',
  activitiesApprove: '/api/activities/admin/approve/',
  activitiesReject: '/api/activities/admin/reject/',
  tenantBranding: '/api/users/branding/',
  userPreferences: '/api/users/preferences/',
  sponsorStatsTimeseries: '/api/rewards/sponsor-stats/timeseries/',
  sponsorActivity: '/api/rewards/sponsor-activity/',
  sponsorCampaigns: '/api/rewards/campaigns/',
  revenueSummary: '/api/rewards/admin/revenue-summary/',
} as const;

export const CRITICAL_PATHS = Object.values(API_PATHS_FULL);
