"use client";

import { type ReactNode, useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { ArrowLeft, ListPlus, Loader2, Play, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type StartableProcess = {
  id: string;
  key: string;
  name: string | null;
  version: number;
  versionTag: string | null;
  description: string | null;
  tenantId: string | null;
};

type Step = "list" | "confirm";

export type StartProcessButtonProps = {
  /** Pre-select this process key — skips the list step entirely. */
  defaultKey?: string;
  variant?: "default" | "outline" | "ghost" | "secondary" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children?: ReactNode;
};

export function StartProcessButton({
  defaultKey,
  variant = "default",
  size = "sm",
  className,
  children,
}: StartProcessButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(defaultKey ? "confirm" : "list");
  const [processes, setProcesses] = useState<StartableProcess[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StartableProcess | null>(null);
  const [businessKey, setBusinessKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Fetch the startable-process list when the dialog opens.
  useEffect(() => {
    if (!open || processes !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/processes/startable", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as StartableProcess[];
        if (cancelled) return;
        setProcesses(data);
        if (defaultKey) {
          const match = data.find((p) => p.key === defaultKey);
          if (match) setSelected(match);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, processes, defaultKey]);

  const filtered = useMemo(() => {
    if (!processes) return null;
    const needle = search.trim().toLowerCase();
    if (!needle) return processes;
    return processes.filter(
      (p) =>
        (p.name ?? "").toLowerCase().includes(needle) ||
        p.key.toLowerCase().includes(needle) ||
        (p.tenantId ?? "").toLowerCase().includes(needle),
    );
  }, [processes, search]);

  function reset() {
    setStep(defaultKey ? "confirm" : "list");
    setSearch("");
    setSelected(defaultKey ? (processes?.find((p) => p.key === defaultKey) ?? null) : null);
    setBusinessKey("");
    setError(null);
    setSubmitting(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Defer reset so the closing animation isn't janky.
      setTimeout(reset, 200);
    }
  }

  function pick(p: StartableProcess) {
    setSelected(p);
    setStep("confirm");
  }

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/processes/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: selected.key,
          businessKey: businessKey.trim() || undefined,
          variables: {},
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? `Engine returned ${res.status}`);
        return;
      }
      toast.success(`Started ${selected.name ?? selected.key}`);
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          {children ?? (
            <>
              <ListPlus className="size-3.5" />
              {size !== "icon" ? <span className="ml-1">Start process</span> : null}
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "confirm" && !defaultKey ? (
              <button
                type="button"
                onClick={() => setStep("list")}
                className="text-muted-foreground hover:text-foreground inline-flex size-6 items-center justify-center rounded"
                title="Back to list"
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : null}
            Start process
            {step === "confirm" && selected ? (
              <span className="text-muted-foreground truncate font-normal">· {selected.name ?? selected.key}</span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {step === "list"
              ? "Pick a deployed process to start a new instance."
              : "Optionally tag the instance with a business key, then start."}
          </DialogDescription>
        </DialogHeader>

        {step === "list" ? (
          <ListStep processes={filtered} error={error} search={search} onSearchChange={setSearch} onPick={pick} />
        ) : null}

        {step === "confirm" && selected ? (
          <ConfirmStep
            process={selected}
            businessKey={businessKey}
            onBusinessKeyChange={setBusinessKey}
            disabled={busy}
          />
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={busy}>
            Close
          </Button>
          {step === "confirm" ? (
            <Button onClick={submit} disabled={busy || !selected}>
              {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Play className="mr-1.5 size-4" />}
              Start
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListStep({
  processes,
  error,
  search,
  onSearchChange,
  onPick,
}: {
  processes: StartableProcess[] | null;
  error: string | null;
  search: string;
  onSearchChange: (s: string) => void;
  onPick: (p: StartableProcess) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
        <Input
          autoFocus
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name or key…"
          className="h-9 pl-8 text-sm"
          disabled={!processes}
        />
      </div>
      <div className="bg-muted/30 max-h-64 overflow-y-auto rounded-md border">
        {error ? (
          <div className="text-muted-foreground p-6 text-center text-sm">Failed to load: {error}</div>
        ) : processes === null ? (
          <div className="text-muted-foreground p-6 text-center text-sm">Loading…</div>
        ) : processes.length === 0 ? (
          <div className="text-muted-foreground p-6 text-center text-sm">
            No startable processes deployed. Deploy a BPMN with{" "}
            <code className="bg-muted rounded px-1">isExecutable=&quot;true&quot;</code>.
          </div>
        ) : (
          <ul className="divide-y">
            {processes.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className="hover:bg-accent/40 block w-full px-3 py-2.5 text-left transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name ?? p.key}</div>
                      <div className="text-muted-foreground truncate font-mono text-[11px]">
                        {p.key} · v{p.version}
                        {p.versionTag ? ` (${p.versionTag})` : ""}
                      </div>
                    </div>
                    {p.tenantId ? (
                      <span className="border-border text-muted-foreground inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px]">
                        {p.tenantId}
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConfirmStep({
  process,
  businessKey,
  onBusinessKeyChange,
  disabled,
}: {
  process: StartableProcess;
  businessKey: string;
  onBusinessKeyChange: (s: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="bg-muted/30 rounded-md border px-3 py-2.5">
        <div className="text-sm font-medium">{process.name ?? process.key}</div>
        <div className="text-muted-foreground mt-0.5 font-mono text-[11px]">
          {process.key} · v{process.version}
          {process.versionTag ? ` (${process.versionTag})` : ""}
          {process.tenantId ? ` · tenant ${process.tenantId}` : ""}
        </div>
        {process.description ? <p className="text-muted-foreground mt-2 text-xs">{process.description}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="business-key" className="text-xs">
          Business key <span className="text-muted-foreground/70">(optional)</span>
        </Label>
        <Input
          id="business-key"
          value={businessKey}
          onChange={(e) => onBusinessKeyChange(e.target.value)}
          placeholder="e.g. ORDER-2026-0042"
          disabled={disabled}
          className="h-9 text-sm"
        />
        <p className="text-muted-foreground text-[11px]">
          A tag to find this specific instance later. Leave blank for an auto-generated id.
        </p>
      </div>
      <p className={cn("text-muted-foreground rounded-md border border-dashed px-3 py-2 text-[11px]")}>
        Variables form arrives in a later wave. The instance is started with empty variables.
      </p>
    </div>
  );
}
