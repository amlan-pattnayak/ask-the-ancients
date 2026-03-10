import { auth, currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import Navbar from "@/components/layout/Navbar";
import { api } from "@/lib/convex";
import { isAdminUser } from "@/lib/admin";
import KpiCharts from "@/components/kpi/KpiCharts";

type MetricPoint = {
  date: string;
  value: number;
};

type DashboardData = {
  latestDate: string | null;
  startDate: string;
  endDate: string;
  days: number;
  snapshot: Record<string, { value: number; updatedAt: number } | null> | null;
  series: Record<string, MetricPoint[]>;
};

function formatMetricValue(metricName: string, value: number): string {
  if (metricName.includes("_rate")) return `${value.toFixed(1)}%`;
  return Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatDateLabel(date: string | null): string {
  if (!date) return "No data yet";
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function metricDelta(series: MetricPoint[]): number | null {
  if (series.length < 2) return null;
  return series[series.length - 1].value - series[series.length - 2].value;
}

function MetricCard({
  title,
  metricName,
  snapshot,
  series,
}: {
  title: string;
  metricName: string;
  snapshot: DashboardData["snapshot"];
  series: MetricPoint[];
}) {
  const current = snapshot?.[metricName]?.value ?? null;
  const delta = metricDelta(series);
  const deltaText =
    delta === null
      ? "No prior day"
      : `${delta >= 0 ? "+" : ""}${formatMetricValue(metricName, delta)}`;

  return (
    <article
      className="rounded-2xl p-4"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-strong)" }}
    >
      <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      <p className="mt-2 text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>
        {current === null ? "N/A" : formatMetricValue(metricName, current)}
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        Day-over-day: {deltaText}
      </p>
    </article>
  );
}

export default async function KpiPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/kpi");
  }

  const user = await currentUser();
  const primaryEmail =
    user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    null;

  if (!isAdminUser({ userId, email: primaryEmail })) {
    notFound();
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const [kpi7, kpi30, kpi90] = await Promise.all([
    convex.query(api.analytics.getKpiDashboardData, { days: 7 }),
    convex.query(api.analytics.getKpiDashboardData, { days: 30 }),
    convex.query(api.analytics.getKpiDashboardData, { days: 90 }),
  ]) as [DashboardData, DashboardData, DashboardData];

  const latestDate = kpi30.latestDate;

  const cards = [
    { title: "Daily Unique Visitors", metricName: "duv" },
    { title: "Canonical Message Sent", metricName: "canonical_message_sent_count" },
    { title: "Activation Rate (24h)", metricName: "activation_24h_rate" },
    { title: "BYOK Adoption (Signed-in)", metricName: "byok_adoption_rate_signed_in" },
  ];

  return (
    <div className="min-h-screen pb-12" style={{ background: "var(--bg-primary)" }}>
      <Navbar />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <header className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-strong)" }}>
          <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
            Admin KPI Dashboard
          </p>
          <h1 className="mt-1 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Product Metrics
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Latest rollup date: {formatDateLabel(latestDate)} (UTC)
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <MetricCard
              key={card.metricName}
              title={card.title}
              metricName={card.metricName}
              snapshot={kpi30.snapshot}
              series={kpi30.series[card.metricName] ?? []}
            />
          ))}
        </section>

        <KpiCharts
          seriesByWindow={{
            "7": {
              duvSeries: kpi7.series.duv ?? [],
              canonicalMessageSeries: kpi7.series.canonical_message_sent_count ?? [],
              activationRateSeries: kpi7.series.activation_24h_rate ?? [],
              byokRateSeries: kpi7.series.byok_adoption_rate_signed_in ?? [],
              startDate: kpi7.startDate,
              endDate: kpi7.endDate,
            },
            "30": {
              duvSeries: kpi30.series.duv ?? [],
              canonicalMessageSeries: kpi30.series.canonical_message_sent_count ?? [],
              activationRateSeries: kpi30.series.activation_24h_rate ?? [],
              byokRateSeries: kpi30.series.byok_adoption_rate_signed_in ?? [],
              startDate: kpi30.startDate,
              endDate: kpi30.endDate,
            },
            "90": {
              duvSeries: kpi90.series.duv ?? [],
              canonicalMessageSeries: kpi90.series.canonical_message_sent_count ?? [],
              activationRateSeries: kpi90.series.activation_24h_rate ?? [],
              byokRateSeries: kpi90.series.byok_adoption_rate_signed_in ?? [],
              startDate: kpi90.startDate,
              endDate: kpi90.endDate,
            },
          }}
        />

        <section>
          <article className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-strong)" }}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
              30-Day Coverage
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              {cards.map((card) => {
                const points = kpi30.series[card.metricName] ?? [];
                return (
                  <div key={card.metricName} className="flex items-center justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>{card.title}</span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {points.length} days populated
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
              Window: {kpi30.startDate} to {kpi30.endDate} (UTC)
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
