import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";

const ALLOWED_EVENT_NAMES = new Set([
  "app_open",
  "session_heartbeat",
  "session_end",
  "thread_created",
  "message_sent",
  "assistant_response_received",
  "assistant_response_failed",
  "bookmark_added",
  "citation_opened",
  "signin_completed",
  "principal_merged",
  "byok_settings_opened",
  "byok_connection_tested",
  "mode_switched_guest_to_byok",
  "mode_switched_byok_to_guest",
]);

const SENSITIVE_KEY_PATTERN =
  /(api[_-]?key|authorization|token|secret|password|passwd|private[_-]?key)/i;
const SENSITIVE_VALUE_PATTERN =
  /\b(sk-[A-Za-z0-9_-]{10,}|gsk_[A-Za-z0-9_]{10,}|sk-ant-[A-Za-z0-9_-]{10,}|sk-or-[A-Za-z0-9_-]{10,})\b/;

function hasSensitiveContent(input: unknown): boolean {
  if (typeof input === "string") {
    return SENSITIVE_VALUE_PATTERN.test(input);
  }
  if (Array.isArray(input)) {
    return input.some((item) => hasSensitiveContent(item));
  }
  if (input && typeof input === "object") {
    for (const [key, value] of Object.entries(input)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) return true;
      if (hasSensitiveContent(value)) return true;
    }
  }
  return false;
}

export const trackEvent = mutation({
  args: {
    eventId: v.string(),
    schemaVersion: v.number(),
    eventName: v.string(),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    sessionId: v.optional(v.string()),
    timestamp: v.number(),
    source: v.union(v.literal("client"), v.literal("server")),
    properties: v.any(),
  },
  handler: async (ctx, args) => {
    if (args.schemaVersion !== 1) {
      throw new Error("Unsupported analytics schema version");
    }
    if (!ALLOWED_EVENT_NAMES.has(args.eventName)) {
      throw new Error("Unsupported event name");
    }
    if (args.eventId.trim().length < 8) {
      throw new Error("Invalid eventId");
    }

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (args.timestamp < now - sevenDaysMs || args.timestamp > now + 5 * 60 * 1000) {
      throw new Error("Event timestamp outside allowed ingestion window");
    }

    const serializedProperties = JSON.stringify(args.properties ?? {});
    if (serializedProperties.length > 4096) {
      throw new Error("Event properties exceed 4KB limit");
    }
    if (hasSensitiveContent(args.properties)) {
      throw new Error("Event properties contain sensitive content");
    }

    const existing = await ctx.db
      .query("product_events")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .unique();

    if (existing) {
      return { ok: true, deduped: true, eventDocId: existing._id };
    }

    const eventDocId = await ctx.db.insert("product_events", {
      ...args,
    });

    return { ok: true, deduped: false, eventDocId };
  },
});

export const startSession = mutation({
  args: {
    sessionId: v.string(),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    startedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const startedAt = args.startedAt ?? Date.now();
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (existing) {
      if (
        existing.principalType !== args.principalType ||
        existing.principalId !== args.principalId
      ) {
        return {
          ok: false,
          reason: "principal_mismatch" as const,
          sessionDocId: existing._id,
        };
      }
      await ctx.db.patch(existing._id, {
        lastSeenAt: startedAt,
      });
      return { ok: true, sessionDocId: existing._id, created: false };
    }

    const sessionDocId = await ctx.db.insert("sessions", {
      sessionId: args.sessionId,
      principalType: args.principalType,
      principalId: args.principalId,
      startedAt,
      lastSeenAt: startedAt,
      eventCount: 0,
    });
    return { ok: true, sessionDocId, created: true };
  },
});

export const heartbeatSession = mutation({
  args: {
    sessionId: v.string(),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const at = args.at ?? Date.now();
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!existing) {
      const sessionDocId = await ctx.db.insert("sessions", {
        sessionId: args.sessionId,
        principalType: args.principalType,
        principalId: args.principalId,
        startedAt: at,
        lastSeenAt: at,
        eventCount: 1,
      });
      return { ok: true, sessionDocId, created: true };
    }

    if (
      existing.principalType !== args.principalType ||
      existing.principalId !== args.principalId
    ) {
      return {
        ok: false,
        reason: "principal_mismatch" as const,
        sessionDocId: existing._id,
      };
    }

    await ctx.db.patch(existing._id, {
      lastSeenAt: at,
      eventCount: (existing.eventCount ?? 0) + 1,
    });
    return { ok: true, sessionDocId: existing._id, created: false };
  },
});

export const endSession = mutation({
  args: {
    sessionId: v.string(),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    endedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const endedAt = args.endedAt ?? Date.now();
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!existing) {
      return { ok: false, reason: "not_found" as const };
    }
    if (
      existing.principalType !== args.principalType ||
      existing.principalId !== args.principalId
    ) {
      return {
        ok: false,
        reason: "principal_mismatch" as const,
        sessionDocId: existing._id,
      };
    }

    const startedAt = existing.startedAt;
    const safeEnd = Math.max(endedAt, startedAt);
    const durationMs = safeEnd - startedAt;

    await ctx.db.patch(existing._id, {
      endedAt: safeEnd,
      lastSeenAt: safeEnd,
      durationMs,
    });

    return { ok: true, sessionDocId: existing._id, durationMs };
  },
});

export const upsertDailyKpi = mutation({
  args: {
    date: v.string(), // YYYY-MM-DD
    metricName: v.string(),
    metricValue: v.float64(),
    meta: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("daily_kpis")
      .withIndex("by_date_metric", (q) =>
        q.eq("date", args.date).eq("metricName", args.metricName)
      )
      .unique();

    const updatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        metricValue: args.metricValue,
        meta: args.meta,
        updatedAt,
      });
      return { ok: true, kpiDocId: existing._id, created: false };
    }

    const kpiDocId = await ctx.db.insert("daily_kpis", {
      ...args,
      updatedAt,
    });
    return { ok: true, kpiDocId, created: true };
  },
});

export const listDailyKpisByDate = query({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("daily_kpis")
      .withIndex("by_date_metric", (q) => q.eq("date", args.date))
      .collect();
  },
});

export const listDailyKpiSeries = query({
  args: {
    metricName: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("daily_kpis")
      .withIndex("by_metric_date", (q) =>
        q
          .eq("metricName", args.metricName)
          .gte("date", args.startDate)
          .lte("date", args.endDate)
      )
      .collect();
  },
});

function utcDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

function dateDaysAgoUtc(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return utcDateString(d);
}

type DashboardMetricName =
  | "duv"
  | "canonical_message_sent_count"
  | "activation_24h_rate"
  | "byok_adoption_rate_signed_in"
  | "signed_in_users_daily";

const DASHBOARD_METRICS: DashboardMetricName[] = [
  "duv",
  "canonical_message_sent_count",
  "activation_24h_rate",
  "byok_adoption_rate_signed_in",
  "signed_in_users_daily",
];

export const getKpiDashboardData = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = Math.max(1, Math.min(90, Math.floor(args.days ?? 30)));
    const startDate = dateDaysAgoUtc(days - 1);
    const endDate = utcDateString(new Date());

    const seriesByMetric = new Map<DashboardMetricName, Array<{
      date: string;
      value: number;
      meta?: unknown;
      updatedAt: number;
    }>>();

    for (const metricName of DASHBOARD_METRICS) {
      const rows = await ctx.db
        .query("daily_kpis")
        .withIndex("by_metric_date", (q) =>
          q
            .eq("metricName", metricName)
            .gte("date", startDate)
            .lte("date", endDate)
        )
        .collect();

      seriesByMetric.set(
        metricName,
        rows.map((row) => ({
          date: row.date,
          value: row.metricValue,
          meta: row.meta,
          updatedAt: row.updatedAt,
        }))
      );
    }

    const allDates = new Set<string>();
    for (const rows of seriesByMetric.values()) {
      for (const row of rows) {
        allDates.add(row.date);
      }
    }

    const sortedDates = Array.from(allDates).sort((a, b) => a.localeCompare(b));
    const latestDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;

    const snapshot = latestDate
      ? Object.fromEntries(
          DASHBOARD_METRICS.map((metricName) => {
            const item = seriesByMetric.get(metricName)?.find((row) => row.date === latestDate);
            return [metricName, item ? { value: item.value, meta: item.meta, updatedAt: item.updatedAt } : null];
          })
        )
      : null;

    return {
      latestDate,
      startDate,
      endDate,
      days,
      snapshot,
      series: Object.fromEntries(
        DASHBOARD_METRICS.map((metricName) => [metricName, seriesByMetric.get(metricName) ?? []])
      ),
    };
  },
});

function utcDayRange(date: string): { startTs: number; endTs: number } {
  const startTs = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(startTs)) {
    throw new Error("Invalid date format, expected YYYY-MM-DD");
  }
  return { startTs, endTs: startTs + 24 * 60 * 60 * 1000 };
}

function principalKey(principalType: "anon" | "user", principalId: string): string {
  return `${principalType}:${principalId}`;
}

export const computeDailyKpis = internalQuery({
  args: {
    date: v.string(), // YYYY-MM-DD (UTC day)
  },
  handler: async (ctx, args) => {
    const { startTs, endTs } = utcDayRange(args.date);

    const dayEvents = await ctx.db
      .query("product_events")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", startTs).lt("timestamp", endTs)
      )
      .collect();

    const dayAppOpenEvents = dayEvents.filter((e) => e.eventName === "app_open");
    const uniqueVisitors = new Set<string>();
    for (const e of dayAppOpenEvents) {
      uniqueVisitors.add(principalKey(e.principalType, e.principalId));
    }

    // Canonical message source for KPI computation: server-side message_sent only.
    const dayCanonicalMessageSent = dayEvents.filter(
      (e) => e.eventName === "message_sent" && e.source === "server"
    );

    const allAppOpenEvents = await ctx.db
      .query("product_events")
      .withIndex("by_event_timestamp", (q) => q.eq("eventName", "app_open"))
      .collect();
    const firstOpenByPrincipal = new Map<string, number>();
    for (const e of allAppOpenEvents) {
      const key = principalKey(e.principalType, e.principalId);
      const prev = firstOpenByPrincipal.get(key);
      if (prev === undefined || e.timestamp < prev) {
        firstOpenByPrincipal.set(key, e.timestamp);
      }
    }

    const newVisitors = new Set<string>();
    for (const [key, firstTs] of firstOpenByPrincipal.entries()) {
      if (firstTs >= startTs && firstTs < endTs) {
        newVisitors.add(key);
      }
    }

    const allMessageSentEvents = await ctx.db
      .query("product_events")
      .withIndex("by_event_timestamp", (q) => q.eq("eventName", "message_sent"))
      .collect();
    const firstCanonicalMessageByPrincipal = new Map<string, number>();
    for (const e of allMessageSentEvents) {
      if (e.source !== "server") continue;
      const key = principalKey(e.principalType, e.principalId);
      const prev = firstCanonicalMessageByPrincipal.get(key);
      if (prev === undefined || e.timestamp < prev) {
        firstCanonicalMessageByPrincipal.set(key, e.timestamp);
      }
    }

    let activationNumerator = 0;
    const activationDenominator = newVisitors.size;
    for (const key of newVisitors) {
      const firstOpenTs = firstOpenByPrincipal.get(key);
      const firstMessageTs = firstCanonicalMessageByPrincipal.get(key);
      if (firstOpenTs === undefined || firstMessageTs === undefined) continue;
      if (firstMessageTs >= firstOpenTs && firstMessageTs <= firstOpenTs + 24 * 60 * 60 * 1000) {
        activationNumerator += 1;
      }
    }
    const activationRate =
      activationDenominator > 0
        ? (activationNumerator / activationDenominator) * 100
        : 0;

    const activeSignedInUsers = new Set<string>();
    for (const e of dayAppOpenEvents) {
      if (e.principalType === "user") {
        activeSignedInUsers.add(e.principalId);
      }
    }

    let byokNumerator = 0;
    const byokDenominator = activeSignedInUsers.size;
    for (const userPrincipalId of activeSignedInUsers) {
      const setting = await ctx.db
        .query("provider_settings")
        .withIndex("by_principal", (q) =>
          q.eq("principalType", "user").eq("principalId", userPrincipalId)
        )
        .first();
      if (setting?.mode === "byok") {
        byokNumerator += 1;
      }
    }
    const byokAdoptionRate =
      byokDenominator > 0 ? (byokNumerator / byokDenominator) * 100 : 0;

    return {
      date: args.date,
      duv: uniqueVisitors.size,
      canonicalMessageSentCount: dayCanonicalMessageSent.length,
      activation24hRate: activationRate,
      activation24hNumerator: activationNumerator,
      activation24hDenominator: activationDenominator,
      byokAdoptionRateSignedIn: byokAdoptionRate,
      byokAdoptionNumerator: byokNumerator,
      byokAdoptionDenominator: byokDenominator,
      signedInUsersDaily: activeSignedInUsers.size,
    };
  },
});
