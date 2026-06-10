"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Camunda generic-form variable types (the common subset the legacy Tasklist offers). */
const VARIABLE_TYPES = ["String", "Boolean", "Integer", "Long", "Double", "Date", "Json"] as const;
type VariableType = (typeof VARIABLE_TYPES)[number];

type Row = { id: string; name: string; type: VariableType; value: string };

type InitialVariable = { type: string; value: unknown };

let rowSeq = 0;
function newRow(partial?: Partial<Row>): Row {
  rowSeq += 1;
  return { id: `r${rowSeq}`, name: "", type: "String", value: "", ...partial };
}

/** Map an engine variable type onto one our select knows; default to String. */
function normalizeType(t: string): VariableType {
  const match = VARIABLE_TYPES.find((x) => x.toLowerCase() === t.toLowerCase());
  return match ?? "String";
}

function stringifyValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Coerce a row's string value into the JSON the engine expects for that type. */
function coerce(type: VariableType, raw: string): { value: unknown; type: string } {
  switch (type) {
    case "Boolean":
      return { value: raw.trim().toLowerCase() === "true", type: "Boolean" };
    case "Integer":
    case "Long":
      return { value: raw.trim() === "" ? null : Number.parseInt(raw, 10), type };
    case "Double":
      return { value: raw.trim() === "" ? null : Number.parseFloat(raw), type: "Double" };
    case "Json":
      // Send as a Json-typed variable; valueInfo lets the engine deserialize.
      return { value: raw, type: "Json" };
    default:
      return { value: raw, type };
  }
}

/**
 * The generic variable form — shown for user tasks that have no deployed form.
 * Mirrors the legacy Tasklist "Form" tab: a read-only Business Key, a "Load
 * Variables" shortcut, an "Add a variable" builder, and a Complete button.
 */
export function TaskGenericForm({
  taskId,
  businessKey,
  initialVariables,
  canComplete,
  redirectOnComplete,
}: {
  taskId: string;
  businessKey: string | null;
  initialVariables: Record<string, InitialVariable>;
  /** Complete is only enabled once the task is assigned to the current user (matches legacy). */
  canComplete: boolean;
  redirectOnComplete?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function addRow() {
    setRows((r) => [...r, newRow()]);
  }

  function loadVariables() {
    const loaded = Object.entries(initialVariables).map(([name, v]) =>
      newRow({ name, type: normalizeType(v.type), value: stringifyValue(v.value) }),
    );
    if (loaded.length === 0) {
      toast.info("No existing variables on this task.");
      return;
    }
    // Merge without clobbering rows the user is mid-edit on.
    setRows((existing) => {
      const have = new Set(existing.map((r) => r.name).filter(Boolean));
      return [...existing, ...loaded.filter((r) => !have.has(r.name))];
    });
  }

  function update(id: string, patch: Partial<Row>) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function remove(id: string) {
    setRows((r) => r.filter((row) => row.id !== id));
  }

  async function complete() {
    const variables: Record<string, { value: unknown; type: string }> = {};
    for (const row of rows) {
      const name = row.name.trim();
      if (!name) continue;
      variables[name] = coerce(row.type, row.value);
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variables }),
      });
      if (!res.ok) {
        toast.error((await res.json().catch(() => ({}))).error ?? "Complete failed");
        return;
      }
      toast.success("Task completed");
      if (redirectOnComplete) {
        startTransition(() => router.push(redirectOnComplete));
      } else {
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground bg-muted/30 rounded-md border px-3 py-2 text-xs">
        You can set variables using a generic form by clicking the “Add a variable” link below.
      </p>

      <div className="grid grid-cols-[7rem_1fr] items-center gap-x-3 gap-y-2">
        <label className="text-foreground/80 text-right text-xs font-medium">Business Key</label>
        <Input value={businessKey ?? ""} readOnly className="bg-muted/40 h-8 font-mono text-xs" />
      </div>

      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <Input
                placeholder="name"
                value={row.name}
                onChange={(e) => update(row.id, { name: e.target.value })}
                className="h-8 w-40 font-mono text-xs"
              />
              <Select value={row.type} onValueChange={(v) => update(row.id, { type: v as VariableType })}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VARIABLE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="value"
                value={row.value}
                onChange={(e) => update(row.id, { value: e.target.value })}
                className="h-8 flex-1 font-mono text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => remove(row.id)}
                aria-label="Remove variable"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 text-xs">
        <button
          type="button"
          onClick={addRow}
          className="text-primary/90 hover:text-primary inline-flex items-center gap-1 font-medium"
        >
          <Plus className="size-3.5" />
          Add a variable
        </button>
        <button
          type="button"
          onClick={loadVariables}
          className="text-primary/90 hover:text-primary inline-flex items-center gap-1 font-medium"
        >
          Load Variables
        </button>
      </div>

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        {!canComplete ? <span className="text-muted-foreground text-xs">Claim the task to complete it.</span> : null}
        <Button size="sm" disabled={busy || !canComplete} onClick={complete}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          <span className="ml-1">Complete</span>
        </Button>
      </div>
    </div>
  );
}
