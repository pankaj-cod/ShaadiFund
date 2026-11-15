import { RateLimitedError } from "./errors";

/**
 * Fixed-window rate limiter. This in-memory version is correct for a single
 * server process (development, tests). Production needs a shared store
 * (ADR 0005: Upstash) behind this same function before launch.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export function assertWithinRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): void {
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) throw new RateLimitedError();
  current.count += 1;
}

/** Test helper. */
export function resetRateLimits(): void {
  windows.clear();
}
