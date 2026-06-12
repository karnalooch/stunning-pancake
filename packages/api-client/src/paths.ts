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
  activitiesPrivacyZones: '/activities/privacy-zones/',
  activitiesPois: '/activities/pois/',
  rewardsBalance: '/rewards/balance/',
  rewardsPools: '/rewards/pools/',
  wearablesSync: '/activities/wearables/sync/',
  wearablesStravaAuth: '/activities/wearables/strava/auth/',
  wearablesGarminAuth: '/activities/wearables/garmin/auth/',
  authGoogleLogin: '/auth/google/login/',
  authFacebookLogin: '/auth/facebook/login/',
  llmProxy: '/llm/proxy/',
  events: '/events/',
  cityHubSummary: '/events/city-hub/',
  usersTenantsPublic: '/users/tenants/public/',
  usersPushRegister: '/users/push/register/',
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
  activitiesPrivacyZones: '/api/activities/privacy-zones/',
  activitiesPois: '/api/activities/pois/',
  rewardsBalance: '/api/rewards/balance/',
  rewardsPools: '/api/rewards/pools/',
  wearablesSync: '/api/activities/wearables/sync/',
  wearablesStravaAuth: '/api/activities/wearables/strava/auth/',
  wearablesGarminAuth: '/api/activities/wearables/garmin/auth/',
  authGoogleLogin: '/api/auth/google/login/',
  authFacebookLogin: '/api/auth/facebook/login/',
  llmProxy: '/api/llm/proxy/',
  events: '/api/events/',
  cityHubSummary: '/api/events/city-hub/',
  usersTenantsPublic: '/api/users/tenants/public/',
  usersPushRegister: '/api/users/push/register/',
} as const;

/** Dynamic mobile paths — keep IDs in call sites, paths in SSOT. */
export const mobileActivityPaths = {
  sessionSyncPath: (activityId: number) =>
    `/api/activities/sessions/${activityId}/sync_path/` as const,
  sessionFinalize: (activityId: number) =>
    `/api/activities/sessions/${activityId}/finalize/` as const,
  leaderboard: (cityId: string) => `/api/activities/leaderboard/${cityId}/` as const,
  leaderboardMe: (cityId: string) => `/api/activities/leaderboard/${cityId}/me/` as const,
  privacyZone: (zoneId: string) => `/api/activities/privacy-zones/${zoneId}/` as const,
  rewardsRedeem: (poolId: number) => `/api/rewards/redeem/${poolId}/` as const,
  tenantBranding: (tenantId: string) => `/api/users/branding/${tenantId}/` as const,
  eventJoin: (eventId: number) => `/api/events/${eventId}/join/` as const,
  sessionShareData: (activityId: number) =>
    `/api/activities/sessions/${activityId}/share_data/` as const,
  departmentSelfJoin: (departmentId: number) =>
    `/api/users/departments/${departmentId}/self-join/` as const,
};

export const CRITICAL_PATHS = Object.values(API_PATHS_FULL);
