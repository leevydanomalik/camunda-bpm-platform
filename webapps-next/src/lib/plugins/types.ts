// Plugin contract v0 — minimal subset of §4.3 of the migration blueprint.
// Drops: server routes, overrides, lifecycle hooks, permissions, dynamic
// discovery. Validates the shape (manifest + extension-point dispatch +
// client component rendering) with the smallest viable surface.

import type { ComponentType } from "react";

export type PluginExtensionPoint = {
  /** Extension-point id — must match a slot rendered by an <ExtensionSlot point="..."/>. */
  point: string;
  /** Named export from the plugin's client entry module. */
  exportName: string;
  /** Higher = renders first within a slot. Default 0. */
  priority?: number;
  /** Optional human label (debugging / future plugin manager UI). */
  label?: string;
};

/** Commercial metadata for paid plugins (marketplace display + gating). */
export type PluginCommercial = {
  paid: boolean;
  /** Human-readable price, e.g. "$29 / month". */
  price: string;
  /** Display tier, e.g. "Pro". */
  tier?: string;
};

export type PluginManifest = {
  apiVersion: "1";
  id: string;
  version: string;
  displayName: string;
  description?: string;
  app: "cockpit" | "tasklist" | "admin" | "welcome" | "shared";
  /** Ships with the app; always installed, cannot be uninstalled. */
  builtIn?: boolean;
  /** Initial install state for managed (non-built-in) plugins. Default true. */
  defaultEnabled?: boolean;
  commercial?: PluginCommercial;
  /**
   * Non-component integration points the plugin provides (e.g. the diagram
   * heatmap painter). Purely declarative — consumers gate on install state.
   */
  capabilities?: string[];
  client: {
    extensionPoints: PluginExtensionPoint[];
  };
};

/** Runtime representation: manifest + the actual loaded client module. */
export type RegisteredPlugin = {
  manifest: PluginManifest;
  /** Map of `exportName → React component`. The registry resolves these eagerly at build time. */
  clientExports: Record<string, ComponentType<Record<string, unknown>>>;
};
