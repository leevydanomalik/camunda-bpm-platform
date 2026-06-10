"use client";

import { useEffect, useRef, useState } from "react";

import { Flame } from "lucide-react";

// ── Minimal ambient types for what we use from bpmn-js ──
type BpmnCanvas = {
  zoom: (arg?: string | number, center?: string | { x: number; y: number }) => number;
  addMarker: (id: string, cls: string) => void;
};
type BpmnEventBus = {
  on: (event: string, cb: () => void) => void;
  off: (event: string, cb: () => void) => void;
};
type BpmnFlowElement = {
  id: string;
  source?: { id: string };
  target?: { id: string };
  businessObject?: { sourceRef?: { id?: string }; targetRef?: { id?: string } };
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
  /** Element-id → weight in [0,1]. Renders a heatmap overlay; pass undefined to disable. */
  heatmap?: Record<string, number>;
};

const HIGHLIGHT_MARKER = "cam-active";
const BADGE_OVERLAY_TYPE = "activity-badge";

// ── Heat LUT (cold purple → hot red) — same stops as cargotrain reference ──
const HEAT_STOPS: Array<{ t: number; rgb: [number, number, number] }> = [
  { t: 0.0, rgb: [63, 0, 189] },
  { t: 0.25, rgb: [0, 170, 255] },
  { t: 0.5, rgb: [0, 230, 110] },
  { t: 0.75, rgb: [255, 220, 0] },
  { t: 1.0, rgb: [255, 45, 0] },
];

function heatColor(t: number): [number, number, number] {
  const v = Math.min(1, Math.max(0, t));
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    const a = HEAT_STOPS[i];
    const b = HEAT_STOPS[i + 1];
    if (v >= a.t && v <= b.t) {
      const k = (v - a.t) / (b.t - a.t);
      return [
        Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * k),
        Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * k),
        Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * k),
      ];
    }
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1].rgb;
}

export function BpmnViewer({ xml, height = 400, activityIds, badges, heatmap }: BpmnViewerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const bpmnHostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<BpmnJsViewer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(Boolean(heatmap));

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
        canvas.zoom("fit-viewport", "auto");

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
              overlays.add(b.elementId, BADGE_OVERLAY_TYPE, {
                position: b.position === "top-right" ? { top: -8, right: -8 } : { bottom: -8, left: -8 },
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

      if (!heatmap || !showHeatmap) return;

      const svg = bpmnHost.querySelector("svg") as SVGSVGElement | null;
      if (!svg) return;
      const viewportGroup = svg.querySelector("g.viewport") as SVGGraphicsElement | null;
      if (!viewportGroup) return;
      const ctm = viewportGroup.getScreenCTM();
      if (!ctm) return;

      const pt = svg.createSVGPoint();
      const toLocal = (dx: number, dy: number) => {
        pt.x = dx;
        pt.y = dy;
        const s = pt.matrixTransform(ctm);
        return { x: s.x - wrapperRect.left, y: s.y - wrapperRect.top };
      };
      const scale = ctm.a || 1;

      // Build a structural-propagation heatmap: BPMN runtime stats only assign
      // weights to nodes that currently hold instances (user tasks waiting,
      // jobs queued). Gateways, events, and downstream tasks are all 0, so the
      // visualization breaks at every transition. Walk the sequence-flow graph
      // outward from each hot node in both directions, attenuating per hop,
      // and merge the inferred values with the raw heatmap. The result is a
      // continuous gradient that shows where the process flow is heading
      // (forward) and where it came from (backward), peaked at the real hot
      // spots.
      const all = elementRegistry.getAll();
      const fwd: Record<string, string[]> = {};
      const bwd: Record<string, string[]> = {};
      for (const el of all) {
        const srcId = el.source?.id ?? el.businessObject?.sourceRef?.id;
        const tgtId = el.target?.id ?? el.businessObject?.targetRef?.id;
        if (!srcId || !tgtId) continue;
        (fwd[srcId] ??= []).push(tgtId);
        (bwd[tgtId] ??= []).push(srcId);
      }
      const ATTENUATION = 0.6; // per-hop heat decay
      const MIN_HEAT = 0.05; // values below this are not visible — stop BFS
      const effective: Record<string, number> = {};
      for (const [id, raw] of Object.entries(heatmap)) {
        const v = Math.min(1, Math.max(0, raw));
        if (v > 0) effective[id] = Math.max(effective[id] ?? 0, v);
      }
      const queue: Array<{ id: string; level: number; dir: "fwd" | "bwd" }> = [];
      for (const [id, v] of Object.entries(effective)) {
        queue.push({ id, level: v, dir: "fwd" }, { id, level: v, dir: "bwd" });
      }
      while (queue.length > 0) {
        const node = queue.shift() as { id: string; level: number; dir: "fwd" | "bwd" };
        const next = node.level * ATTENUATION;
        if (next < MIN_HEAT) continue;
        const neighbors = node.dir === "fwd" ? fwd[node.id] : bwd[node.id];
        if (!neighbors) continue;
        for (const nId of neighbors) {
          if ((effective[nId] ?? 0) >= next) continue;
          effective[nId] = next;
          queue.push({ id: nId, level: next, dir: node.dir });
        }
      }

      // Element centers (primary heat) and corridor points (secondary, attenuated).
      const elementPts: Array<{ x: number; y: number; v: number; w: number; h: number }> = [];
      const corridorPts: Array<{ x: number; y: number; v: number }> = [];

      for (const [id, raw] of Object.entries(effective)) {
        const v = Math.min(1, Math.max(0, raw));
        if (v <= 0) continue;
        const node = svg.querySelector(`[data-element-id="${CSS.escape(id)}"]`) as SVGGraphicsElement | null;
        if (!node) continue;
        const r = node.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        elementPts.push({
          x: r.left + r.width / 2 - wrapperRect.left,
          y: r.top + r.height / 2 - wrapperRect.top,
          v,
          w: r.width,
          h: r.height,
        });
      }

      // Flow corridors — sample every ~22px along each sequence flow, using
      // the propagated `effective` heat so paths between distant hot regions
      // also glow at their inferred intensity.
      for (const el of all) {
        if (!el.waypoints || el.waypoints.length < 2) continue;
        const srcId = el.source?.id ?? el.businessObject?.sourceRef?.id;
        const tgtId = el.target?.id ?? el.businessObject?.targetRef?.id;
        if (!srcId || !tgtId) continue;
        const srcW = effective[srcId] ?? 0;
        const tgtW = effective[tgtId] ?? 0;
        if (srcW <= 0 && tgtW <= 0) continue;
        // Both endpoints rated → min (bottleneck-style, matches the
        // cargotrain reference). One side at 0 → use the rated side.
        const blend = srcW > 0 && tgtW > 0 ? Math.min(srcW, tgtW) : Math.max(srcW, tgtW);
        const corridor = Math.min(1, Math.max(0, blend));
        if (corridor <= 0) continue;

        const wps = el.waypoints;
        for (let i = 0; i < wps.length - 1; i++) {
          const a = wps[i];
          const b = wps[i + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const steps = Math.max(2, Math.ceil(dist / 22));
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const p = toLocal(a.x + dx * t, a.y + dy * t);
            corridorPts.push({ x: p.x, y: p.y, v: corridor });
          }
        }
      }

      if (elementPts.length === 0 && corridorPts.length === 0) return;

      const corridorRadius = Math.max(14, Math.round(26 * scale));

      // Pass 1: accumulate grayscale alpha via "lighter" composition.
      const off = document.createElement("canvas");
      off.width = cssW;
      off.height = cssH;
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.globalCompositeOperation = "lighter";

      const paintRadial = (x: number, y: number, r: number, centerAlpha: number) => {
        const grad = octx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(0,0,0,${centerAlpha})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        octx.fillStyle = grad;
        octx.fillRect(x - r, y - r, r * 2, r * 2);
      };

      for (const { x, y, v, w, h } of elementPts) {
        const size = Math.max(w, h);
        const heatMul = 0.5 + v * 0.5;
        const haloR = Math.max(22, Math.round(size * 0.85 * heatMul));
        paintRadial(x, y, haloR, Math.min(0.52, 0.24 + v * 0.35));
        const midR = Math.max(16, Math.round(size * 0.55 * heatMul));
        paintRadial(x, y, midR, Math.min(0.7, 0.38 + v * 0.4));
        const innerR = Math.max(8, Math.round(size * 0.28 * heatMul));
        paintRadial(x, y, innerR, Math.min(0.88, 0.58 + v * 0.32));
      }
      for (const { x, y, v } of corridorPts) {
        paintRadial(x, y, corridorRadius, Math.min(0.42, 0.18 + v * 0.26));
      }

      // Pass 2: LUT colorize.
      const img = octx.getImageData(0, 0, cssW, cssH);
      const data = img.data;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a === 0) continue;
        const t = Math.min(1, Math.pow(a / 255, 0.5));
        const [r, g, b] = heatColor(t);
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = Math.min(230, Math.round(a * 1.8));
      }
      octx.putImageData(img, 0, 0);
      ctx.drawImage(off, 0, 0, cssW, cssH);
    }

    let rafId = requestAnimationFrame(draw);
    const redraw = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(draw);
    };
    const refitAndRedraw = () => {
      try {
        viewer.get<BpmnCanvas>("canvas").zoom("fit-viewport", "auto");
      } catch {
        /* ignore */
      }
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
  }, [isReady, heatmap, showHeatmap]);

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
    <div ref={wrapperRef} className="bg-muted/10 relative w-full overflow-hidden rounded-md border" style={{ height }}>
      {loading ? (
        <div className="text-muted-foreground absolute inset-0 z-20 flex items-center justify-center text-sm">
          Loading diagram…
        </div>
      ) : null}
      <div ref={bpmnHostRef} className="absolute inset-0 z-0" />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-200"
        style={{ opacity: heatmap && showHeatmap ? 0.95 : 0 }}
      />
      {heatmap ? (
        <button
          type="button"
          onClick={() => setShowHeatmap((v) => !v)}
          className="bg-background/90 hover:bg-background absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs shadow-sm backdrop-blur-sm"
          aria-pressed={showHeatmap}
        >
          <Flame className={`size-3.5 ${showHeatmap ? "text-orange-500" : "text-muted-foreground"}`} />
          {showHeatmap ? "Heatmap on" : "Heatmap off"}
        </button>
      ) : null}
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
