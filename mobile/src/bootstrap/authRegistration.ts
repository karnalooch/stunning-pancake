import type { RegisterPayload } from '@4velo/api-client';

/**
 * Registration is intentionally tenant-neutral. A rider chooses their city
 * during onboarding, where the selected tenant is persisted explicitly.
 */
export function buildRegistrationPayload(
  username: string,
  email: string,
  password: string,
): RegisterPayload {
  return { username, email, password };
}
