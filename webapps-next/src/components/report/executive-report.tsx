"use client";

// ════════════════════════════════════════════════════════════════════════
// Executive Report kit — a reusable, board-ready report shell: masthead,
// prose (DeepSeek) executive summary, compact key-figures strip, a 2/3 + 1/3
// body (analysis charts + an insights/recommendations rail), and CSV/PDF
// export. Ported from the deepHR report framework so DEEPFLOW reads as one
// product. Pure presentational + an optional client AI hook.
// ════════════════════════════════════════════════════════════════════════

import { type ReactNode, useEffect, useRef, useState } from "react";

import {
  AlertTriangle,
  Download,
  FileText,
  Info,
  Lightbulb,
  Loader2,
  Printer,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ── CSV + PDF export ────────────────────────────────────────────────────────
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Print the report to PDF with the on-screen layout. */
export function printReportPdf(documentTitle: string) {
  const prev = document.title;
  document.title = documentTitle;
  const restore = () => {
    document.title = prev;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
  setTimeout(restore, 1500);
}

export function DownloadCsvButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="no-print h-9 rounded-full"
      onClick={() => downloadCsv(filename, headers, rows)}
    >
      <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
    </Button>
  );
}

export function DownloadPdfButton({ documentTitle }: { documentTitle: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="no-print h-9 rounded-full"
      onClick={() => printReportPdf(documentTitle)}
    >
      <Printer className="mr-1.5 h-3.5 w-3.5" /> PDF
    </Button>
  );
}

// ── Insights & recommendations types ────────────────────────────────────────
export type InsightTone = "positive" | "warning" | "critical" | "neutral";
export interface Insight {
  tone: InsightTone;
  title: string;
  detail: string;
}
export interface Recommendation {
  priority: "High" | "Medium" | "Low";
  text: string;
}
export interface AiBundle {
  summary: string;
  insights: Insight[];
  recommendations: Recommendation[];
}
export interface AiState extends AiBundle {
  loading: boolean;
  source: "deepseek" | "fallback" | null;
  model?: string;
}

const INSIGHT_STYLE: Record<
  InsightTone,
  { ring: string; chip: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  positive: {
    ring: "border-l-emerald-500",
    chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    Icon: TrendingUp,
  },
  warning: {
    ring: "border-l-amber-500",
    chip: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  critical: { ring: "border-l-red-500", chip: "bg-red-500/12 text-red-600 dark:text-red-400", Icon: TrendingDown },
  neutral: { ring: "border-l-border", chip: "bg-muted text-muted-foreground", Icon: Info },
};

const PRIORITY: Record<string, string> = {
  High: "bg-red-500/12 text-red-600 ring-red-500/20 dark:text-red-400",
  Medium: "bg-amber-500/12 text-amber-600 ring-amber-500/20 dark:text-amber-400",
  Low: "bg-sky-500/12 text-sky-600 ring-sky-500/20 dark:text-sky-400",
};

// ── DeepSeek hook + provenance badge ────────────────────────────────────────
export function useAiInsights(
  report: string,
  metrics: Record<string, unknown> | null,
  fallback: AiBundle,
  opts?: { focus?: string; context?: string; endpoint?: string },
): AiState {
  const fbRef = useRef(fallback);
  fbRef.current = fallback;
  const optRef = useRef(opts);
  optRef.current = opts;

  const [state, setState] = useState<AiState>({ loading: false, source: null, ...fallback });
  const key = metrics ? JSON.stringify(metrics) : "";

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run only when the metrics snapshot changes
  useEffect(() => {
    if (!metrics) return;
    let cancelled = false;
    setState({ loading: true, source: null, ...fbRef.current });
    fetch(optRef.current?.endpoint ?? "/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report, focus: optRef.current?.focus, context: optRef.current?.context, metrics }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.success && d.source === "deepseek" && Array.isArray(d.insights) && d.insights.length) {
          setState({
            loading: false,
            source: "deepseek",
            model: d.model,
            summary: d.summary || fbRef.current.summary,
            insights: d.insights,
            recommendations:
              Array.isArray(d.recommendations) && d.recommendations.length
                ? d.recommendations
                : fbRef.current.recommendations,
          });
        } else {
          setState({ loading: false, source: "fallback", model: d?.model, ...fbRef.current });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, source: "fallback", ...fbRef.current });
      });
    return () => {
      cancelled = true;
    };
  }, [report, key]);

  return state;
}

export function AiBadge({ source, loading }: { source: "deepseek" | "fallback" | null; loading: boolean }) {
  if (loading)
    return (
      <span className="no-print text-primary inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium">
        <Loader2 className="h-3 w-3 animate-spin" /> DeepSeek V4 analyzing…
      </span>
    );
  if (source === "deepseek")
    return (
      <span className="text-primary inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium">
        <Sparkles className="h-3 w-3" /> DeepSeek V4
      </span>
    );
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">
      <Info className="h-3 w-3" /> Rule-based
    </span>
  );
}

// ── Report shell ────────────────────────────────────────────────────────────
export interface KeyFigure {
  label: string;
  value: string | number;
  hint?: string;
}

export function ExecutiveReport({
  eyebrow,
  title,
  subtitle,
  meta,
  csv,
  pdfTitle,
  actions,
  summary,
  summaryBadge,
  keyFigures,
  aside,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  meta?: { asOf?: string; preparedFor?: string; confidential?: boolean };
  csv?: { filename: string; headers: string[]; rows: (string | number | null | undefined)[][] };
  pdfTitle?: string;
  /** Extra controls in the masthead (e.g. a range toggle), before CSV/PDF. */
  actions?: ReactNode;
  summary: ReactNode;
  summaryBadge?: ReactNode;
  keyFigures?: KeyFigure[];
  aside: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="exec-report mx-auto max-w-[1400px] space-y-6">
      {/* Masthead */}
      <header className="border-b pb-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            {eyebrow && (
              <div className="text-muted-foreground flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.2em] uppercase">
                <span className="relative flex size-1.5">
                  <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
                  <span className="bg-primary relative inline-flex size-1.5 rounded-full" />
                </span>
                {eyebrow} · Executive Report
              </div>
            )}
            <h1 className="mt-1.5 text-3xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="text-muted-foreground max-w-2xl">{subtitle}</p>}
            {meta && (
              <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
                {meta.asOf && <span>As of {meta.asOf}</span>}
                {meta.preparedFor && (
                  <>
                    <span className="text-border">·</span>
                    <span>Prepared for {meta.preparedFor}</span>
                  </>
                )}
                {meta.confidential && (
                  <>
                    <span className="text-border">·</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">CONFIDENTIAL</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {summaryBadge}
            {actions}
            {csv && <DownloadCsvButton filename={csv.filename} headers={csv.headers} rows={csv.rows} />}
            <DownloadPdfButton documentTitle={pdfTitle ?? title} />
          </div>
        </div>
      </header>

      {/* Narrative executive summary */}
      <section className="break-avoid">
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg">
            <FileText className="h-4 w-4" />
          </span>
          <div>
            <p className="text-primary/80 font-mono text-[10px] font-semibold tracking-[0.2em] uppercase">
              Executive Summary
            </p>
            <p className="text-foreground/85 mt-1 max-w-3xl text-[15px] leading-relaxed">{summary}</p>
          </div>
        </div>
      </section>

      {/* Compact key figures strip */}
      {keyFigures && keyFigures.length > 0 && (
        <div className="break-avoid flex flex-wrap items-stretch gap-x-6 gap-y-3 rounded-xl border bg-muted/30 px-5 py-3">
          {keyFigures.map((f) => (
            <div key={f.label} className="min-w-[120px]">
              <p className="text-muted-foreground text-[11px] tracking-wide uppercase">{f.label}</p>
              <p className="font-mono text-lg leading-tight font-bold tabular-nums">{f.value}</p>
              {f.hint && <p className="text-muted-foreground text-[11px]">{f.hint}</p>}
            </div>
          ))}
        </div>
      )}

      {/* 2-column body: 2/3 analysis · 1/3 insights + recommendations */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">{children}</div>
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">{aside}</aside>
      </div>

      <footer className="text-muted-foreground border-t pt-4 font-mono text-[10px]">
        Generated by DEEPFLOW · figures reflect live engine data at time of view.
      </footer>
    </div>
  );
}

// ── Chart card (title + narrative caption + chart) ──────────────────────────
export function ReportChartCard({
  title,
  caption,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  caption?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("break-avoid border-border/60 rounded-2xl shadow-sm", className)}>
      <CardContent className="p-5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            {Icon && <Icon className="text-primary h-4 w-4" />}
            {title}
          </h2>
          {action}
        </div>
        {caption && <p className="text-muted-foreground mb-4 text-[13px]">{caption}</p>}
        {children}
      </CardContent>
    </Card>
  );
}

// ── Insights rail card ──────────────────────────────────────────────────────
export function InsightsCard({ insights, badge }: { insights: Insight[]; badge?: ReactNode }) {
  return (
    <Card className="break-avoid border-border/60 rounded-2xl shadow-sm">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Sparkles className="text-primary h-4 w-4" /> Key Insights
          </h2>
          {badge}
        </div>
        {insights.length === 0 ? (
          <p className="text-muted-foreground text-sm">No notable insights.</p>
        ) : (
          <div className="space-y-2.5">
            {insights.map((ins) => {
              const s = INSIGHT_STYLE[ins.tone];
              return (
                <div key={ins.title} className={cn("bg-card rounded-lg border border-l-2 p-3", s.ring)}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className={cn("flex size-5 items-center justify-center rounded-md [&>svg]:size-3", s.chip)}>
                      <s.Icon />
                    </span>
                    <p className="text-[13px] leading-tight font-semibold">{ins.title}</p>
                  </div>
                  <p className="text-muted-foreground text-[12px] leading-snug">{ins.detail}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RecommendationsCard({ items }: { items: Recommendation[] }) {
  return (
    <Card className="break-avoid border-border/60 rounded-2xl shadow-sm">
      <CardContent className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Lightbulb className="text-primary h-4 w-4" /> Recommendations
        </h2>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No recommendations — metrics are within target.</p>
        ) : (
          <ol className="space-y-2.5">
            {items.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="bg-primary/10 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <span
                    className={cn(
                      "mr-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 align-middle text-[10px] font-semibold ring-1 ring-inset",
                      PRIORITY[r.priority],
                    )}
                  >
                    {r.priority}
                  </span>
                  <span className="text-foreground/85 text-[13px]">{r.text}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
