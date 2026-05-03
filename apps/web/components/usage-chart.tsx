"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import dynamic from "next/dynamic";

const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), {
  ssr: false,
});
const Area = dynamic(() => import("recharts").then((m) => m.Area), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), {
  ssr: false,
});
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false },
);
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), {
  ssr: false,
});
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), {
  ssr: false,
});
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false },
);

type ChartEntry = {
  date: string;
  consumed: number;
  recharged: number;
};

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function CustomTooltip({
  active,
  payload,
  label,
  locale,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  locale: string;
}) {
  const { t } = useTranslation();

  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm text-sm">
      <p className="font-medium text-foreground mb-1">
        {label ? formatDate(label, locale) : label}
      </p>
      {payload.map((entry: { name: string; value: number; color: string }) => (
        <p key={entry.name} className="text-muted-foreground">
          <span
            className="inline-block w-2 h-2 rounded-full mr-2"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name === "consumed"
            ? t("usage.consumed")
            : t("usage.recharged")}
          :{" "}
          <span className="font-medium text-foreground">
            {entry.value.toLocaleString()}
          </span>
        </p>
      ))}
    </div>
  );
}

/**
 * Stepped area chart for daily consumed vs recharged credits (Recharts step-after interpolation).
 */
export function UsageChart({ data }: { data: ChartEntry[] }) {
  const { i18n, t } = useTranslation();
  const locale = i18n.language.startsWith("zh") ? "zh-CN" : "en-US";

  const consumedMax = useMemo(
    () => Math.max(...data.map((d) => d.consumed), 1),
    [data],
  );
  const rechargedMax = useMemo(
    () => Math.max(...data.map((d) => d.recharged), 1),
    [data],
  );
  const yAxisMax = Math.max(consumedMax, rechargedMax);

  const tickFormatter = (val: string) => formatDate(val, locale);

  const consumedLabel = t("usage.consumed");
  const rechargedLabel = t("usage.recharged");

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart
        data={data}
        margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
      >
        <defs>
          <linearGradient id="usageColorConsumed" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="hsl(var(--destructive))"
              stopOpacity={0.35}
            />
            <stop
              offset="95%"
              stopColor="hsl(var(--destructive))"
              stopOpacity={0.02}
            />
          </linearGradient>
          <linearGradient id="usageColorRecharged" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={tickFormatter}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          domain={[0, yAxisMax]}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip locale={locale} />} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) =>
            value === "consumed" ? consumedLabel : rechargedLabel
          }
        />
        <Area
          type="stepAfter"
          dataKey="consumed"
          stroke="hsl(var(--destructive))"
          strokeWidth={2}
          fill="url(#usageColorConsumed)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Area
          type="stepAfter"
          dataKey="recharged"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#usageColorRecharged)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
