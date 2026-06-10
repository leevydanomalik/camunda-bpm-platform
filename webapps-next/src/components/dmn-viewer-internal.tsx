"use client";

import { useEffect, useRef, useState } from "react";

type DmnView = {
  id: string;
  type: "drd" | "decisionTable" | "literalExpression";
  element: { id?: string; name?: string };
};

type DmnJsViewer = {
  importXML: (xml: string) => Promise<{ warnings: unknown[] }>;
  getViews: () => DmnView[];
  getActiveView: () => DmnView | null;
  open: (view: DmnView) => Promise<unknown>;
  on: (event: string, cb: (e: unknown) => void) => void;
  destroy: () => void;
};

export type DmnViewerProps = {
  xml: string;
  height?: number | string;
};

function viewLabel(v: DmnView): string {
  if (v.type === "drd") return "Diagram";
  return v.element.name ?? v.element.id ?? v.id;
}

export function DmnViewer({ xml, height = 480 }: DmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<DmnJsViewer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [views, setViews] = useState<DmnView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const container = containerRef.current;
      if (!container) return;
      try {
        setLoading(true);
        setError(null);
        setViews([]);
        setActiveViewId(null);
        if (viewerRef.current) {
          viewerRef.current.destroy();
          viewerRef.current = null;
        }
        const mod = await import("dmn-js/lib/NavigatedViewer");
        if (cancelled || !containerRef.current) return;

        const Viewer = (mod.default ?? mod) as unknown as new (opts: { container: HTMLElement }) => DmnJsViewer;
        const viewer = new Viewer({ container });
        viewerRef.current = viewer;

        await viewer.importXML(xml);
        if (cancelled) return;

        const allViews = viewer.getViews();
        setViews(allViews);

        // dmn-js auto-opens the DRD view. For files with at least one decision
        // (table or literal expression), open that one directly — the table is
        // the useful view; the DRD overview of a single decision is just a box.
        const firstDecision = allViews.find((v) => v.type === "decisionTable" || v.type === "literalExpression");
        if (firstDecision) {
          await viewer.open(firstDecision);
          if (cancelled) return;
          setActiveViewId(firstDecision.id);
        } else {
          const active = viewer.getActiveView();
          if (active) setActiveViewId(active.id);
        }

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render decision");
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [xml]);

  async function switchTo(view: DmnView) {
    const viewer = viewerRef.current;
    if (!viewer) return;
    try {
      await viewer.open(view);
      setActiveViewId(view.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch view");
    }
  }

  if (error) {
    return (
      <div
        className="bg-muted/30 text-destructive flex items-center justify-center rounded-md border p-4 text-sm"
        style={{ minHeight: height }}
      >
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {views.length > 1 ? (
        <div className="bg-muted text-muted-foreground inline-flex items-center rounded-md p-0.5 text-xs">
          {views.map((v) => {
            const isActive = v.id === activeViewId;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => switchTo(v)}
                className={`rounded-sm px-2.5 py-1 ${
                  isActive ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"
                }`}
              >
                {viewLabel(v)}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="bg-muted/10 relative w-full overflow-hidden rounded-md border" style={{ height }}>
        {loading ? (
          <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
            Loading decision…
          </div>
        ) : null}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
