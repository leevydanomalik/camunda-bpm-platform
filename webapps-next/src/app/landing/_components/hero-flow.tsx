import { Activity, Sparkles } from "lucide-react";

// ── Living BPMN diagram ──────────────────────────────────────────────────────
// The hero visual is the product itself: a small process with tokens (dots)
// traveling the sequence flows via SMIL animateMotion. Tokens are drawn UNDER
// the node shapes, so they appear to enter and leave each activity. Everything
// is painted with theme tokens, so it re-tints with light/dark and presets.

const FLOW = "color-mix(in oklch, var(--foreground) 38%, transparent)";
const NODE_STROKE = "color-mix(in oklch, var(--foreground) 42%, transparent)";
const NODE_FILL = "var(--card)";

function TaskNode({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <rect x={x} y={y} width={124} height={64} rx={12} fill={NODE_FILL} stroke={NODE_STROKE} strokeWidth={1.5} />
      <text
        x={x + 62}
        y={y + 36}
        textAnchor="middle"
        fontSize={12.5}
        fontWeight={550}
        fill="var(--foreground)"
        style={{ fontFamily: "inherit" }}
      >
        {label}
      </text>
    </g>
  );
}

export function HeroFlow() {
  return (
    <div className="relative">
      {/* Diagram card */}
      <div className="border-border/60 bg-card/60 relative overflow-hidden rounded-3xl border p-4 shadow-2xl backdrop-blur">
        <svg
          viewBox="0 0 660 440"
          className="h-auto w-full"
          role="img"
          aria-label="A live BPMN process with tokens moving through it"
        >
          <defs>
            <pattern id="hf-grid" width={26} height={26} patternUnits="userSpaceOnUse">
              <circle cx={1.2} cy={1.2} r={1.2} fill="color-mix(in oklch, var(--foreground) 9%, transparent)" />
            </pattern>
            <marker
              id="hf-arrow"
              viewBox="0 0 10 10"
              refX={9}
              refY={5}
              markerWidth={7}
              markerHeight={7}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={FLOW} />
            </marker>
          </defs>

          <rect width={660} height={440} fill="url(#hf-grid)" />

          {/* Sequence flows */}
          <g stroke={FLOW} strokeWidth={1.75} fill="none">
            <path d="M 78 220 H 154" markerEnd="url(#hf-arrow)" />
            <path d="M 282 220 H 328" markerEnd="url(#hf-arrow)" />
            <path d="M 362 190 V 120 H 434" markerEnd="url(#hf-arrow)" />
            <path d="M 362 250 V 350 H 434" markerEnd="url(#hf-arrow)" />
            <path d="M 562 120 H 600 V 198" markerEnd="url(#hf-arrow)" />
            <path d="M 562 350 H 600 V 242" markerEnd="url(#hf-arrow)" />
          </g>

          {/* Tokens — drawn before nodes so they slide underneath activities. */}
          <g className="hf-token">
            <circle r={5.5} fill="var(--primary)">
              <animateMotion dur="7s" repeatCount="indefinite" path="M 60 220 H 362 V 120 H 600 V 220" />
            </circle>
            <circle r={5.5} fill="var(--primary)" opacity={0.9}>
              <animateMotion dur="7s" begin="3.5s" repeatCount="indefinite" path="M 60 220 H 362 V 120 H 600 V 220" />
            </circle>
            <circle r={5.5} fill="var(--primary)" opacity={0.8}>
              <animateMotion dur="8.5s" begin="1.6s" repeatCount="indefinite" path="M 60 220 H 362 V 350 H 600 V 220" />
            </circle>
          </g>

          {/* Start event */}
          <circle cx={60} cy={220} r={18} fill={NODE_FILL} stroke="var(--primary)" strokeWidth={2} />

          {/* Tasks */}
          <TaskNode x={158} y={188} label="Review request" />
          <TaskNode x={438} y={88} label="Approve" />
          <TaskNode x={438} y={318} label="Escalate" />

          {/* Gateway */}
          <path d="M 362 190 L 392 220 L 362 250 L 332 220 Z" fill={NODE_FILL} stroke={NODE_STROKE} strokeWidth={1.5} />
          <path
            d="M 354 212 L 370 228 M 370 212 L 354 228"
            stroke={NODE_STROKE}
            strokeWidth={2}
            strokeLinecap="round"
          />

          {/* Incident pulse on Escalate */}
          <g className="hf-pulse">
            <circle cx={562} cy={318} r={10} fill="none" stroke="var(--destructive)" strokeWidth={1.5}>
              <animate attributeName="r" values="6;16" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle cx={562} cy={318} r={5} fill="var(--destructive)" />
          </g>

          {/* End event */}
          <circle
            cx={600}
            cy={220}
            r={18}
            fill={NODE_FILL}
            stroke="var(--foreground)"
            strokeWidth={3.5}
            opacity={0.75}
          />
        </svg>
      </div>

      {/* Floating status cards */}
      <div className="hf-float border-border bg-card/95 absolute -top-4 -left-3 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 shadow-lg backdrop-blur sm:-left-8">
        <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
          <Activity className="size-4" />
        </span>
        <div>
          <p className="text-sm leading-tight font-semibold">3 tokens in flight</p>
          <p className="text-muted-foreground text-xs">live from the engine</p>
        </div>
      </div>

      <div className="hf-float-slow border-border bg-card/95 absolute -right-3 -bottom-5 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 shadow-lg backdrop-blur sm:-right-8">
        <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
          <Sparkles className="size-4" />
        </span>
        <div>
          <p className="text-sm leading-tight font-semibold">AI: one branch needs attention</p>
          <p className="text-muted-foreground text-xs">executive summary, on demand</p>
        </div>
      </div>

      <style>{`
        .hf-float { animation: hf-float 5.5s ease-in-out infinite; }
        .hf-float-slow { animation: hf-float 7s ease-in-out infinite reverse; }
        @keyframes hf-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hf-token, .hf-pulse { display: none; }
          .hf-float, .hf-float-slow { animation: none; }
        }
      `}</style>
    </div>
  );
}
