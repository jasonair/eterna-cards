import { NextRequest, NextResponse } from 'next/server';

/**
 * In-memory rate limiter using a sliding window approach.
 * Tracks requests by IP address and optionally by authenticated user ID.
 *
 * OWASP best practice: rate limit all public-facing endpoints to prevent
 * brute-force, credential stuffing, and denial-of-service attacks.
 */

interface RateLimitEntry {
  timestamps: number[];
}

// Separate stores for IP-based and user-based limiting
const ipStore = new Map<string, RateLimitEntry>();
const userStore = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStaleEntries(store: Map<string, RateLimitEntry>, windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  limit: number;
  /** Time window in milliseconds (default: 60_000 = 1 minute) */
  windowMs?: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

/**
 * Check whether a request is within the rate limit.
 * Returns headers-friendly metadata so callers can attach X-RateLimit-* headers.
 */
function checkLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const windowMs = config.windowMs ?? 60_000;
  const now = Date.now();
  const cutoff = now - windowMs;

  cleanupStaleEntries(store, windowMs);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= config.limit) {
    const oldestInWindow = entry.timestamps[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldestInWindow + windowMs - now,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.limit - entry.timestamps.length,
    resetMs: windowMs,
  };
}

/**
 * Extract the client IP from a Next.js request.
 * Prefers x-forwarded-for (first entry) then x-real-ip, then falls back to 'unknown'.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

/**
 * Rate-limit a request by IP address.
 * Default: 60 requests per minute per IP.
 */
export function rateLimitByIp(
  request: NextRequest,
  config: RateLimitConfig = { limit: 60, windowMs: 60_000 },
): RateLimitResult {
  const ip = getClientIp(request);
  return checkLimit(ipStore, ip, config);
}

/**
 * Rate-limit a request by authenticated user ID.
 * Default: 120 requests per minute per user.
 */
export function rateLimitByUser(
  userId: string,
  config: RateLimitConfig = { limit: 120, windowMs: 60_000 },
): RateLimitResult {
  return checkLimit(userStore, userId, config);
}

/**
 * Combined IP + user rate limiter. Returns a 429 response if either limit is exceeded.
 * Attach this at the top of any API route handler.
 *
 * Usage:
 *   const blocked = applyRateLimit(request, userId);
 *   if (blocked) return blocked;
 */
export function applyRateLimit(
  request: NextRequest,
  userId?: string,
  ipConfig?: RateLimitConfig,
  userConfig?: RateLimitConfig,
): NextResponse | null {
  // IP-based check (stricter – catches unauthenticated abuse)
  const ipResult = rateLimitByIp(request, ipConfig);
  if (!ipResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(ipResult.resetMs / 1000)),
          'X-RateLimit-Limit': String((ipConfig ?? { limit: 60 }).limit),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  // User-based check (if authenticated)
  if (userId) {
    const userResult = rateLimitByUser(userId, userConfig);
    if (!userResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(userResult.resetMs / 1000)),
            'X-RateLimit-Limit': String((userConfig ?? { limit: 120 }).limit),
            'X-RateLimit-Remaining': '0',
          },
        },
      );
    }
  }

  return null; // Request is allowed
}
