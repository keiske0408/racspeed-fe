export function createRateLimiter(maxRequests: number, windowMs = 60_000) {
  const store = new Map<string, { count: number; resetAt: number }>();
  return {
    reset: () => store.clear(),
    check(key: string, nowMs = Date.now()) {
      for (const [storedKey, entry] of store) {
        if (nowMs >= entry.resetAt) store.delete(storedKey);
      }
      const existing = store.get(key);
      if (!existing) {
        if (store.size >= 10_000) {
          return { allowed: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };
        }
        store.set(key, { count: 1, resetAt: nowMs + windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }
      if (existing.count >= maxRequests) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000)),
        };
      }
      existing.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
