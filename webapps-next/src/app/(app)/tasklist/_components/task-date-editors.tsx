"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Bell, CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function relativeDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diffMs = d.getTime() - Date.now();
  const future = diffMs > 0;
  const absDays = Math.abs(diffMs) / (1000 * 60 * 60 * 24);
  if (absDays < 1) {
    const hours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));
    return future ? `in ${hours}h` : `${hours}h ago`;
  }
  const days = Math.round(absDays);
  return future ? `in ${days} day${days === 1 ? "" : "s"}` : `${days} day${days === 1 ? "" : "s"} ago`;
}

/** ISO (with offset) → value for <input type="datetime-local"> in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DateEditor({
  taskId,
  field,
  value,
  icon,
  emptyLabel,
  setLabel,
}: {
  taskId: string;
  field: "due" | "followUp";
  value: string | null;
  icon: React.ReactNode;
  emptyLabel: string;
  setLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(toLocalInput(value));
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function save(next: string | null) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });
      if (!res.ok) {
        toast.error((await res.json().catch(() => ({}))).error ?? "Update failed");
        return;
      }
      toast.success(next ? `${setLabel} updated` : `${setLabel} cleared`);
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="hover:text-foreground inline-flex items-center gap-1.5">
          {icon}
          <span>
            {value ? (
              <span className="text-foreground/80">
                {field === "due" ? "Due" : "Follow-up"} {relativeDate(value)}
              </span>
            ) : (
              <span className="text-muted-foreground/80">{emptyLabel}</span>
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2">
        <label className="text-foreground/80 text-xs font-medium">{setLabel}</label>
        <Input type="datetime-local" value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 text-xs" />
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || !value}
            onClick={() => save(null)}
            className="text-muted-foreground"
          >
            Clear
          </Button>
          <Button
            size="sm"
            disabled={busy || !draft}
            onClick={() => save(draft ? new Date(draft).toISOString() : null)}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            <span className="ml-1">Save</span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The editable follow-up and due date controls in the task header. */
export function TaskDateEditors({
  taskId,
  due,
  followUp,
}: {
  taskId: string;
  due: string | null;
  followUp: string | null;
}) {
  return (
    <>
      <li className="inline-flex items-center gap-1.5">
        <DateEditor
          taskId={taskId}
          field="followUp"
          value={followUp}
          icon={<CalendarPlus className="size-3.5" />}
          emptyLabel="Set follow-up date"
          setLabel="Follow-up date"
        />
      </li>
      <li className="inline-flex items-center gap-1.5">
        <DateEditor
          taskId={taskId}
          field="due"
          value={due}
          icon={<Bell className="size-3.5" />}
          emptyLabel="Set due date"
          setLabel="Due date"
        />
      </li>
    </>
  );
}
