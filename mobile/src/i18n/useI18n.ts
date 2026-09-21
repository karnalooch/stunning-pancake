import { create } from 'zustand';
import { createAppMmkv, type AppMmkvStorage } from '../services/mmkvStorage';
import { stringsPl } from './strings.pl';
import { stringsEn } from './strings.en';

export type MobileLocale = 'pl' | 'en';
export type MobileCatalog = typeof stringsPl | typeof stringsEn;

const STORAGE_KEY = 'mobile-locale';
let storage: AppMmkvStorage | null = null;
try {
  storage = createAppMmkv();
} catch {
  storage = null;
}

function readLocale(): MobileLocale {
  const v = storage?.getString(STORAGE_KEY);
  return v === 'en' ? 'en' : 'pl';
}

const catalogs: Record<MobileLocale, MobileCatalog> = { pl: stringsPl, en: stringsEn };

interface MobileI18nState {
  locale: MobileLocale;
  t: MobileCatalog;
  setLocale: (locale: MobileLocale) => void;
  toggleLocale: () => void;
}

export const useI18n = create<MobileI18nState>((set, get) => ({
  locale: readLocale(),
  t: catalogs[readLocale()],
  setLocale: (locale) => {
    storage?.set(STORAGE_KEY, locale);
    set({ locale, t: catalogs[locale] });
  },
  toggleLocale: () => {
    const next = get().locale === 'pl' ? 'en' : 'pl';
    get().setLocale(next);
  },
}));
