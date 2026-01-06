type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inFlightLoads = new Map<string, Promise<unknown>>();

function isExpired(entry: CacheEntry<unknown>) {
  return entry.expiresAt <= Date.now();
}

export function clearCache(key?: string) {
  if (key) {
    cacheStore.delete(key);
    inFlightLoads.delete(key);
    return;
  }

  cacheStore.clear();
  inFlightLoads.clear();
}

export function getCacheValue<T>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    cacheStore.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setCacheValue<T>(key: string, value: T, ttlMs: number) {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export async function getOrSetCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  forceRefresh = false,
): Promise<T> {
  if (!forceRefresh) {
    const cached = getCacheValue<T>(key);
    if (cached !== null) {
      return cached;
    }

    const pending = inFlightLoads.get(key);
    if (pending) {
      return pending as Promise<T>;
    }
  } else {
    clearCache(key);
  }

  const loadPromise = loader()
    .then((value) => {
      setCacheValue(key, value, ttlMs);
      inFlightLoads.delete(key);
      return value;
    })
    .catch((error) => {
      inFlightLoads.delete(key);
      throw error;
    });

  inFlightLoads.set(key, loadPromise);
  return loadPromise;
}
