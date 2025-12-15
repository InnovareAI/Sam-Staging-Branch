/**
 * Persistent Cache Layer
 *
 * Provides localStorage-based caching with:
 * - TTL (time-to-live) expiration
 * - Automatic cleanup of expired entries
 * - Type-safe get/set operations
 * - Namespace isolation
 */

const CACHE_PREFIX = 'sam_cache_';
const CACHE_INDEX_KEY = 'sam_cache_index';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

interface CacheIndex {
  keys: string[];
  lastCleanup: number;
}

// Cleanup interval: 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Get the cache index
 */
function getCacheIndex(): CacheIndex {
  if (typeof window === 'undefined') {
    return { keys: [], lastCleanup: Date.now() };
  }

  try {
    const index = localStorage.getItem(CACHE_INDEX_KEY);
    return index ? JSON.parse(index) : { keys: [], lastCleanup: Date.now() };
  } catch {
    return { keys: [], lastCleanup: Date.now() };
  }
}

/**
 * Update the cache index
 */
function updateCacheIndex(keys: string[]): void {
  if (typeof window === 'undefined') return;

  try {
    const index: CacheIndex = {
      keys,
      lastCleanup: Date.now(),
    };
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clean up expired cache entries
 */
function cleanupExpiredEntries(): void {
  if (typeof window === 'undefined') return;

  const index = getCacheIndex();
  const now = Date.now();

  // Only cleanup every 5 minutes
  if (now - index.lastCleanup < CLEANUP_INTERVAL) {
    return;
  }

  const validKeys: string[] = [];

  for (const key of index.keys) {
    try {
      const fullKey = CACHE_PREFIX + key;
      const raw = localStorage.getItem(fullKey);

      if (raw) {
        const entry: CacheEntry<unknown> = JSON.parse(raw);
        const isExpired = now - entry.timestamp > entry.ttl;

        if (isExpired) {
          localStorage.removeItem(fullKey);
        } else {
          validKeys.push(key);
        }
      }
    } catch {
      // Remove invalid entries
      localStorage.removeItem(CACHE_PREFIX + key);
    }
  }

  updateCacheIndex(validKeys);
}

/**
 * Set a value in the cache
 */
export function cacheSet<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
  if (typeof window === 'undefined') return;

  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    };

    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));

    // Update index
    const index = getCacheIndex();
    if (!index.keys.includes(key)) {
      index.keys.push(key);
      updateCacheIndex(index.keys);
    }

    // Trigger cleanup occasionally
    cleanupExpiredEntries();
  } catch (e) {
    console.warn('Cache set failed:', e);
  }
}

/**
 * Get a value from the cache
 */
export function cacheGet<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;

    if (isExpired) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Check if a key exists and is not expired
 */
export function cacheHas(key: string): boolean {
  return cacheGet(key) !== null;
}

/**
 * Remove a key from the cache
 */
export function cacheRemove(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(CACHE_PREFIX + key);

    // Update index
    const index = getCacheIndex();
    const filtered = index.keys.filter(k => k !== key);
    updateCacheIndex(filtered);
  } catch {
    // Ignore errors
  }
}

/**
 * Clear all cache entries
 */
export function cacheClear(): void {
  if (typeof window === 'undefined') return;

  const index = getCacheIndex();

  for (const key of index.keys) {
    try {
      localStorage.removeItem(CACHE_PREFIX + key);
    } catch {
      // Ignore errors
    }
  }

  updateCacheIndex([]);
}

/**
 * Get cache stats
 */
export function cacheStats(): { keys: number; totalSize: number } {
  if (typeof window === 'undefined') {
    return { keys: 0, totalSize: 0 };
  }

  const index = getCacheIndex();
  let totalSize = 0;

  for (const key of index.keys) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (raw) {
        totalSize += raw.length * 2; // UTF-16 encoding
      }
    } catch {
      // Ignore errors
    }
  }

  return {
    keys: index.keys.length,
    totalSize,
  };
}

// Pre-defined cache keys with TTLs
export const CACHE_KEYS = {
  WORKSPACES: { key: 'workspaces', ttl: 5 * 60 * 1000 },          // 5 min
  CURRENT_WORKSPACE: { key: 'current_workspace', ttl: 30 * 60 * 1000 }, // 30 min
  CAMPAIGNS: { key: 'campaigns', ttl: 60 * 1000 },                // 1 min
  LINKEDIN_STATUS: { key: 'linkedin_status', ttl: 2 * 60 * 1000 }, // 2 min
  USER_PROFILE: { key: 'user_profile', ttl: 10 * 60 * 1000 },     // 10 min
  DASHBOARD_STATS: { key: 'dashboard_stats', ttl: 30 * 1000 },    // 30 sec
} as const;

/**
 * Workspace-specific cache key
 */
export function workspaceCacheKey(workspaceId: string, suffix: string): string {
  return `ws_${workspaceId}_${suffix}`;
}
