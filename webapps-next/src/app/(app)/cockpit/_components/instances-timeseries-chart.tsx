"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export type TimeseriesPoint = { bucketStart: string; count: number };

const config: ChartConfig = {
  count: { label: "Started", color: "var(--chart-2)" },
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function InstancesTimeseriesChart({ data }: { data: TimeseriesPoint[] }) {
  if (data.every((p) => p.count === 0)) {
    return (
      <div className="text-muted-foreground bg-muted/30 flex h-64 items-center justify-center rounded text-xs">
        No instances started in this period.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cockpit-instances-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="bucketStart"
            tickFormatter={shortDate}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={11}
          />
          <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} width={32} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.bucketStart ? shortDate(payload[0].payload.bucketStart) : ""
                }
              />
            }
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="var(--chart-2)"
            strokeWidth={2}
            fill="url(#cockpit-instances-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
