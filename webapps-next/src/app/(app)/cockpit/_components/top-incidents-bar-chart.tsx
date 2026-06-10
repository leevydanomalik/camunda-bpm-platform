"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export type IncidentTypeRow = { type: string; count: number };

const config: ChartConfig = {
  count: { label: "Incidents", color: "var(--destructive)" },
};

export function TopIncidentsBarChart({ data }: { data: IncidentTypeRow[] }) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground bg-muted/30 flex h-56 items-center justify-center rounded text-xs">
        No incidents in this period.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="type"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={140}
            tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" fill="var(--destructive)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
