"use client";

import { useEffect, useRef, useState } from "react";

// ── Minimal ambient types for what we use from bpmn-js ──
type BpmnCanvas = {
  zoom: (arg?: string | number, center?: string | { x: number; y: number }) => number;
};
type BpmnJsViewer = {
  importXML: (xml: string) => Promise<{ warnings: unknown[] }>;
  get: <T = unknown>(name: string) => T;
  destroy: () => void;
};

export type BpmnViewerProps = {
  xml: string;
  height?: number | string;
  /** Highlight one or more activity IDs (e.g. activity instances of the current execution). */
  activityIds?: string[];
};

export function BpmnViewer({ xml, height = 400, activityIds }: BpmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<BpmnJsViewer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const container = containerRef.current;
      if (!container) return;
      try {
        setLoading(true);
        setError(null);
        if (viewerRef.current) {
          viewerRef.current.destroy();
          viewerRef.current = null;
        }
        const mod = await import("bpmn-js/lib/NavigatedViewer");
        if (cancelled || !containerRef.current) return;

        const Viewer = (mod.default ?? mod) as unknown as new (opts: { container: HTMLElement }) => BpmnJsViewer;
        const viewer = new Viewer({ container });
        viewerRef.current = viewer;

        await viewer.importXML(xml);
        if (cancelled) return;

        viewer.get<BpmnCanvas>("canvas").zoom("fit-viewport", "auto");

        // Highlight active activities by adding a CSS marker class via the canvas API.
        if (activityIds && activityIds.length > 0) {
          const canvasAny = viewer.get<{ addMarker: (id: string, cls: string) => void }>("canvas");
          for (const id of activityIds) {
            try {
              canvasAny.addMarker(id, "highlight");
            } catch {
              // Activity may not be in the diagram (e.g. nested subprocess) — ignore.
            }
          }
        }

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
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
  }, [xml, activityIds]);

  if (error) {
    return (
      <div className="bg-muted/30 text-destructive flex items-center justify-center rounded-md border p-4 text-sm" style={{ minHeight: height }}>
        {error}
      </div>
    );
  }

  return (
    <div className="bg-muted/10 relative w-full overflow-hidden rounded-md border" style={{ height }}>
      {loading ? (
        <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
          Loading diagram…
        </div>
      ) : null}
      <div ref={containerRef} className="h-full w-full" />
      <style>{`
        .djs-overlay.highlight,
        .djs-element.highlight .djs-visual > :first-child {
          stroke: var(--primary) !important;
          stroke-width: 3px !important;
          fill: var(--primary) !important;
          fill-opacity: 0.08 !important;
        }
      `}</style>
    </div>
  );
}
