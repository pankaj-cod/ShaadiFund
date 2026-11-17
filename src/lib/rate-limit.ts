import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getEnv } from "./env";
import { RateLimitedError } from "./errors";
import { logger } from "./logger";

/**
 * Rate limiting (ADR 0005).
 *
 * With Upstash configured, limits are shared by every server instance, which is
 * what a host like Vercel needs. Without it (development, tests) an in-memory
 * fixed window is used, which is only correct for a single process.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

function checkInMemory(key: string, limit: number, windowMs: number, now: number): boolean {
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

let redis: Redis | null | undefined;
const limiters = new Map<string, Ratelimit>();

function sharedLimiter(limit: number, windowMs: number): Ratelimit | null {
  if (redis === undefined) {
    const env = getEnv();
    redis =
      env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
        ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
        : null;
  }
  if (!redis) return null;
  const id = `${limit}/${windowMs}`;
  let limiter = limiters.get(id);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(limit, `${Math.max(1, Math.round(windowMs / 1000))} s`),
      prefix: "shaadifund:rl",
      analytics: false,
    });
    limiters.set(id, limiter);
  }
  return limiter;
}

/** Throws RateLimitedError once `key` has been used `limit` times within `windowMs`. */
export async function assertWithinRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): Promise<void> {
  const limiter = sharedLimiter(limit, windowMs);
  if (!limiter) {
    if (!checkInMemory(key, limit, windowMs, now)) throw new RateLimitedError();
    return;
  }
  let allowed: boolean;
  try {
    ({ success: allowed } = await limiter.limit(key));
  } catch (error) {
    // If the limit store is unreachable, let real people through rather than
    // blocking every guest, and say so loudly.
    logger.error("Rate limit store unavailable; request allowed", { key, error });
    return;
  }
  if (!allowed) throw new RateLimitedError();
}

/** Test helper: clears the in-memory windows. */
export function resetRateLimits(): void {
  windows.clear();
}
