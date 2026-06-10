import Link from "next/link";

import { PackageCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MANIFESTS } from "@/lib/plugins/manifests";

import { MarketplaceBrowser, type MarketplaceEntry } from "./_components/marketplace-browser";

// Marketplace catalog. Real (bundled) plugins come from the registry
// manifests — built-ins are always on, managed ones install/uninstall at
// runtime (paid ones via demo checkout). The rest is a curated list of what
// the plugin contract is designed to host; their Install buttons are honest
// placeholders until runtime plugin loading lands (phase 1).

const CATALOG: Omit<MarketplaceEntry, "kind">[] = [
  {
    id: "instance-migrator",
    displayName: "Instance Migrator",
    description: "Guided process-instance migration between definition versions, with a diff view and dry-run plan.",
    version: "0.9.0",
    app: "cockpit",
    author: "DEEPFLOW Labs",
  },
  {
    id: "external-task-monitor",
    displayName: "External Task Monitor",
    description: "Live view of external task workers — topics, lock expirations, error rates and retry curves.",
    version: "0.7.2",
    app: "cockpit",
    author: "DEEPFLOW Labs",
  },
  {
    id: "audit-trail-exporter",
    displayName: "Audit Trail Exporter",
    description: "Export history and audit data as CSV or PDF straight from any instance or definition page.",
    version: "1.1.0",
    app: "cockpit",
    author: "Community",
  },
  {
    id: "form-preview",
    displayName: "Form Preview",
    description: "Render Camunda Forms next to the task before you claim it — see what's being asked first.",
    version: "0.5.0",
    app: "tasklist",
    author: "Community",
  },
  {
    id: "identity-sync",
    displayName: "Identity Sync",
    description: "Synchronize users and groups from an external IdP into the engine's identity service.",
    version: "0.3.1",
    app: "admin",
    author: "DEEPFLOW Labs",
  },
  {
    id: "engine-telemetry",
    displayName: "Engine Telemetry",
    description: "Job executor saturation, history cleanup lag and DB pool metrics on the dashboard.",
    version: "0.8.0",
    app: "shared",
    author: "Community",
  },
];

export default function MarketplacePage() {
  const real: MarketplaceEntry[] = MANIFESTS.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    description: m.description ?? "",
    version: m.version,
    app: m.app,
    author: m.commercial?.paid ? "DEEPFLOW Labs" : "Built-in",
    kind: m.builtIn ? "builtin" : "managed",
    price: m.commercial?.price,
    tier: m.commercial?.tier,
    defaultEnabled: m.defaultEnabled,
  }));

  const entries: MarketplaceEntry[] = [
    ...real,
    ...CATALOG.filter((c) => !real.some((r) => r.id === c.id)).map((c) => ({ ...c, kind: "catalog" as const })),
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Plugin marketplace</h1>
          <p className="text-muted-foreground text-sm">
            Extend DEEPFLOW with plugins — each one contributes components or capabilities across the apps.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/plugins/installed">
            <PackageCheck className="size-4" />
            Installed
          </Link>
        </Button>
      </header>

      <MarketplaceBrowser entries={entries} />
    </div>
  );
}
