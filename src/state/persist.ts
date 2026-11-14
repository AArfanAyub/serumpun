import type { FieldLocation, FieldProfile } from '@/types/domain';
import type { Lang, Month } from '@/types/ui';
import { defaultProfile } from '@/normalize/merge';

/**
 * Local-only persistence. No cloud, no account, no sync, no cookies, no PII beyond the
 * field the farmer typed. Namespaced `serumpun:*` keys only.
 */
const KEY = 'serumpun:session:v1';

export interface PersistedSession {
  location: FieldLocation | null;
  profile: FieldProfile;
  lang: Lang;
  targetMonth: Month | null;
  lastGoodAt: string | null;
}

export function emptySession(): PersistedSession {
  return {
    location: null,
    profile: defaultProfile(),
    lang: 'en',
    targetMonth: null,
    lastGoodAt: null,
  };
}

function storage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined' && localStorage !== null) return localStorage;
  } catch {
    // Private mode / file:// restrictions.
  }
  return null;
}

export function loadPersisted(): PersistedSession {
  const store = storage();
  if (!store) return emptySession();
  try {
    const raw = store.getItem(KEY);
    if (!raw) return emptySession();
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    return {
      location: parsed.location ?? null,
      profile: { ...defaultProfile(), ...(parsed.profile ?? {}) },
      lang: parsed.lang === 'id' ? 'id' : 'en',
      targetMonth: parsed.targetMonth ?? null,
      lastGoodAt: parsed.lastGoodAt ?? null,
    };
  } catch {
    return emptySession();
  }
}

export function savePersisted(session: PersistedSession): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(session));
  } catch {
    // Quota errors are non-fatal; the in-memory session still works.
  }
}

export function clearPersisted(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    // Non-fatal.
  }
}
