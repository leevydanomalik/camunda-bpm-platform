"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export type JobStateSlice = {
  state: "active" | "retrying" | "failed" | "suspended";
  count: number;
};

const config: ChartConfig = {
  active: { label: "Active", color: "var(--chart-2)" },
  retrying: { label: "Retrying", color: "var(--chart-3)" },
  failed: { label: "Failed", color: "var(--destructive)" },
  suspended: { label: "Suspended", color: "var(--chart-5)" },
};

export function JobStateDonutChart({ data }: { data: JobStateSlice[] }) {
  const total = data.reduce((acc, d) => acc + d.count, 0);
  if (total === 0) {
    return (
      <div className="text-muted-foreground bg-muted/30 flex h-64 items-center justify-center rounded text-xs">
        No jobs in the engine.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <ResponsiveContainer>
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="state" />} />
          <Pie data={data} dataKey="count" nameKey="state" innerRadius={48} outerRadius={80} strokeWidth={1}>
            {data.map((slice) => (
              <Cell key={slice.state} fill={`var(--color-${slice.state})`} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => config[value as keyof typeof config]?.label ?? value}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
