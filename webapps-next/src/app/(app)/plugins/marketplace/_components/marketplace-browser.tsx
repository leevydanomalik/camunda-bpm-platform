"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { Download, PackageCheck, Puzzle, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setPluginInstalled, usePluginInstalled } from "@/lib/plugins/install-state";
import { cn } from "@/lib/utils";

export type MarketplaceEntry = {
  id: string;
  displayName: string;
  description: string;
  version: string;
  app: string;
  author: string;
  /** builtin: always on · managed: bundled, installable at runtime · catalog: not yet available */
  kind: "builtin" | "managed" | "catalog";
  price?: string;
  tier?: string;
  defaultEnabled?: boolean;
};

const APP_LABELS: Record<string, string> = {
  all: "All",
  cockpit: "Cockpit",
  tasklist: "Tasklist",
  admin: "Admin",
  welcome: "Welcome",
  shared: "Shared",
};

function EntryAction({ entry }: { entry: MarketplaceEntry }) {
  const installed = usePluginInstalled(entry.id, entry.kind === "builtin" ? true : (entry.defaultEnabled ?? true));

  if (entry.kind === "builtin" || (entry.kind === "managed" && installed)) {
    return (
      <Button variant="outline" size="sm" className="w-full" asChild>
        <Link href="/plugins/installed">
          <PackageCheck className="size-4 text-emerald-500" />
          Installed
        </Link>
      </Button>
    );
  }

  if (entry.kind === "managed") {
    return (
      <Button
        size="sm"
        className="w-full"
        onClick={() => {
          setPluginInstalled(entry.id, true);
          toast.success(`${entry.displayName} activated`, {
            description: entry.price
              ? `Demo checkout (${entry.price}) — open any process diagram to see it.`
              : "Open any process diagram to see it.",
          });
        }}
      >
        <ShoppingCart className="size-4" />
        {entry.price ? `Buy & install · ${entry.price}` : "Install"}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      className="w-full"
      disabled
      title="One-click installation arrives in a later wave — for now, plugins register at build time"
    >
      <Download className="size-4" />
      Install
    </Button>
  );
}

function EntryCard({ entry }: { entry: MarketplaceEntry }) {
  return (
    <div className="bg-card flex flex-col rounded-lg border p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
          <Puzzle className="size-5" />
        </span>
        <div className="flex items-center gap-1.5">
          {entry.price ? (
            <Badge className="bg-primary/15 text-primary h-5 border-0 px-1.5 text-[10px]">
              {entry.tier ?? "Paid"} · {entry.price}
            </Badge>
          ) : null}
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            {APP_LABELS[entry.app] ?? entry.app}
          </Badge>
        </div>
      </div>
      <h2 className="text-sm font-semibold">{entry.displayName}</h2>
      <p className="text-muted-foreground font-mono text-[11px]">
        v{entry.version} · {entry.author}
      </p>
      <p className="text-muted-foreground mt-2 flex-1 text-sm leading-relaxed">{entry.description}</p>
      <div className="mt-4">
        <EntryAction entry={entry} />
      </div>
    </div>
  );
}

export function MarketplaceBrowser({ entries }: { entries: MarketplaceEntry[] }) {
  const [q, setQ] = useState("");
  const [app, setApp] = useState("all");

  const apps = useMemo(() => ["all", ...new Set(entries.map((e) => e.app))], [entries]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (app !== "all" && e.app !== app) return false;
      if (!needle) return true;
      return (
        e.displayName.toLowerCase().includes(needle) ||
        e.description.toLowerCase().includes(needle) ||
        e.id.toLowerCase().includes(needle)
      );
    });
  }, [entries, q, app]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search plugins…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          {apps.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setApp(a)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                app === a
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {APP_LABELS[a] ?? a}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground ml-auto text-xs">
          Showing {filtered.length} of {entries.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">No matches.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => (
            <EntryCard key={e.id} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}
