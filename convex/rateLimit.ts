import { v } from "convex/values";
import { query, internalMutation, internalQuery, mutation } from "./_generated/server";
import { assertPrincipalAccess } from "./authz";

function todayUTC(): string {
  return new Date().toISOString().split("T")[0];
}

// Minimum milliseconds between accepted messages (burst protection).
// Prevents scripted rapid-fire requests from overwhelming the inference pipeline.
const BURST_MIN_INTERVAL_MS = parseInt(
  process.env.BURST_MIN_INTERVAL_MS ?? "3000"
);

type ConsumeResult =
  | { allowed: true; remaining: number }
  | { allowed: false; remaining: 0; reason: "daily_limit" | "burst" };

async function consumeHandler(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: { db: { query: (...args: any[]) => any; patch: (...args: any[]) => any; insert: (...args: any[]) => any; get: (...args: any[]) => any } },
  args: { principalType: "anon" | "user"; principalId: string; count?: number },
  limits: { anon: number; user: number }
): Promise<ConsumeResult> {
  const now = Date.now();
  const date = todayUTC();
  const count = args.count ?? 1;
  const limit =
    args.principalType === "anon" ? limits.anon : limits.user;

  const counter = await ctx.db
    .query("usage_counters")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex("by_principal_date", (q: any) =>
      q
        .eq("principalType", args.principalType)
        .eq("principalId", args.principalId)
        .eq("date", date)
    )
    .first();

  // ── Burst check ─────────────────────────────────────────────────────────
  if (counter?.lastMessageAt !== undefined) {
    const elapsed = now - counter.lastMessageAt;
    if (elapsed < BURST_MIN_INTERVAL_MS) {
      return { allowed: false, remaining: 0, reason: "burst" };
    }
  }

  // ── Daily limit check ────────────────────────────────────────────────────
  if (counter) {
    if (counter.messageCount + count > limit) {
      return { allowed: false, remaining: 0, reason: "daily_limit" };
    }
    await ctx.db.patch(counter._id, {
      messageCount: counter.messageCount + count,
      lastMessageAt: now,
    });
    return { allowed: true, remaining: limit - counter.messageCount - count };
  } else {
    await ctx.db.insert("usage_counters", {
      principalType: args.principalType,
      principalId: args.principalId,
      date,
      messageCount: count,
      lastMessageAt: now,
    });
    return { allowed: true, remaining: limit - count };
  }
}

/**
 * Sums total messages sent across all principals for a given date.
 * Used by the daily budget-monitoring cron.
 */
export const sumDailyMessages = internalQuery({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    // There's no aggregate query in Convex, so we collect all rows for the
    // date and sum — acceptable for M2 (row count is bounded by daily limits).
    const rows = await ctx.db
      .query("usage_counters")
      .filter((q) => q.eq(q.field("date"), args.date))
      .collect();
    return rows.reduce((acc, r) => acc + r.messageCount, 0);
  },
});

export const check = query({
  args: {
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertPrincipalAccess(ctx, args.principalType, args.principalId);
    const date = todayUTC();
    const limitAnon = parseInt(process.env.GUEST_DAILY_LIMIT_ANON ?? "10");
    const limitUser = parseInt(process.env.GUEST_DAILY_LIMIT_USER ?? "25");
    const limit = args.principalType === "anon" ? limitAnon : limitUser;

    const counter = await ctx.db
      .query("usage_counters")
      .withIndex("by_principal_date", (q) =>
        q
          .eq("principalType", args.principalType)
          .eq("principalId", args.principalId)
          .eq("date", date)
      )
      .first();

    const used = counter?.messageCount ?? 0;
    return {
      allowed: used < limit,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetAt: date,
    };
  },
});

/**
 * Public version — called from the Next.js streaming API route.
 * Includes both daily-limit and burst-rate checks.
 */
export const consumePublic = mutation({
  args: {
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    count: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertPrincipalAccess(ctx, args.principalType, args.principalId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return consumeHandler(ctx as any, args, {
      anon: parseInt(process.env.GUEST_DAILY_LIMIT_ANON ?? "10"),
      user: parseInt(process.env.GUEST_DAILY_LIMIT_USER ?? "25"),
    });
  },
});

/**
 * Internal version — called from Convex scheduled actions (guest Groq path).
 * Includes both daily-limit and burst-rate checks.
 */
export const consume = internalMutation({
  args: {
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
  },
  handler: async (ctx, args) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return consumeHandler(ctx as any, args, {
      anon: parseInt(process.env.GUEST_DAILY_LIMIT_ANON ?? "10"),
      user: parseInt(process.env.GUEST_DAILY_LIMIT_USER ?? "25"),
    });
  },
});
