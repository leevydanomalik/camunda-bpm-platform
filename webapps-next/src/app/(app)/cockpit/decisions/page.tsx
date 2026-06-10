import { GitBranch, Table2 } from "lucide-react";

import { engineGet } from "@/lib/camunda/engine";

import { type DecisionDefinitionRow, DecisionsTable } from "./_components/decisions-table";

async function loadDefinitions(): Promise<{
  defs: DecisionDefinitionRow[];
  error: string | null;
}> {
  try {
    const defs = await engineGet<DecisionDefinitionRow[]>(
      "/decision-definition?latestVersion=true&sortBy=name&sortOrder=asc",
    );
    return { defs, error: null };
  } catch (err) {
    return {
      defs: [],
      error: err instanceof Error ? err.message : "Failed to load decision definitions",
    };
  }
}

export default async function DecisionsPage() {
  const { defs, error } = await loadDefinitions();

  const drdCount = new Set(defs.map((d) => d.decisionRequirementsDefinitionKey).filter(Boolean) as string[]).size;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Decisions</h1>
        <p className="text-muted-foreground text-sm">DMN decision definitions (latest version, sorted by name).</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile
          icon={<Table2 className="text-muted-foreground size-4" />}
          label="Decision definitions"
          value={defs.length}
        />
        <StatTile
          icon={<GitBranch className="text-muted-foreground size-4" />}
          label="Decision requirement diagrams"
          value={drdCount}
        />
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border p-4 text-sm">
          Failed to load: {error}
        </div>
      ) : defs.length === 0 ? (
        <div className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
          No decision definitions deployed yet.
        </div>
      ) : (
        <DecisionsTable defs={defs} />
      )}
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card flex items-center justify-between rounded-md border px-4 py-3">
      <div className="space-y-0.5">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="text-2xl font-semibold tabular-nums">{new Intl.NumberFormat().format(value)}</div>
      </div>
      <div className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-md">{icon}</div>
    </div>
  );
}
