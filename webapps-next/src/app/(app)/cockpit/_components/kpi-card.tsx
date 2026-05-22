import type { ReactNode } from "react";

import Link from "next/link";

import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

export type KpiTone = "default" | "warning";

export type KpiDelta = {
  value: number; // signed; positive = increase vs previous period
  label: string; // e.g. "vs. last 7d"
};

export function KpiCard({
  href,
  icon,
  label,
  value,
  tone = "default",
  delta,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: number | null;
  tone?: KpiTone;
  delta?: KpiDelta;
}) {
  const isWarning = tone === "warning" && (value ?? 0) > 0;
  return (
    <Link
      href={href}
      className={cn(
        "group bg-card hover:border-primary/40 relative flex flex-col gap-4 rounded-xl border p-5 transition-colors",
        isWarning && "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg",
            isWarning && "bg-destructive/10 text-destructive",
          )}
        >
          {icon}
        </div>
        <ArrowUpRight className="text-muted-foreground/40 group-hover:text-foreground size-4 transition-colors" />
      </div>
      <div className="space-y-1">
        <div className="text-muted-foreground text-xs">{value === null ? "Engine unreachable" : label}</div>
        <div className={cn("text-3xl font-semibold tabular-nums", isWarning && "text-destructive")}>
          {value === null ? "—" : new Intl.NumberFormat().format(value)}
        </div>
        {delta && value !== null ? <DeltaPill delta={delta} /> : null}
      </div>
    </Link>
  );
}

function DeltaPill({ delta }: { delta: KpiDelta }) {
  const positive = delta.value > 0;
  const negative = delta.value < 0;
  const Icon = positive ? TrendingUp : negative ? TrendingDown : null;
  const tone = positive
    ? "text-emerald-600 dark:text-emerald-400"
    : negative
      ? "text-rose-600 dark:text-rose-400"
      : "text-muted-foreground";
  return (
    <div className={cn("inline-flex items-center gap-1 text-xs font-medium", tone)}>
      {Icon ? <Icon className="size-3.5" /> : null}
      <span className="tabular-nums">
        {delta.value > 0 ? "+" : ""}
        {new Intl.NumberFormat().format(delta.value)}
      </span>
      <span className="text-muted-foreground font-normal">{delta.label}</span>
    </div>
  );
}
