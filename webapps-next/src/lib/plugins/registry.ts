// v0 plugin registry: a hand-maintained index. Real filesystem/npm discovery
// is deferred to phase 1 (would require a build-time codegen step to emit
// this file from `plugins/*/plugin.json` so dynamic plugin paths bundle
// correctly under Next.js + Turbopack).

import sampleManifest from "@/../plugins/sample-dashboard-widget/plugin.json";
import * as sampleClient from "@/../plugins/sample-dashboard-widget/client";

import type { PluginManifest, RegisteredPlugin } from "./types";

export const PLUGINS: RegisteredPlugin[] = [
  {
    manifest: sampleManifest as PluginManifest,
    clientExports: sampleClient as unknown as RegisteredPlugin["clientExports"],
  },
];

/** Plugins that target a given extension point, sorted by priority desc. */
export function pluginsForPoint(point: string): Array<{
  plugin: RegisteredPlugin;
  extension: RegisteredPlugin["manifest"]["client"]["extensionPoints"][number];
}> {
  const matches: Array<{
    plugin: RegisteredPlugin;
    extension: RegisteredPlugin["manifest"]["client"]["extensionPoints"][number];
  }> = [];
  for (const plugin of PLUGINS) {
    for (const ext of plugin.manifest.client.extensionPoints) {
      if (ext.point === point) matches.push({ plugin, extension: ext });
    }
  }
  matches.sort((a, b) => (b.extension.priority ?? 0) - (a.extension.priority ?? 0));
  return matches;
}
