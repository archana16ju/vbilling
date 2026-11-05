/**
 * In-memory client cache & promise deduplicator for lightweight GET requests
 * Prevents duplicate network calls across components (e.g. Header + Sidebar + Layout).
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

export async function fetchWithClientCache<T = any>(
  url: string,
  options?: RequestInit,
  ttlMs: number = 30000
): Promise<T> {
  const now = Date.now();
  const cacheKey = `${url}`;

  // 1. Return fresh cached data if valid
  const cached = memoryCache.get(cacheKey);
  if (cached && now - cached.timestamp < cached.ttlMs) {
    return cached.data;
  }

  // 2. Deduplicate simultaneous in-flight requests
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey) as Promise<T>;
  }

  // 3. Initiate fetch and store promise
  const promise = (async () => {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      memoryCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttlMs,
      });
      return data;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

/**
 * Invalidates specific cache key or all cache entries
 * Call when company switches or user logs out.
 */
export function invalidateClientCache(urlPattern?: string) {
  if (!urlPattern) {
    memoryCache.clear();
    inFlightRequests.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.includes(urlPattern)) {
      memoryCache.delete(key);
    }
  }
  for (const key of inFlightRequests.keys()) {
    if (key.includes(urlPattern)) {
      inFlightRequests.delete(key);
    }
  }
}
