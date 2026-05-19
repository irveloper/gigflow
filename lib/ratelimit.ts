import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// ---------------------------------------------------------------------------
// Upstash-backed rate limiters.
// When UPSTASH_REDIS_REST_URL / TOKEN are absent (e.g. local dev without Redis)
// the exports are null and middleware falls back to its in-process Map.
// ---------------------------------------------------------------------------

function createLimiters() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) return null

  const redis = new Redis({ url, token })

  return {
    /** Login endpoint: 10 attempts per 15 minutes per IP */
    loginRateLimit: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "15 m"),
      prefix: "rl:login",
    }),
    /** Registration: 5 attempts per hour per IP */
    registerRateLimit: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "rl:register",
    }),
  }
}

export const rateLimiters = createLimiters()
