import en from '@/i18n/en.json';
import pt from '@/i18n/pt.json';

export type Locale = 'pt' | 'en';

const dictionaries: Record<Locale, Record<string, string>> = { pt, en };

let current: Locale = 'pt';
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

export function setLocaleValue(locale: Locale): void {
  current = locale;
  listeners.forEach((listener) => listener());
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const text = dictionaries[locale][key] ?? dictionaries.pt[key] ?? key;
  if (!params) return text;
  return Object.entries(params).reduce(
    (acc, [name, value]) => acc.replaceAll(`:${name}`, String(value)),
    text
  );
}

/** Traduz pela língua atual. Em componentes, use `useI18n` para reagir à troca. */
export function __(key: string, params?: Record<string, string | number>): string {
  return translate(current, key, params);
}
