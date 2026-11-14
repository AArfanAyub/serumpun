import type { CacheEntry, Provenance, SourceId } from '@/types/data';
import { SOURCE_META } from '@/config/sources';

const PREFIX = 'serumpun:cache';
const memory = new Map<string, string>();

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function backend(): StorageLike | null {
  try {
    if (typeof localStorage !== 'undefined' && localStorage !== null) {
      return localStorage as StorageLike;
    }
  } catch {
    // Access can be denied (private mode, file:// in some browsers); fall back to memory.
  }
  return null;
}

function readRaw(key: string): string | null {
  const store = backend();
  if (store) {
    try {
      return store.getItem(key);
    } catch {
      // Ignore a blocked store and use the in-memory copy.
    }
  }
  return memory.get(key) ?? null;
}

function writeRaw(key: string, value: string): void {
  memory.set(key, value);
  const store = backend();
  if (store) {
    try {
      store.setItem(key, value);
    } catch {
      // Quota or privacy errors are non-fatal; the in-memory copy still works.
    }
  }
}

function roundCoord(value: number): string {
  return (Math.round(value * 1000) / 1000).toFixed(3);
}

/** serumpun:cache:<sourceId>:<lat3>:<lon3>[:<extra>] */
export function cacheKey(sourceId: SourceId, lat: number, lon: number, extra = ''): string {
  const base = `${PREFIX}:${sourceId}:${roundCoord(lat)}:${roundCoord(lon)}`;
  return extra ? `${base}:${extra}` : base;
}

export function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 'earlier';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

export function cacheGet<T>(
  sourceId: SourceId,
  lat: number,
  lon: number,
  extra = '',
  allowStale = false
): CacheEntry<T> | null {
  const key = cacheKey(sourceId, lat, lon, extra);
  const raw = readRaw(key);
  if (!raw) return null;
  let entry: CacheEntry<T>;
  try {
    entry = JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
  if (!entry || typeof entry !== 'object' || entry.key !== key) return null;
  const age = Date.now() - Date.parse(entry.storedAt);
  const ttl = Number.isFinite(entry.ttlMs) ? entry.ttlMs : SOURCE_META[sourceId].cacheTtlMs;
  if (!allowStale && Number.isFinite(age) && age > ttl) return null;
  return entry;
}

export function cachePut<T>(
  sourceId: SourceId,
  lat: number,
  lon: number,
  payload: T,
  provenance: Provenance,
  ttlMs?: number,
  extra = ''
): CacheEntry<T> {
  const key = cacheKey(sourceId, lat, lon, extra);
  const entry: CacheEntry<T> = {
    key,
    payload,
    storedAt: new Date().toISOString(),
    ttlMs: ttlMs ?? SOURCE_META[sourceId].cacheTtlMs,
    provenance,
  };
  try {
    writeRaw(key, JSON.stringify(entry));
  } catch {
    // A non-serialisable payload is simply not cached.
  }
  return entry;
}

/** Rewrite a live provenance as a cached one, preserving source and attribution. */
export function cachedProvenance(entry: CacheEntry<unknown>): Provenance {
  return {
    ...entry.provenance,
    status: 'cached',
    isEstimated: false,
    retrievedAt: entry.storedAt,
    freshness: `cached ${relativeTime(entry.storedAt)}`,
    cacheKey: entry.key,
  };
}

export function clearSerumpunCache(): void {
  const store = backend();
  if (store) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PREFIX)) keys.push(key);
      }
      for (const key of keys) store.removeItem(key);
    } catch {
      // Non-fatal.
    }
  }
  for (const key of Array.from(memory.keys())) {
    if (key.startsWith(PREFIX)) memory.delete(key);
  }
}
