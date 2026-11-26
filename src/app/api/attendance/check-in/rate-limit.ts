const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function resetCheckInRateLimiter() {
  rateLimitStore.clear();
}

export function checkRateLimit(
  key: string,
  nowMs = Date.now(),
): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const existing = rateLimitStore.get(key);
  if (!existing || nowMs >= existing.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: nowMs + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - nowMs) / 1000),
      ),
    };
  }
  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

