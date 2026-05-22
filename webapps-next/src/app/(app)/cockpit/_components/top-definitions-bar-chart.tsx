"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export type DefinitionRow = { key: string; name: string; count: number };

const config: ChartConfig = {
  count: { label: "Running", color: "var(--chart-3)" },
};

export function TopDefinitionsBarChart({ data }: { data: DefinitionRow[] }) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground bg-muted/30 flex h-56 items-center justify-center rounded text-xs">
        No running instances yet.
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
            dataKey="name"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={120}
            tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
