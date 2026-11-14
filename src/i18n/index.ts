import type { Lang } from '@/types/ui';
import { en } from './en';
import { id } from './id';

export { en, id };

export type TParams = Record<string, unknown>;

const DICTS: Readonly<Record<Lang, Record<string, string>>> = Object.freeze({ en, id });

export const DEFAULT_LANG: Lang = 'en';

/**
 * Pure dictionary lookup. `lang` is an argument so the domain engine stays deterministic.
 * `params` is typed as `object` so both object literals and named interfaces are accepted.
 */
export function t(lang: Lang, key: string, params: object = {}): string {
  const dictionary = DICTS[lang] ?? en;
  const template = dictionary[key] ?? en[key] ?? key;
  const values = params as TParams;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = values[name];
    return value === undefined || value === null ? '' : String(value);
  });
}

/** Convenience binder for UI components. */
export function makeT(lang: Lang): (key: string, params?: object) => string {
  return (key: string, params: object = {}) => t(lang, key, params);
}
