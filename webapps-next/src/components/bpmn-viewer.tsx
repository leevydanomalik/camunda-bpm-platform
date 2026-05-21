"use client";

import { useEffect, useRef, useState } from "react";

// ── Minimal ambient types for what we use from bpmn-js ──
type BpmnCanvas = {
  zoom: (arg?: string | number, center?: string | { x: number; y: number }) => number;
  addMarker: (id: string, cls: string) => void;
};
type BpmnOverlays = {
  add: (
    elementId: string,
    type: string,
    options: {
      position: { top?: number; bottom?: number; left?: number; right?: number };
      html: string | HTMLElement;
    },
  ) => string;
  remove: (filter: { id?: string; element?: string; type?: string } | string) => void;
};
type BpmnJsViewer = {
  importXML: (xml: string) => Promise<{ warnings: unknown[] }>;
  get: <T = unknown>(name: string) => T;
  destroy: () => void;
};

/** Numbered badge over a BPMN element (instance count, incident count, etc.). */
export type ActivityBadge = {
  elementId: string;
  count: number;
  /** "default" → primary color (instance counts), "warning" → destructive (incidents). */
  tone?: "default" | "warning";
  /** Where to anchor the badge relative to the element. */
  position?: "bottom-left" | "top-right";
};

export type BpmnViewerProps = {
  xml: string;
  height?: number | string;
  /** Activity IDs to outline as "currently active" (matches Camunda Cockpit's highlight). */
  activityIds?: string[];
  /** Per-activity numbered badges (instance counts, incident counts, ...). */
  badges?: ActivityBadge[];
};

const HIGHLIGHT_MARKER = "cam-active";
const BADGE_OVERLAY_TYPE = "activity-badge";

export function BpmnViewer({ xml, height = 400, activityIds, badges }: BpmnViewerProps) {
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

        const canvas = viewer.get<BpmnCanvas>("canvas");
        canvas.zoom("fit-viewport", "auto");

        // Active-activity outline (matches Cockpit's "active" highlight).
        if (activityIds && activityIds.length > 0) {
          for (const id of activityIds) {
            try {
              canvas.addMarker(id, HIGHLIGHT_MARKER);
            } catch {
              // Activity may not be in the diagram (e.g. inside collapsed subprocess) — ignore.
            }
          }
        }

        // Numbered badges via the overlays API — same pattern Cockpit uses.
        if (badges && badges.length > 0) {
          const overlays = viewer.get<BpmnOverlays>("overlays");
          for (const b of badges) {
            if (b.count <= 0) continue;
            const el = document.createElement("span");
            el.className = `cam-badge cam-badge-${b.tone ?? "default"}`;
            el.textContent = b.count >= 1000 ? `${Math.floor(b.count / 1000)}k` : String(b.count);
            try {
              overlays.add(b.elementId, BADGE_OVERLAY_TYPE, {
                position:
                  b.position === "top-right"
                    ? { top: -8, right: -8 }
                    : { bottom: -8, left: -8 },
                html: el,
              });
            } catch {
              // Element not on diagram — ignore.
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
  }, [xml, activityIds, badges]);

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
    <div className="bg-muted/10 relative w-full overflow-hidden rounded-md border" style={{ height }}>
      {loading ? (
        <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
          Loading diagram…
        </div>
      ) : null}
      <div ref={containerRef} className="h-full w-full" />
      <style>{`
        .djs-element.${HIGHLIGHT_MARKER} .djs-visual > :nth-child(1) {
          stroke: var(--primary) !important;
          stroke-width: 3px !important;
        }
        .djs-element.${HIGHLIGHT_MARKER} .djs-visual > rect,
        .djs-element.${HIGHLIGHT_MARKER} .djs-visual > circle {
          fill: color-mix(in oklab, var(--primary) 10%, transparent) !important;
        }
        .cam-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          line-height: 1;
          font-family: var(--font-sans, system-ui, sans-serif);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
        }
        .cam-badge-default {
          background: var(--primary);
          color: var(--primary-foreground);
        }
        .cam-badge-warning {
          background: var(--destructive);
          color: var(--destructive-foreground);
        }
      `}</style>
    </div>
  );
}
