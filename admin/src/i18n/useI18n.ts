import { create } from 'zustand';
import { stringsEn } from './strings.en';
import { stringsPl } from './strings.pl';
import type { I18nCatalog, Locale } from './types';

const STORAGE_KEY = 'admin-locale';

function defaultLocale(role?: string | null): Locale {
  if (role?.startsWith('TENANT_')) return 'pl';
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  return stored === 'pl' || stored === 'en' ? stored : 'en';
}

interface I18nState {
  locale: Locale;
  t: I18nCatalog;
  setLocale: (locale: Locale) => void;
  initForRole: (role: string | null | undefined) => void;
}

const catalogs: Record<Locale, I18nCatalog> = { pl: stringsPl, en: stringsEn };

export const useI18n = create<I18nState>((set) => ({
  locale: 'en',
  t: stringsEn,
  setLocale: (locale) => {
    localStorage.setItem(STORAGE_KEY, locale);
    set({ locale, t: catalogs[locale] });
  },
  initForRole: (role) => {
    const locale = defaultLocale(role);
    set({ locale, t: catalogs[locale] });
  },
}));
