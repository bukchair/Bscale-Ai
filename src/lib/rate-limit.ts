/**
 * In-memory per-user rate limiter.
 *
 * Usage:
 *   const result = rateLimit(userId, { limit: 10, windowMs: 60_000 });
 *   if (!result.allowed) return 429;
 *
 * Each (key, window) bucket is stored in a Map and expires automatically
 * when the window rolls over.  This is process-local — good enough for
 * single-instance deployments; swap for Redis-backed counters when
 * running multiple replicas.
 */

interface BucketEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, BucketEntry>();

export interface RateLimitOptions {
  /** Maximum number of requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. Default: 60 000 (1 min). */
  windowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** How many requests the caller has made this window (after this one). */
  current: number;
  remaining: number;
  /** Unix timestamp (ms) when the current window resets. */
  resetAt: number;
}

/**
 * Check and increment the rate-limit counter for `key`.
 * @param key      Unique identifier for the subject (e.g. user ID or IP).
 * @param options  Limit and window configuration.
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const { limit, windowMs = 60_000 } = options;
  const now = Date.now();

  let entry = buckets.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    buckets.set(key, entry);
  }

  entry.count += 1;

  const allowed = entry.count <= limit;
  const remaining = Math.max(0, limit - entry.count);

  return { allowed, current: entry.count, remaining, resetAt: entry.resetAt };
}

/** Periodically purge expired buckets to prevent unbounded memory growth. */
function pruneExpiredBuckets(): void {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now >= entry.resetAt) buckets.delete(key);
  }
}

// Prune every 5 minutes (only runs in long-lived Node.js processes).
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(pruneExpiredBuckets, 5 * 60_000);
  // Allow the process to exit even if this timer is still active.
  if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
    (timer as NodeJS.Timeout).unref();
  }
}
