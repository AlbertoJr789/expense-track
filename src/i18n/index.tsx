import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getSetting, setSetting } from '@/db/catalog';
import {
  __,
  getLocale,
  setLocaleValue,
  subscribeLocale,
  translate,
  type Locale,
} from '@/i18n/translate';

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  __: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getLocale());

  const apply = useCallback(async (next: Locale, persist: boolean) => {
    setLocaleValue(next);
    setLocaleState(next);
    if (persist) await setSetting('locale', next);
  }, []);

  useEffect(() => {
    getSetting('locale')
      .then((stored) => {
        if (stored === 'en' || stored === 'pt') setLocaleValue(stored);
      })
      .catch(console.error);
    return subscribeLocale(() => setLocaleState(getLocale()));
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale: (next) => apply(next, true),
      __: (key, params) => translate(locale, key, params),
    }),
    [locale, apply]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export async function reloadLocale(): Promise<void> {
  const stored = await getSetting('locale');
  if (stored === 'en' || stored === 'pt') setLocaleValue(stored);
}

export { __ };
export type { Locale } from '@/i18n/translate';
