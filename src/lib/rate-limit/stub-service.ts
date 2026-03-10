import type { RateLimitService, RateLimitResult } from "./types";

// TODO M2: Replace with real implementation backed by Convex usage_counters table
export const stubRateLimitService: RateLimitService = {
  async check(_principalType, _principalId): Promise<RateLimitResult> {
    return { allowed: true, remaining: 10, resetAt: new Date().toISOString().split("T")[0] };
  },
  async consume(_principalType, _principalId): Promise<RateLimitResult> {
    return { allowed: true, remaining: 9, resetAt: new Date().toISOString().split("T")[0] };
  },
};
