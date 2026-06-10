// Manifest-only view of the registry — safe to import from client components
// (registry.ts also pulls each plugin's client module, which may contain
// server-only code like engine-rest calls).

import heatmapManifest from "@/../plugins/heatmap-pro/plugin.json";
import sampleManifest from "@/../plugins/sample-dashboard-widget/plugin.json";
import tokenSimulationManifest from "@/../plugins/token-simulation/plugin.json";

import type { PluginManifest } from "./types";

export const MANIFESTS: PluginManifest[] = [
  sampleManifest as PluginManifest,
  heatmapManifest as PluginManifest,
  tokenSimulationManifest as PluginManifest,
];

export const HEATMAP_PLUGIN_ID = "heatmap-pro";
export const TOKEN_SIMULATION_PLUGIN_ID = "token-simulation";

export function manifestById(id: string): PluginManifest | undefined {
  return MANIFESTS.find((m) => m.id === id);
}
