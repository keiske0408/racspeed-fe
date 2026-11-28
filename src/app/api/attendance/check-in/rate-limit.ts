import { createRateLimiter } from "@/lib/rate-limit";
const rateLimiter = createRateLimiter(30);

export function resetCheckInRateLimiter() {
  rateLimiter.reset();
}

export function checkRateLimit(
  key: string,
  nowMs = Date.now(),
): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  return rateLimiter.check(key, nowMs);
}

