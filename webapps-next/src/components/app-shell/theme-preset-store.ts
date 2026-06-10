"use client";

import { useEffect, useState } from "react";

export type ThemePreset = "default" | "violet" | "emerald" | "amber" | "rose";

export const THEME_PRESETS: { id: ThemePreset; label: string; swatch: string }[] = [
  { id: "default", label: "Default", swatch: "oklch(0.488 0.243 264.376)" },
  { id: "violet", label: "Violet", swatch: "oklch(0.55 0.25 295)" },
  { id: "emerald", label: "Emerald", swatch: "oklch(0.6 0.18 158)" },
  { id: "amber", label: "Amber", swatch: "oklch(0.72 0.18 70)" },
  { id: "rose", label: "Rose", swatch: "oklch(0.62 0.22 15)" },
];

const STORAGE_KEY = "camunda-next-theme-preset";

function isPreset(v: unknown): v is ThemePreset {
  return typeof v === "string" && THEME_PRESETS.some((p) => p.id === v);
}

function readInitial(): ThemePreset {
  if (typeof window === "undefined") return "default";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isPreset(stored) ? stored : "default";
}

function applyToDocument(preset: ThemePreset) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme-preset", preset);
}

/** Reads + writes the current theme preset, mirrors it onto <html data-theme-preset>. */
export function useThemePreset(): {
  preset: ThemePreset;
  setPreset: (next: ThemePreset) => void;
} {
  const [preset, setPresetState] = useState<ThemePreset>("default");
  // Hydrate from localStorage post-mount to avoid SSR mismatch.
  useEffect(() => {
    const initial = readInitial();
    setPresetState(initial);
    applyToDocument(initial);
  }, []);

  function setPreset(next: ThemePreset) {
    setPresetState(next);
    applyToDocument(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable — fine, preset just won't persist.
    }
  }

  return { preset, setPreset };
}
