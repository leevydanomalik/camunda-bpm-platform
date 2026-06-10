// Manifest-only view of the registry — safe to import from client components
// (registry.ts also pulls each plugin's client module, which may contain
// server-only code like engine-rest calls).

import heatmapManifest from "@/../plugins/heatmap-pro/plugin.json";
import sampleManifest from "@/../plugins/sample-dashboard-widget/plugin.json";

import type { PluginManifest } from "./types";

export const MANIFESTS: PluginManifest[] = [sampleManifest as PluginManifest, heatmapManifest as PluginManifest];

export const HEATMAP_PLUGIN_ID = "heatmap-pro";

export function manifestById(id: string): PluginManifest | undefined {
  return MANIFESTS.find((m) => m.id === id);
}
