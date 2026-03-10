import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

/**
 * Daily budget monitoring — runs at 23:55 UTC every day.
 *
 * Tallies guest messages consumed today and logs a warning if the count
 * exceeds the configured alert threshold.  For now alerts go to Convex logs
 * (visible in the dashboard); hook up a real webhook in a follow-up once a
 * notification target is decided.
 */
export const checkDailyBudget = internalAction({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    const alertThreshold = parseInt(
      process.env.BUDGET_ALERT_THRESHOLD ?? "500"
    );

    // Sum today's message counts across all usage_counter rows for today.
    // We use a query via runQuery — no direct DB access in actions.
    const total = await ctx.runQuery(
      internal.rateLimit.sumDailyMessages,
      { date: today }
    );

    const status = total >= alertThreshold ? "🚨 ALERT" : "✅ OK";
    console.log(
      `[budget] ${status} — ${total} guest messages sent on ${today} (threshold: ${alertThreshold})`
    );

    if (total >= alertThreshold) {
      // TODO M3: call a webhook (Slack / PagerDuty / email) here.
      console.warn(
        `[budget] Daily guest message threshold exceeded! ${total} >= ${alertThreshold}. ` +
          `Consider reducing GUEST_DAILY_LIMIT_ANON / GUEST_DAILY_LIMIT_USER or enabling the kill switch.`
      );
    }
  },
});

function previousUtcDateString(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

/**
 * Daily KPI rollup — computes prior UTC day's product KPIs and upserts them
 * into the daily_kpis table.
 *
 * Canonical KPI source for message throughput is server-side message_sent.
 * Client-side message_sent remains UX telemetry only.
 */
export const runDailyKpiRollups = internalAction({
  args: {},
  handler: async (ctx) => {
    const date = previousUtcDateString();

    const metrics = await ctx.runQuery(internal.analytics.computeDailyKpis, { date });

    const writes = [
      {
        metricName: "duv",
        metricValue: metrics.duv,
      },
      {
        metricName: "canonical_message_sent_count",
        metricValue: metrics.canonicalMessageSentCount,
      },
      {
        metricName: "activation_24h_rate",
        metricValue: metrics.activation24hRate,
        meta: {
          numerator: metrics.activation24hNumerator,
          denominator: metrics.activation24hDenominator,
        },
      },
      {
        metricName: "byok_adoption_rate_signed_in",
        metricValue: metrics.byokAdoptionRateSignedIn,
        meta: {
          numerator: metrics.byokAdoptionNumerator,
          denominator: metrics.byokAdoptionDenominator,
        },
      },
      {
        metricName: "signed_in_users_daily",
        metricValue: metrics.signedInUsersDaily,
      },
    ] as const;

    for (const item of writes) {
      await ctx.runMutation(api.analytics.upsertDailyKpi, {
        date,
        metricName: item.metricName,
        metricValue: item.metricValue,
        meta: "meta" in item ? item.meta : undefined,
      });
    }

    console.log(
      `[kpi-rollup] ${date} duv=${metrics.duv} canonical_message_sent_count=${metrics.canonicalMessageSentCount} activation_24h_rate=${metrics.activation24hRate.toFixed(
        2
      )}% byok_adoption_rate_signed_in=${metrics.byokAdoptionRateSignedIn.toFixed(2)}%`
    );
  },
});

const crons = cronJobs();

// Run budget check every day at 23:55 UTC
crons.daily(
  "daily-budget-check",
  { hourUTC: 23, minuteUTC: 55 },
  internal.crons.checkDailyBudget
);

// Run KPI rollups every day shortly after UTC midnight for prior day.
crons.daily(
  "daily-kpi-rollups",
  { hourUTC: 0, minuteUTC: 10 },
  internal.crons.runDailyKpiRollups
);

export default crons;
