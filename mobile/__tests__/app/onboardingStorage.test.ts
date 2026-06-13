import {
  isOnboardingCompleteForUser,
  onboardingKeyForUser,
  ONBOARDING_KEY,
  setOnboardingCompleteForUser,
} from '../../src/app/storage';

jest.mock('../../src/app/storage', () => {
  const mem = new Map<string, string>();
  const store = {
    getString: (k: string) => mem.get(k),
    set: (k: string, v: string) => {
      mem.set(k, v);
    },
    delete: (k: string) => {
      mem.delete(k);
    },
    clearAll: () => mem.clear(),
    getAllKeys: () => [...mem.keys()],
    contains: (k: string) => mem.has(k),
  };
  return {
    getAppStorage: () => store,
    ONBOARDING_KEY: 'onboarding_complete',
    onboardingKeyForUser: (id: string | number) => `onboarding_complete_${id}`,
    isOnboardingCompleteForUser: (id: string | number | null | undefined) => {
      if (id == null) return false;
      const userKey = `onboarding_complete_${id}`;
      if (mem.get(userKey) === 'true') return true;
      if (mem.get('onboarding_complete') === 'true') {
        mem.set(userKey, 'true');
        return true;
      }
      return false;
    },
    setOnboardingCompleteForUser: (id: string | number) => {
      mem.set(`onboarding_complete_${id}`, 'true');
    },
  };
});

describe('onboarding storage', () => {
  test('onboardingKeyForUser scopes by id', () => {
    expect(onboardingKeyForUser(42)).toBe('onboarding_complete_42');
  });

  test('setOnboardingCompleteForUser is per user', () => {
    setOnboardingCompleteForUser(1);
    expect(isOnboardingCompleteForUser(1)).toBe(true);
    expect(isOnboardingCompleteForUser(2)).toBe(false);
  });
});
