"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Check, Loader2, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "assigned-to-me" | "unassigned" | "assigned-to-other";

export function TaskActions({
  taskId,
  assignee,
  username,
  hasForm,
  redirectOnComplete,
}: {
  taskId: string;
  assignee: string | null;
  username: string;
  /** When true, the page renders a form which owns its own "Complete" button — hide it here. */
  hasForm: boolean;
  redirectOnComplete?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "claim" | "unclaim" | "complete" | "reassign">(null);
  const [reassignTo, setReassignTo] = useState("");
  const [isPending, startTransition] = useTransition();

  const mode: Mode = assignee === username ? "assigned-to-me" : assignee == null ? "unassigned" : "assigned-to-other";

  async function basic(action: "claim" | "unclaim" | "complete") {
    setBusy(action);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "complete" ? JSON.stringify({ variables: {} }) : undefined,
      });
      if (!res.ok) {
        toast.error((await res.json().catch(() => ({}))).error ?? `${action} failed`);
        return;
      }
      toast.success(action === "claim" ? "Claimed" : action === "unclaim" ? "Unclaimed" : "Completed");
      if (action === "complete" && redirectOnComplete) {
        startTransition(() => router.push(redirectOnComplete));
      } else {
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(null);
    }
  }

  async function reassign() {
    const userId = reassignTo.trim();
    if (!userId) return;
    setBusy("reassign");
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/assignee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        toast.error((await res.json().catch(() => ({}))).error ?? "Reassign failed");
        return;
      }
      toast.success(`Reassigned to ${userId}`);
      setReassignTo("");
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  const loading = busy !== null || isPending;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {mode === "unassigned" ? (
        <Button variant="outline" size="sm" disabled={loading} onClick={() => basic("claim")}>
          {busy === "claim" ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
          <span className="ml-1">Claim</span>
        </Button>
      ) : mode === "assigned-to-me" ? (
        <>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => basic("unclaim")}>
            {busy === "unclaim" ? <Loader2 className="size-3.5 animate-spin" /> : <UserMinus className="size-3.5" />}
            <span className="ml-1">Unclaim</span>
          </Button>
          {hasForm ? null : (
            <Button size="sm" disabled={loading} onClick={() => basic("complete")}>
              {busy === "complete" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              <span className="ml-1">Complete</span>
            </Button>
          )}
        </>
      ) : (
        <span className="text-muted-foreground text-sm">Assigned to {assignee}</span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Input
          placeholder="userId…"
          value={reassignTo}
          onChange={(e) => setReassignTo(e.target.value)}
          className="h-8 w-32 text-xs"
          disabled={loading}
        />
        <Button variant="ghost" size="sm" disabled={loading || !reassignTo.trim()} onClick={reassign}>
          {busy === "reassign" ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Reassign
        </Button>
      </div>
    </div>
  );
}
