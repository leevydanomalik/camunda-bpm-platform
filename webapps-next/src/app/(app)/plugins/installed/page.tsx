"use client";

import Link from "next/link";

import { ArrowRight, PackageCheck, Puzzle, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setPluginInstalled, useInstalledKey } from "@/lib/plugins/install-state";
import { MANIFESTS } from "@/lib/plugins/manifests";
import type { PluginManifest } from "@/lib/plugins/types";

// One entry per manifest, stable order — drives a single install-state hook.
const ENTRIES = MANIFESTS.map((m) => ({
  id: m.id,
  defaultEnabled: m.builtIn ? true : (m.defaultEnabled ?? true),
}));

// Installed plugins — manifest data from the build-time registry, install
// state from the runtime plugin store (managed plugins can be uninstalled;
// built-ins can't).

const APP_LABELS: Record<string, string> = {
  cockpit: "Cockpit",
  tasklist: "Tasklist",
  admin: "Admin",
  welcome: "Welcome",
  shared: "Shared",
};

function PluginCard({ manifest }: { manifest: PluginManifest }) {
  const integrations = [
    ...manifest.client.extensionPoints.map((ext) => ({
      key: `${ext.point}:${ext.exportName}`,
      point: ext.point,
      detail: ext.label ?? ext.exportName,
    })),
    ...(manifest.capabilities ?? []).map((cap) => ({ key: cap, point: cap, detail: "Capability" })),
  ];

  return (
    <div className="bg-card space-y-4 rounded-lg border p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Puzzle className="size-5" />
          </span>
          <div>
            <h2 className="text-sm leading-tight font-semibold">{manifest.displayName}</h2>
            <p className="text-muted-foreground font-mono text-[11px]">
              {manifest.id} · v{manifest.version}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <PackageCheck className="size-3.5" /> Enabled
        </span>
      </div>

      {manifest.description ? (
        <p className="text-muted-foreground text-sm leading-relaxed">{manifest.description}</p>
      ) : null}

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {APP_LABELS[manifest.app] ?? manifest.app}
        </Badge>
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
          API v{manifest.apiVersion}
        </Badge>
        {manifest.builtIn ? (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
            Built-in
          </Badge>
        ) : null}
        {manifest.commercial?.paid ? (
          <Badge className="bg-primary/15 text-primary h-5 border-0 px-1.5 text-[10px]">
            {manifest.commercial.tier ?? "Paid"} · {manifest.commercial.price}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Integrations</p>
        {integrations.map((it) => (
          <div key={it.key} className="bg-muted/40 flex items-center justify-between gap-2 rounded-md border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs">{it.point}</p>
              <p className="text-muted-foreground text-[11px]">{it.detail}</p>
            </div>
            <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
          </div>
        ))}
      </div>

      {!manifest.builtIn ? (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive w-full"
          onClick={() => {
            setPluginInstalled(manifest.id, false);
            toast(`${manifest.displayName} uninstalled`, {
              description: "Its features are gone until you install it again from the marketplace.",
            });
          }}
        >
          <Trash2 className="size-4" />
          Uninstall
        </Button>
      ) : null}
    </div>
  );
}

export default function InstalledPluginsPage() {
  const key = useInstalledKey(ENTRIES);
  const installed = MANIFESTS.filter((m, i) => m.builtIn || key[i] === "1");
  const totalIntegrations = installed.reduce(
    (a, m) => a + m.client.extensionPoints.length + (m.capabilities?.length ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Installed plugins</h1>
          <p className="text-muted-foreground text-sm">
            {installed.length} plugin{installed.length === 1 ? "" : "s"} contributing {totalIntegrations} integration
            {totalIntegrations === 1 ? "" : "s"}. Uninstalling a plugin removes its features everywhere, instantly.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/plugins/marketplace">
            <Store className="size-4" />
            Browse marketplace
          </Link>
        </Button>
      </header>

      {installed.length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed p-10 text-center text-sm">
          <Puzzle className="mx-auto mb-3 size-8 opacity-50" />
          No plugins installed yet.{" "}
          <Link href="/plugins/marketplace" className="text-primary font-medium">
            Find one in the marketplace
          </Link>
          .
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {installed.map((m) => (
            <PluginCard key={m.id} manifest={m} />
          ))}
        </div>
      )}
    </div>
  );
}
