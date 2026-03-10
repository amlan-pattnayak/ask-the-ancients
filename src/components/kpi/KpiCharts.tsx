"use client";

import { useMemo, useState } from "react";

type MetricPoint = {
  date: string;
  value: number;
};

interface KpiChartsProps {
  seriesByWindow: Record<
    "7" | "30" | "90",
    {
      duvSeries: MetricPoint[];
      canonicalMessageSeries: MetricPoint[];
      activationRateSeries: MetricPoint[];
      byokRateSeries: MetricPoint[];
      startDate: string;
      endDate: string;
    }
  >;
}

type ChartSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

function toDayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function mergeDates(seriesList: MetricPoint[][]): string[] {
  const dates = new Set<string>();
  for (const series of seriesList) {
    for (const point of series) {
      dates.add(point.date);
    }
  }
  return Array.from(dates).sort((a, b) => a.localeCompare(b));
}

function valuesForDates(series: MetricPoint[], dates: string[]): number[] {
  const byDate = new Map(series.map((p) => [p.date, p.value]));
  return dates.map((d) => byDate.get(d) ?? 0);
}

function formatValue(value: number, isPercent: boolean): string {
  if (isPercent) return `${value.toFixed(1)}%`;
  return Intl.NumberFormat("en-US").format(Math.round(value));
}

function buildLinePath(values: number[], width: number, height: number, min: number, max: number): string {
  if (values.length === 0) return "";
  const range = Math.max(1, max - min);
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;

  return values
    .map((value, idx) => {
      const x = idx * stepX;
      const y = height - ((value - min) / range) * height;
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(linePath: string, width: number, height: number): string {
  if (!linePath) return "";
  return `${linePath} L ${width.toFixed(2)} ${height.toFixed(2)} L 0 ${height.toFixed(2)} Z`;
}

function MultiSeriesChart({
  title,
  dates,
  series,
  isPercent = false,
}: {
  title: string;
  dates: string[];
  series: ChartSeries[];
  isPercent?: boolean;
}) {
  const width = 720;
  const height = 240;
  const allValues = series.flatMap((s) => s.values);
  const min = 0;
  const max = Math.max(1, ...allValues);
  const latestLabel = dates.length > 0 ? toDayLabel(dates[dates.length - 1]) : "No data";
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const range = Math.max(1, max - min);
  const stepX = dates.length > 1 ? width / (dates.length - 1) : 0;

  const activeIndex = hoveredIndex ?? (dates.length > 0 ? dates.length - 1 : null);

  const activeTooltip = useMemo(() => {
    if (activeIndex === null || dates.length === 0) return null;
    const x = dates.length > 1 ? activeIndex * stepX : width;
    const values = series.map((s) => ({
      key: s.key,
      label: s.label,
      color: s.color,
      value: s.values[activeIndex] ?? 0,
    }));
    return {
      x,
      date: dates[activeIndex],
      values,
    };
  }, [activeIndex, dates, series, stepX]);

  function yForValue(value: number): number {
    return height - ((value - min) / range) * height;
  }

  function onPointerMove(event: React.MouseEvent<HTMLDivElement>) {
    if (dates.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const ratio = rect.width > 0 ? relativeX / rect.width : 0;
    const index = dates.length > 1
      ? Math.round(ratio * (dates.length - 1))
      : 0;
    setHoveredIndex(index);
  }

  function onPointerLeave() {
    setHoveredIndex(null);
  }

  return (
    <article
      className="rounded-2xl p-5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-strong)" }}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
          {title}
        </h2>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Last point: {latestLabel}
        </p>
      </div>

      {dates.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Not enough rollup data yet.
        </p>
      ) : (
        <>
          <div
            className="relative h-[240px] w-full overflow-hidden rounded-xl"
            style={{ background: "var(--bg-primary)" }}
            onMouseMove={onPointerMove}
            onMouseLeave={onPointerLeave}
          >
            <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
              {[0.25, 0.5, 0.75].map((ratio) => {
                const y = (height * ratio).toFixed(2);
                return (
                  <line
                    key={ratio}
                    x1="0"
                    y1={y}
                    x2={width}
                    y2={y}
                    stroke="rgba(148, 163, 184, 0.18)"
                    strokeWidth="1"
                    strokeDasharray="4 6"
                  />
                );
              })}

              {series.map((s) => {
                const linePath = buildLinePath(s.values, width, height, min, max);
                const areaPath = buildAreaPath(linePath, width, height);
                return (
                  <g key={s.key}>
                    {areaPath && (
                      <path
                        d={areaPath}
                        fill={s.color}
                        opacity="0.08"
                      />
                    )}
                    <path
                      d={linePath}
                      fill="none"
                      stroke={s.color}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {activeIndex !== null && s.values[activeIndex] !== undefined && (
                      <circle
                        cx={dates.length > 1 ? activeIndex * stepX : width}
                        cy={yForValue(s.values[activeIndex])}
                        r="4.5"
                        fill={s.color}
                        stroke="var(--bg-primary)"
                        strokeWidth="2"
                      />
                    )}
                  </g>
                );
              })}

              {activeTooltip && (
                <line
                  x1={activeTooltip.x}
                  y1={0}
                  x2={activeTooltip.x}
                  y2={height}
                  stroke="rgba(148, 163, 184, 0.4)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              )}
            </svg>

            {activeTooltip && (
              <div
                className="pointer-events-none absolute top-2 z-10 rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: "var(--border-strong)",
                  background: "rgba(2, 6, 23, 0.9)",
                  color: "var(--text-primary)",
                  left: `${Math.min(86, Math.max(2, (activeTooltip.x / width) * 100))}%`,
                  transform: "translateX(-50%)",
                  minWidth: "170px",
                }}
              >
                <p className="mb-1 font-semibold" style={{ color: "var(--accent-light)" }}>
                  {toDayLabel(activeTooltip.date)}
                </p>
                <div className="space-y-1">
                  {activeTooltip.values.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                        {item.label}
                      </span>
                      <span style={{ color: "var(--text-primary)" }}>
                        {formatValue(item.value, isPercent)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {series.map((s) => {
              const latest = s.values[s.values.length - 1] ?? 0;
              const prev = s.values[s.values.length - 2];
              const delta = prev === undefined ? null : latest - prev;
              return (
                <div key={s.key} className="rounded-xl px-3 py-2" style={{ background: "var(--bg-elevated)" }}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                      {s.label}
                    </span>
                  </div>
                  <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                    {formatValue(latest, isPercent)}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {delta === null ? "No prior day" : `DoD ${delta >= 0 ? "+" : ""}${formatValue(delta, isPercent)}`}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </article>
  );
}

export default function KpiCharts({
  seriesByWindow,
}: KpiChartsProps) {
  const [selectedWindow, setSelectedWindow] = useState<"7" | "30" | "90">("30");
  const selected = seriesByWindow[selectedWindow];

  const duvSeries = selected.duvSeries;
  const canonicalMessageSeries = selected.canonicalMessageSeries;
  const activationRateSeries = selected.activationRateSeries;
  const byokRateSeries = selected.byokRateSeries;

  const volumeDates = mergeDates([duvSeries, canonicalMessageSeries]);
  const rateDates = mergeDates([activationRateSeries, byokRateSeries]);

  const volumeSeries: ChartSeries[] = [
    {
      key: "duv",
      label: "Daily Unique Visitors",
      color: "#d4a843",
      values: valuesForDates(duvSeries, volumeDates),
    },
    {
      key: "canonical_message_sent_count",
      label: "Canonical Message Sent",
      color: "#7dd3fc",
      values: valuesForDates(canonicalMessageSeries, volumeDates),
    },
  ];

  const rateSeries: ChartSeries[] = [
    {
      key: "activation_24h_rate",
      label: "Activation Rate (24h)",
      color: "#34d399",
      values: valuesForDates(activationRateSeries, rateDates),
    },
    {
      key: "byok_adoption_rate_signed_in",
      label: "BYOK Adoption (Signed-in)",
      color: "#f472b6",
      values: valuesForDates(byokRateSeries, rateDates),
    },
  ];

  return (
    <section className="space-y-4">
      <div
        className="flex items-center justify-between rounded-2xl px-4 py-3"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-strong)" }}
      >
        <p className="text-xs uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
          Trend Window
        </p>
        <div className="flex items-center gap-2">
          {(["7", "30", "90"] as const).map((windowKey) => (
            <button
              key={windowKey}
              type="button"
              onClick={() => setSelectedWindow(windowKey)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: selectedWindow === windowKey ? "var(--accent)" : "var(--bg-elevated)",
                color: selectedWindow === windowKey ? "var(--color-navy)" : "var(--text-secondary)",
                border: selectedWindow === windowKey ? "1px solid var(--accent)" : "1px solid var(--border)",
              }}
            >
              {windowKey}d
            </button>
          ))}
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <MultiSeriesChart title={`Volume Trends (${selectedWindow}d)`} dates={volumeDates} series={volumeSeries} />
        <MultiSeriesChart title={`Rate Trends (${selectedWindow}d)`} dates={rateDates} series={rateSeries} isPercent />
      </section>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Window: {selected.startDate} to {selected.endDate} (UTC)
      </p>
    </section>
  );
}
