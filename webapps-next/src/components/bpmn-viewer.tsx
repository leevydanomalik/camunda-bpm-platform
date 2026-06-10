"use client";

import { useEffect, useRef, useState } from "react";

import { Expand, Maximize, Minus, Plus, Shrink } from "lucide-react";

// Heatmap rendering is a paid plugin (Heatmap Pro). v0 plugin contract links
// statically — the painter is bundled, but it only ever runs when the plugin
// is installed (runtime install state). Not installed → no overlay, no UI.
import { paintHeatmap } from "@/../plugins/heatmap-pro/client";
import { usePluginInstalled } from "@/lib/plugins/install-state";
import { HEATMAP_PLUGIN_ID } from "@/lib/plugins/manifests";

// ── Minimal ambient types for what we use from bpmn-js ──
type BpmnCanvas = {
  zoom: (arg?: string | number, center?: string | { x: number; y: number }) => number;
  addMarker: (id: string, cls: string) => void;
  /** Invalidates the cached container size (and viewbox). */
  resized: () => void;
};
type BpmnEventBus = {
  on: (event: string, cb: () => void) => void;
  off: (event: string, cb: () => void) => void;
};
type BpmnFlowElement = {
  id: string;
  source?: { id: string };
  target?: { id: string };
  businessObject?: { $type?: string; sourceRef?: { id?: string }; targetRef?: { id?: string } };
  waypoints?: Array<{ x: number; y: number }>;
};

type BpmnElementRegistry = {
  getAll: () => BpmnFlowElement[];
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

/** Numbered badge over a BPMN element. */
export type ActivityBadge = {
  elementId: string;
  count: number;
  tone?: "default" | "warning";
  position?: "bottom-left" | "top-right";
};

export type BpmnViewerProps = {
  xml: string;
  height?: number | string;
  /** Activity IDs to outline as "currently active" (matches Camunda Cockpit's highlight). */
  activityIds?: string[];
  /** Per-activity numbered badges (instance counts, incident counts, ...). */
  badges?: ActivityBadge[];
  /**
   * Element-id → weight in [0,1]. Renders a heatmap overlay; pass undefined
   * to disable. Requires the Heatmap Pro plugin — without it, nothing renders.
   */
  heatmap?: Record<string, number>;
  /** External heatmap visibility toggle (defaults to true when `heatmap` is set). */
  heatmapVisible?: boolean;
  /** Show the zoom/fit/fullscreen cluster. Turn off for small thumbnails. */
  controls?: boolean;
};

const HIGHLIGHT_MARKER = "cam-active";
const BADGE_OVERLAY_TYPE = "activity-badge";

const CONTROL_BTN =
  "text-muted-foreground hover:text-foreground hover:bg-muted flex size-7 items-center justify-center rounded-sm transition-colors";

// bpmn-js bakes two hard-coded inline fills onto every shape/label: white
// (shape bodies + task-icon backdrops) and #22242a (label text + task glyphs).
// CSS can't reliably beat an inline style across bpmn-js versions, so we remap
// those two literals to live CSS custom properties (defined on .djs-container in
// globals.css). Because the value becomes a var(), a light/dark switch re-themes
// the diagram with no JS re-run.
//   white   → --bpmn-surface   #22242a → --bpmn-ink
const SURFACE_FILLS = new Set(["white", "rgb(255,255,255)", "#fff", "#ffffff"]);
const INK_FILLS = new Set(["rgb(34,36,42)", "#22242a"]);

function applyDiagramTheme(host: HTMLElement | null) {
  const svg = host?.querySelector("svg");
  if (!svg) return;
  for (const el of svg.querySelectorAll<SVGElement>("[style*='fill']")) {
    const fill = (el.style.fill || "").toLowerCase().replace(/\s+/g, "");
    if (SURFACE_FILLS.has(fill)) el.style.fill = "var(--bpmn-surface)";
    else if (INK_FILLS.has(fill)) el.style.fill = "var(--bpmn-ink)";
  }
}

export function BpmnViewer({
  xml,
  height = 400,
  activityIds,
  badges,
  heatmap,
  heatmapVisible = true,
  controls = true,
}: BpmnViewerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const bpmnHostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<BpmnJsViewer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // The heatmap is a paid plugin — not installed means it doesn't exist here.
  const heatmapPluginInstalled = usePluginInstalled(HEATMAP_PLUGIN_ID, false);
  const heatActive = Boolean(heatmap) && heatmapPluginInstalled && heatmapVisible;

  // ── Diagram controls (zoom / fit / fullscreen) ──
  const getCanvas = () => {
    try {
      return viewerRef.current?.get<BpmnCanvas>("canvas") ?? null;
    } catch {
      return null;
    }
  };
  const zoomBy = (delta: number) => {
    const canvas = getCanvas();
    if (!canvas) return;
    const next = Math.min(4, Math.max(0.2, canvas.zoom() + delta));
    canvas.zoom(next, "auto");
  };
  // fit-viewport computed before layout settles yields a degenerate
  // matrix(0 …) and a blank diagram (the deep-link race). Verify the viewport
  // transform after fitting and retry on animation frames until it's sane.
  const robustFit = (attempts = 60) => {
    const tryFit = (left: number) => {
      const canvas = getCanvas();
      const host = bpmnHostRef.current;
      if (!canvas || !host) return;
      try {
        // bpmn-js caches the container size; if it was measured while the
        // host was 0×0 (hydration), every fit stays degenerate until the
        // cache is invalidated.
        canvas.resized();
        canvas.zoom("fit-viewport", "auto");
      } catch {
        return;
      }
      const t = host.querySelector("svg g.viewport")?.getAttribute("transform") ?? "";
      const degenerate = t === "" || t.startsWith("matrix(0 ") || t.startsWith("matrix(0,");
      if (degenerate && left > 0) requestAnimationFrame(() => tryFit(left - 1));
    };
    tryFit(attempts);
  };
  const fitView = () => robustFit();
  const toggleFullscreen = () => {
    const el = wrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  };

  // Track fullscreen state and refit when it changes.
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
      // Let layout settle, then refit the diagram to the new size.
      requestAnimationFrame(() => robustFit());
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ── 1. Mount bpmn-js + apply highlights + badges ──
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const host = bpmnHostRef.current;
      if (!host) return;
      try {
        setLoading(true);
        setError(null);
        setIsReady(false);
        if (viewerRef.current) {
          viewerRef.current.destroy();
          viewerRef.current = null;
        }
        const mod = await import("bpmn-js/lib/NavigatedViewer");
        if (cancelled || !bpmnHostRef.current) return;

        const Viewer = (mod.default ?? mod) as unknown as new (opts: { container: HTMLElement }) => BpmnJsViewer;
        const viewer = new Viewer({ container: host });
        viewerRef.current = viewer;

        await viewer.importXML(xml);
        if (cancelled) return;

        const canvas = viewer.get<BpmnCanvas>("canvas");
        robustFit();

        // Remap bpmn-js's baked-in white/#22242a fills to theme vars.
        applyDiagramTheme(host);

        if (activityIds && activityIds.length > 0) {
          for (const id of activityIds) {
            try {
              canvas.addMarker(id, HIGHLIGHT_MARKER);
            } catch {
              /* ignore */
            }
          }
        }

        if (badges && badges.length > 0) {
          const overlays = viewer.get<BpmnOverlays>("overlays");
          for (const b of badges) {
            if (b.count <= 0) continue;
            const el = document.createElement("span");
            el.className = `cam-badge cam-badge-${b.tone ?? "default"}`;
            el.textContent = b.count >= 1000 ? `${Math.floor(b.count / 1000)}k` : String(b.count);
            try {
              // Overlay coords anchor the badge's top-left: {bottom: 10} puts it
              // at height-10, so the 20px badge straddles the bottom edge
              // (likewise {right: 10} for the top-right corner).
              overlays.add(b.elementId, BADGE_OVERLAY_TYPE, {
                position: b.position === "top-right" ? { top: -10, right: 10 } : { bottom: 10, left: -10 },
                html: el,
              });
            } catch {
              /* ignore */
            }
          }
        }

        setLoading(false);
        setIsReady(true);
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

  // ── 2. Heatmap canvas overlay (cargotrain-style two-pass compositor) ──
  useEffect(() => {
    if (!isReady) return;
    const viewer = viewerRef.current;
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    const bpmnHost = bpmnHostRef.current;
    if (!viewer || !canvas || !wrapper || !bpmnHost) return;

    const eventBus = viewer.get<BpmnEventBus>("eventBus");
    const elementRegistry = viewer.get<BpmnElementRegistry>("elementRegistry");

    function clearCanvas() {
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function draw() {
      if (!canvas || !wrapper || !bpmnHost) return;
      const wrapperRect = wrapper.getBoundingClientRect();
      const cssW = wrapperRect.width;
      const cssH = wrapperRect.height;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      if (!heatmap || !heatActive) return;

      const svg = bpmnHost.querySelector("svg") as SVGSVGElement | null;
      if (!svg) return;

      // Delegate the actual painting to the Heatmap Pro plugin.
      paintHeatmap({
        ctx,
        cssW,
        cssH,
        wrapperRect,
        svg,
        elements: elementRegistry.getAll(),
        weights: heatmap,
      });
    }

    let rafId = requestAnimationFrame(draw);
    const redraw = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(draw);
    };
    const refitAndRedraw = () => {
      robustFit(15);
      redraw();
    };

    eventBus.on("canvas.viewbox.changed", redraw);
    eventBus.on("canvas.resized", redraw);
    const ro = new ResizeObserver(refitAndRedraw);
    ro.observe(wrapper);
    ro.observe(bpmnHost);

    return () => {
      cancelAnimationFrame(rafId);
      eventBus.off("canvas.viewbox.changed", redraw);
      eventBus.off("canvas.resized", redraw);
      ro.disconnect();
      clearCanvas();
    };
  }, [isReady, heatmap, heatActive]);

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
    <div
      ref={wrapperRef}
      data-bpmn-root
      className="bg-muted/10 relative w-full overflow-hidden rounded-md border"
      style={{ height }}
    >
      {loading ? (
        <div className="text-muted-foreground absolute inset-0 z-20 flex items-center justify-center text-sm">
          Loading diagram…
        </div>
      ) : null}
      <div ref={bpmnHostRef} className="absolute inset-0 z-0" />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-200"
        style={{ opacity: heatActive ? 0.95 : 0 }}
      />

      {/* Zoom / fit / fullscreen controls — bottom-right. */}
      <div
        className="bg-background/90 absolute right-3 bottom-3 z-30 flex items-center gap-0.5 rounded-md border p-0.5 shadow-sm backdrop-blur-sm"
        hidden={!controls}
      >
        <button type="button" onClick={() => zoomBy(0.2)} className={CONTROL_BTN} aria-label="Zoom in" title="Zoom in">
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(-0.2)}
          className={CONTROL_BTN}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Minus className="size-4" />
        </button>
        <button type="button" onClick={fitView} className={CONTROL_BTN} aria-label="Fit to view" title="Fit to view">
          <Maximize className="size-4" />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className={CONTROL_BTN}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Shrink className="size-4" /> : <Expand className="size-4" />}
        </button>
      </div>
      <style>{`
        [data-bpmn-root]:fullscreen {
          height: 100vh !important;
          border-radius: 0;
          background: var(--background);
        }
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
