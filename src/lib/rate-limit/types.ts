export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string; // ISO date YYYY-MM-DD
}

export interface RateLimitService {
  check(principalType: "anon" | "user", principalId: string): Promise<RateLimitResult>;
  consume(principalType: "anon" | "user", principalId: string): Promise<RateLimitResult>;
}

export const RATE_LIMIT_CONFIG = {
  anonDailyLimit: parseInt(process.env.GUEST_DAILY_LIMIT_ANON ?? "10"),
  userDailyLimit: parseInt(process.env.GUEST_DAILY_LIMIT_USER ?? "25"),
} as const;
