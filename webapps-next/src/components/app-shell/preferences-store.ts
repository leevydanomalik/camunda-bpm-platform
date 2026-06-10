"use client";

import { useEffect, useState } from "react";

// ── Preference value tables ─────────────────────────────────────────────────

export type ThemePreset = "default" | "brutalist" | "soft-pop" | "tangerine";
export type AppFont = "inter";
export type PageLayout = "centered" | "full";
export type NavbarBehavior = "sticky" | "scroll";
export type SidebarStyle = "inset" | "sidebar" | "floating";
export type SidebarCollapse = "icon" | "offcanvas";

export const THEME_PRESETS: { id: ThemePreset; label: string; swatch: string }[] = [
  { id: "default", label: "Default", swatch: "oklch(0.488 0.243 264.376)" },
  { id: "brutalist", label: "Brutalist", swatch: "oklch(0.22 0 0)" },
  { id: "soft-pop", label: "Soft Pop", swatch: "oklch(0.78 0.15 350)" },
  { id: "tangerine", label: "Tangerine", swatch: "oklch(0.72 0.18 55)" },
];

export const APP_FONTS: { id: AppFont; label: string }[] = [{ id: "inter", label: "Inter" }];

export const PAGE_LAYOUTS: { id: PageLayout; label: string }[] = [
  { id: "centered", label: "Centered" },
  { id: "full", label: "Full Width" },
];

export const NAVBAR_BEHAVIORS: { id: NavbarBehavior; label: string }[] = [
  { id: "sticky", label: "Sticky" },
  { id: "scroll", label: "Scroll" },
];

export const SIDEBAR_STYLES: { id: SidebarStyle; label: string }[] = [
  { id: "inset", label: "Inset" },
  { id: "sidebar", label: "Sidebar" },
  { id: "floating", label: "Floating" },
];

export const SIDEBAR_COLLAPSES: { id: SidebarCollapse; label: string }[] = [
  { id: "icon", label: "Icon" },
  { id: "offcanvas", label: "OffCanvas" },
];

// ── Storage ──────────────────────────────────────────────────────────────────

export type Preferences = {
  themePreset: ThemePreset;
  font: AppFont;
  pageLayout: PageLayout;
  navbarBehavior: NavbarBehavior;
  sidebarStyle: SidebarStyle;
  sidebarCollapse: SidebarCollapse;
};

export const PREFERENCE_DEFAULTS: Preferences = {
  themePreset: "default",
  font: "inter",
  pageLayout: "full",
  navbarBehavior: "sticky",
  sidebarStyle: "inset",
  sidebarCollapse: "icon",
};

const STORAGE_KEY = "camunda-next-prefs";

// Sidebar style/collapsible are also mirrored into cookies so the server-side
// layout can render the right Sidebar variant on initial load (no hydration
// flicker). The other prefs stay localStorage-only.
export const SIDEBAR_STYLE_COOKIE = "cnext-sb-style";
export const SIDEBAR_COLLAPSE_COOKIE = "cnext-sb-collapse";

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  // 1 year, root-scoped, lax — these are layout prefs, not credentials.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

const PRESETS = new Set<ThemePreset>(THEME_PRESETS.map((p) => p.id));
const FONTS = new Set<AppFont>(APP_FONTS.map((f) => f.id));
const LAYOUTS = new Set<PageLayout>(PAGE_LAYOUTS.map((l) => l.id));
const NAVBARS = new Set<NavbarBehavior>(NAVBAR_BEHAVIORS.map((n) => n.id));
const SIDEBARS = new Set<SidebarStyle>(SIDEBAR_STYLES.map((s) => s.id));
const COLLAPSES = new Set<SidebarCollapse>(SIDEBAR_COLLAPSES.map((c) => c.id));

function pickFromSet<T>(set: Set<T>, candidate: unknown, fallback: T): T {
  return (set as Set<unknown>).has(candidate) ? (candidate as T) : fallback;
}

function readFromStorage(): Preferences {
  if (typeof window === "undefined") return PREFERENCE_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return PREFERENCE_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      themePreset: pickFromSet(PRESETS, parsed.themePreset, PREFERENCE_DEFAULTS.themePreset),
      font: pickFromSet(FONTS, parsed.font, PREFERENCE_DEFAULTS.font),
      pageLayout: pickFromSet(LAYOUTS, parsed.pageLayout, PREFERENCE_DEFAULTS.pageLayout),
      navbarBehavior: pickFromSet(NAVBARS, parsed.navbarBehavior, PREFERENCE_DEFAULTS.navbarBehavior),
      sidebarStyle: pickFromSet(SIDEBARS, parsed.sidebarStyle, PREFERENCE_DEFAULTS.sidebarStyle),
      sidebarCollapse: pickFromSet(COLLAPSES, parsed.sidebarCollapse, PREFERENCE_DEFAULTS.sidebarCollapse),
    };
  } catch {
    return PREFERENCE_DEFAULTS;
  }
}

function writeToStorage(prefs: Preferences) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable — preference just won't persist this session.
  }
  // Mirror sidebar-related prefs into cookies so the server-side layout can
  // pick them up on the next request.
  writeCookie(SIDEBAR_STYLE_COOKIE, prefs.sidebarStyle);
  writeCookie(SIDEBAR_COLLAPSE_COOKIE, prefs.sidebarCollapse);
}

function applyToDocument(prefs: Preferences) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.setAttribute("data-theme-preset", prefs.themePreset);
  el.setAttribute("data-font", prefs.font);
  el.setAttribute("data-layout", prefs.pageLayout);
  el.setAttribute("data-navbar", prefs.navbarBehavior);
  el.setAttribute("data-sidebar-style", prefs.sidebarStyle);
  el.setAttribute("data-sidebar-collapse", prefs.sidebarCollapse);
}

// ── Cross-component sync ─────────────────────────────────────────────────────

const STORAGE_EVENT = "camunda-next-prefs:change";

function broadcast(prefs: Preferences) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Preferences>(STORAGE_EVENT, { detail: prefs }));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePreferences(): {
  prefs: Preferences;
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  reset: () => void;
} {
  const [prefs, setPrefs] = useState<Preferences>(PREFERENCE_DEFAULTS);

  // Hydrate after mount to avoid SSR mismatch.
  useEffect(() => {
    const stored = readFromStorage();
    setPrefs(stored);
    applyToDocument(stored);

    function onBroadcast(e: Event) {
      const next = (e as CustomEvent<Preferences>).detail;
      setPrefs(next);
      applyToDocument(next);
    }
    window.addEventListener(STORAGE_EVENT, onBroadcast);
    return () => window.removeEventListener(STORAGE_EVENT, onBroadcast);
  }, []);

  function commit(next: Preferences) {
    setPrefs(next);
    applyToDocument(next);
    writeToStorage(next);
    broadcast(next);
  }

  function set<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    commit({ ...prefs, [key]: value });
  }

  function reset() {
    commit(PREFERENCE_DEFAULTS);
  }

  return { prefs, set, reset };
}
