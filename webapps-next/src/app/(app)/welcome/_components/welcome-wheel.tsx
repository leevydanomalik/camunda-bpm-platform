"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Inbox, Layers, LayoutDashboard, Package, ShieldCheck, Table2, Users, Workflow } from "lucide-react";

// ── Radial navigation hub ────────────────────────────────────────────────────
// A segmented wheel (annulus sectors) where every slice is a destination.
// Fills are color-mixed from the theme's --primary against --background, so
// the wheel re-tints with light/dark and any theme preset. Hovering a slice
// pops it outward along its mid-angle, like the reference dial.

type Segment = {
  label: string;
  href: string;
  icon: typeof Workflow;
};

const SEGMENTS: Segment[] = [
  { label: "Dashboard", href: "/cockpit", icon: LayoutDashboard },
  { label: "Processes", href: "/cockpit/processes", icon: Workflow },
  { label: "Decisions", href: "/cockpit/decisions", icon: Table2 },
  { label: "Inbox", href: "/tasklist", icon: Inbox },
  { label: "Batches", href: "/cockpit/batches", icon: Layers },
  { label: "Deployments", href: "/cockpit/deployments", icon: Package },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Authorizations", href: "/admin/authorizations", icon: ShieldCheck },
];

// Three alternating strengths of the primary hue — adjacent slices always differ.
const SHADES = [85, 62, 44];

const SIZE = 480;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 232;
const R_INNER = 96;
const POP = 9; // px a slice travels outward on hover

function polar(r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

function sectorPath(a0: number, a1: number): string {
  const [x0, y0] = polar(R_OUTER, a0);
  const [x1, y1] = polar(R_OUTER, a1);
  const [x2, y2] = polar(R_INNER, a1);
  const [x3, y3] = polar(R_INNER, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${R_INNER} ${R_INNER} 0 ${large} 0 ${x3} ${y3} Z`;
}

// ── Sonar ping (Web Audio) ───────────────────────────────────────────────────
// A short downward chirp with an echo — the classic submarine ping. The
// context is created lazily on first hover; if the browser still blocks audio
// (no prior user activation) we fail silently.
let audioCtx: AudioContext | null = null;

function playSonar() {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const ping = (at: number, gainPeak: number) => {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1350, at);
      osc.frequency.exponentialRampToValueAtTime(520, at + 0.9);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(gainPeak, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.0);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(at);
      osc.stop(at + 1.05);
    };
    const now = audioCtx.currentTime;
    ping(now, 0.12); // the ping
    ping(now + 0.45, 0.04); // …and its echo
  } catch {
    // audio unavailable/blocked — purely cosmetic, ignore
  }
}

export function WelcomeWheel({
  username,
  yourTasks,
  allTasks,
}: {
  username: string;
  yourTasks: number | null;
  allTasks: number | null;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState<number | null>(null);
  const [hubHover, setHubHover] = useState(false);

  const step = 360 / SEGMENTS.length;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px] select-none">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full overflow-visible" role="presentation">
        {/* Sonar ring — spins while the hub is hovered. */}
        <g
          style={{
            transformBox: "view-box",
            transformOrigin: "50% 50%",
            animation: hubHover ? "wheel-sonar-spin 5s linear infinite" : "none",
          }}
        >
          <circle
            cx={CX}
            cy={CY}
            r={R_OUTER + 6}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={1.5}
            strokeDasharray="22 10 4 10"
            opacity={hubHover ? 0.9 : 0.25}
            style={{ transition: "opacity 250ms ease" }}
          />
        </g>

        {/* Expanding sonar pulses — only while hovered. */}
        {hubHover ? (
          <>
            <circle cx={CX} cy={CY} r={R_INNER} className="wheel-ping" />
            <circle cx={CX} cy={CY} r={R_INNER} className="wheel-ping" style={{ animationDelay: "0.9s" }} />
          </>
        ) : null}
        {SEGMENTS.map((seg, i) => {
          const a0 = i * step;
          const a1 = a0 + step;
          const mid = ((a0 + a1) / 2 - 90) * (Math.PI / 180);
          const isHover = hovered === i;
          const dx = isHover ? POP * Math.cos(mid) : 0;
          const dy = isHover ? POP * Math.sin(mid) : 0;
          return (
            // biome-ignore lint/a11y/useSemanticElements: SVG path acts as a link target
            <path
              key={seg.label}
              d={sectorPath(a0, a1)}
              role="link"
              tabIndex={0}
              aria-label={seg.label}
              onClick={() => router.push(seg.href)}
              onKeyDown={(e) => e.key === "Enter" && router.push(seg.href)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              className="cursor-pointer outline-none"
              style={{
                fill: `color-mix(in oklch, var(--primary) ${SHADES[i % SHADES.length]}%, var(--background))`,
                stroke: "var(--background)",
                strokeWidth: 2,
                transform: `translate(${dx}px, ${dy}px)`,
                transition: "transform 200ms ease, filter 200ms ease",
                filter: isHover ? "brightness(1.08)" : "none",
              }}
            />
          );
        })}
      </svg>

      {/* Icon + label overlays — pointer-events pass through to the slices. */}
      {SEGMENTS.map((seg, i) => {
        const midDeg = i * step + step / 2;
        const [x, y] = polar((R_OUTER + R_INNER) / 2 + 4, midDeg);
        const mid = ((midDeg - 90) * Math.PI) / 180;
        const isHover = hovered === i;
        const dx = isHover ? POP * Math.cos(mid) : 0;
        const dy = isHover ? POP * Math.sin(mid) : 0;
        const Icon = seg.icon;
        return (
          <div
            key={seg.label}
            className="text-foreground pointer-events-none absolute flex w-24 flex-col items-center gap-1.5 text-center"
            style={{
              left: `${(x / SIZE) * 100}%`,
              top: `${(y / SIZE) * 100}%`,
              transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`,
              transition: "transform 200ms ease",
            }}
          >
            <Icon className="size-6" strokeWidth={1.75} />
            <span className="text-[12px] leading-tight font-semibold">{seg.label}</span>
          </div>
        );
      })}

      {/* Center hub — hovering it spins the sonar ring and pings. */}
      <div
        onMouseEnter={() => {
          setHubHover(true);
          playSonar();
        }}
        onMouseLeave={() => setHubHover(false)}
        className="bg-background absolute top-1/2 left-1/2 flex size-[38%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full text-center shadow-[0_0_0_2px_var(--border)]"
        style={{
          boxShadow: hubHover
            ? "0 0 0 2px var(--primary), 0 0 32px color-mix(in oklch, var(--primary) 35%, transparent)"
            : undefined,
          transition: "box-shadow 250ms ease",
        }}
      >
        <p className="text-muted-foreground text-[11px] tracking-wide uppercase">Welcome, {username}</p>
        <p className="text-lg leading-tight font-bold tracking-tight">Where to today?</p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {yourTasks ?? "—"} yours · {allTasks ?? "—"} open
        </p>
      </div>

      <style>{`
        @keyframes wheel-sonar-spin {
          to { transform: rotate(360deg); }
        }
        .wheel-ping {
          fill: none;
          stroke: var(--primary);
          stroke-width: 2;
          animation: wheel-ping 1.8s ease-out infinite;
        }
        @keyframes wheel-ping {
          0% { r: ${R_INNER}; opacity: 0.7; }
          100% { r: ${R_OUTER + 6}; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
