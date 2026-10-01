import { createAppMmkv } from '../services/mmkvStorage';
import { warnMmkvUnavailable } from '../services/mmkvSupport';
import { AppearanceStore } from './packs/AppearanceStore';

let instance: AppearanceStore | undefined;
/** Shared by bootstrap and provider: persisted selection is resolved before first styles. */
export function getAppearanceStore(): AppearanceStore {
  if (!instance) {
    try { instance = new AppearanceStore(createAppMmkv()); }
    catch (error) {
      warnMmkvUnavailable('AppearanceStore', error);
      instance = new AppearanceStore(null);
    }
  }
  return instance;
}
