/** Baked at build time — enable only for local/preview E2E APKs, never production store. */
export const e2eConfig = {
  autoLogin: process.env.EXPO_PUBLIC_E2E_AUTO_LOGIN === 'true',
  skipOnboarding: process.env.EXPO_PUBLIC_E2E_SKIP_ONBOARDING === 'true',
  email: process.env.EXPO_PUBLIC_E2E_EMAIL ?? '',
  password: process.env.EXPO_PUBLIC_E2E_PASSWORD ?? '',
  gpsRecoverySeed: process.env.EXPO_PUBLIC_E2E_GPS_RECOVERY === 'true',
};

export function isE2eAutoLoginEnabled(): boolean {
  return e2eConfig.autoLogin && Boolean(e2eConfig.email && e2eConfig.password);
}
