"use client";

import { useEffect, useRef } from "react";

// ── Matrix digital rain ──────────────────────────────────────────────────────
// Canvas background. Glyph color tracks the theme's --primary and the fade
// trail uses --background, so the rain re-tints with light/dark and presets.
// Honors prefers-reduced-motion (renders nothing) and pauses with rAF when
// the tab is hidden.

const GLYPHS = "01";
const FONT_SIZE = 15;
const STEP_MS = 60; // rain speed — one row per step

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function MatrixRain({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = 0;
    let drops: number[] = [];
    let glyph = cssVar("--primary") || "#22c55e";
    let fade = cssVar("--background") || "#000";

    function resize() {
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.ceil(width / FONT_SIZE);
      // Stagger new columns above the fold so the rain enters organically.
      drops = Array.from({ length: cols }, (_, i) => drops[i] ?? Math.floor(-Math.random() * 40));
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, width, height);
    }

    function frame(t: number) {
      raf = requestAnimationFrame(frame);
      if (t - last < STEP_MS) return;
      last = t;
      if (!canvas || !ctx) return;
      const { width, height } = canvas.getBoundingClientRect();

      // Translucent wash of the page background = the fading trails.
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${FONT_SIZE}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        const x = i * FONT_SIZE;
        const y = drops[i] * FONT_SIZE;
        if (y > 0) {
          // Bright head…
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = glyph;
          ctx.fillText(ch, x, y);
        }
        if (y > height && Math.random() > 0.975) {
          drops[i] = Math.floor(-Math.random() * 20);
        }
        drops[i]++;
      }
      ctx.globalAlpha = 1;
    }

    // Re-read theme colors when light/dark (or a preset) flips the root class.
    const observer = new MutationObserver(() => {
      glyph = cssVar("--primary") || glyph;
      fade = cssVar("--background") || fade;
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
