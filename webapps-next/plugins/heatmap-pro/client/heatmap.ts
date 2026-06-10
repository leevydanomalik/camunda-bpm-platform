// Heatmap Pro — the diagram heatmap painter (capability
// `cockpit.diagram.heatmap`). Extracted from the core BpmnViewer: the viewer
// owns the canvas plumbing (sizing, redraw scheduling) and calls paintHeatmap
// only when this plugin is installed. Two-pass compositor: grayscale alpha
// accumulation via "lighter", then LUT colorization (cargotrain-style).

/** Structural subset of a bpmn-js element (what the painter needs). */
export type HeatmapElement = {
  id: string;
  source?: { id: string };
  target?: { id: string };
  businessObject?: { $type?: string; sourceRef?: { id?: string }; targetRef?: { id?: string } };
  waypoints?: Array<{ x: number; y: number }>;
};

// Tokens only ever live on flow nodes. Pools/lanes, data, groups, and
// annotations never hold a running instance, so they must not receive heat
// halos — a big collapsed pool would otherwise bloom into a giant blob from
// propagated (not real) heat.
const NON_TOKEN_TYPES = new Set([
  "bpmn:Participant",
  "bpmn:Lane",
  "bpmn:DataObjectReference",
  "bpmn:DataStoreReference",
  "bpmn:DataInput",
  "bpmn:DataOutput",
  "bpmn:Group",
  "bpmn:TextAnnotation",
]);

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

export type PaintHeatmapOptions = {
  /** Target 2D context — already DPR-transformed and cleared by the caller. */
  ctx: CanvasRenderingContext2D;
  /** CSS-pixel size of the overlay canvas. */
  cssW: number;
  cssH: number;
  /** Bounding rect of the overlay's positioning wrapper. */
  wrapperRect: DOMRect;
  /** The bpmn-js SVG element. */
  svg: SVGSVGElement;
  /** All diagram elements (elementRegistry.getAll()). */
  elements: HeatmapElement[];
  /** Element-id → weight in [0,1]. */
  weights: Record<string, number>;
};

export function paintHeatmap({ ctx, cssW, cssH, wrapperRect, svg, elements, weights }: PaintHeatmapOptions): void {
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
  // and merge the inferred values with the raw weights. The result is a
  // continuous gradient that shows where the process flow is heading
  // (forward) and where it came from (backward), peaked at the real hot
  // spots.
  const byId: Record<string, HeatmapElement> = {};
  for (const el of elements) byId[el.id] = el;
  const fwd: Record<string, string[]> = {};
  const bwd: Record<string, string[]> = {};
  for (const el of elements) {
    // Only sequence flows carry tokens — message flows/associations don't,
    // so heat must not propagate across them into other pools.
    if (el.businessObject?.$type !== "bpmn:SequenceFlow") continue;
    const srcId = el.source?.id ?? el.businessObject?.sourceRef?.id;
    const tgtId = el.target?.id ?? el.businessObject?.targetRef?.id;
    if (!srcId || !tgtId) continue;
    (fwd[srcId] ??= []).push(tgtId);
    (bwd[tgtId] ??= []).push(srcId);
  }
  const ATTENUATION = 0.6; // per-hop heat decay
  const MIN_HEAT = 0.05; // values below this are not visible — stop BFS
  const effective: Record<string, number> = {};
  for (const [id, raw] of Object.entries(weights)) {
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

  // Cap the halo footprint so a large flow node (e.g. an expanded
  // sub-process) can't bloom across the whole canvas.
  const MAX_HALO_SIZE = 140;
  for (const [id, raw] of Object.entries(effective)) {
    const v = Math.min(1, Math.max(0, raw));
    if (v <= 0) continue;
    // Pools/lanes/data/groups never hold tokens — no halo for them.
    if (NON_TOKEN_TYPES.has(byId[id]?.businessObject?.$type ?? "")) continue;
    const node = svg.querySelector(`[data-element-id="${CSS.escape(id)}"]`) as SVGGraphicsElement | null;
    if (!node) continue;
    const r = node.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    elementPts.push({
      x: r.left + r.width / 2 - wrapperRect.left,
      y: r.top + r.height / 2 - wrapperRect.top,
      v,
      w: Math.min(r.width, MAX_HALO_SIZE),
      h: Math.min(r.height, MAX_HALO_SIZE),
    });
  }

  // Flow corridors — sample every ~22px along each sequence flow, using
  // the propagated `effective` heat so paths between distant hot regions
  // also glow at their inferred intensity.
  for (const el of elements) {
    if (!el.waypoints || el.waypoints.length < 2) continue;
    // Only sequence flows glow — message flows/associations don't carry tokens.
    if (el.businessObject?.$type !== "bpmn:SequenceFlow") continue;
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
    const t = Math.min(1, (a / 255) ** 0.5);
    const [r, g, b] = heatColor(t);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = Math.min(230, Math.round(a * 1.8));
  }
  octx.putImageData(img, 0, 0);
  ctx.drawImage(off, 0, 0, cssW, cssH);
}
