"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type FormJsInstance = {
  on: (event: string, cb: (e: unknown) => void) => void;
  submit: () => { data: Record<string, unknown>; errors: Record<string, unknown> };
  destroy: () => void;
};

export type TaskFormInternalProps = {
  taskId: string;
  schema: Record<string, unknown>;
  initialData: Record<string, unknown>;
  /** Optional route to push after a successful complete. Defaults to in-page refresh. */
  redirectOnComplete?: string;
};

export function TaskFormInternal({ taskId, schema, initialData, redirectOnComplete }: TaskFormInternalProps) {
  const router = useRouter();
  const hostRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<FormJsInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        setLoading(true);
        setImportError(null);
        const mod = await import("@bpmn-io/form-js");
        if (cancelled || !hostRef.current) return;
        const Form = (mod as { Form?: unknown }).Form as
          | (new (opts: {
              container: HTMLElement;
            }) => FormJsInstance)
          | undefined;
        if (!Form) {
          throw new Error("@bpmn-io/form-js Form export not found");
        }
        if (formRef.current) {
          formRef.current.destroy();
          formRef.current = null;
        }
        const form = new Form({ container: hostRef.current });
        formRef.current = form;
        await (form as unknown as { importSchema: (s: unknown, d?: unknown) => Promise<unknown> }).importSchema(
          schema,
          initialData,
        );
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load form";
        setImportError(msg);
        setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
      if (formRef.current) {
        formRef.current.destroy();
        formRef.current = null;
      }
    };
  }, [schema, initialData]);

  async function complete() {
    const form = formRef.current;
    if (!form) return;
    const result = form.submit();
    if (result.errors && Object.keys(result.errors).length > 0) {
      toast.error("Form has validation errors.");
      return;
    }
    setSubmitting(true);
    try {
      const variables: Record<string, { value: unknown; type: string }> = {};
      for (const [k, v] of Object.entries(result.data)) {
        variables[k] = { value: v, type: inferType(v) };
      }
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variables }),
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({}))).error ?? "Complete failed";
        toast.error(msg);
        return;
      }
      toast.success("Task completed");
      if (redirectOnComplete) {
        startTransition(() => router.push(redirectOnComplete));
      } else {
        startTransition(() => router.refresh());
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (importError) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border p-3 text-xs">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">Form renderer failed to load</p>
          <p className="text-destructive/80">{importError}</p>
          <p className="text-muted-foreground">
            Complete the task via the action bar after editing variables manually.
          </p>
        </div>
      </div>
    );
  }

  const busy = loading || submitting || isPending;

  return (
    <div className="space-y-4">
      <div ref={hostRef} className="cam-form-host min-h-[140px]" />
      <div className="flex justify-end gap-2">
        <Button onClick={complete} disabled={busy}>
          {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Complete with form
        </Button>
      </div>
    </div>
  );
}

function inferType(v: unknown): string {
  if (typeof v === "boolean") return "Boolean";
  if (typeof v === "number") return Number.isInteger(v) ? "Long" : "Double";
  if (v instanceof Date) return "Date";
  if (v === null || v === undefined) return "Null";
  if (typeof v === "object") return "Json";
  return "String";
}
