"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export type Comment = {
  id: string;
  userId: string | null;
  time: string;
  message: string;
};

export function TaskComments({ taskId, comments }: { taskId: string; comments: Comment[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const message = draft.trim();
    if (!message) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({}))).error ?? "Failed to add comment";
        toast.error(msg);
        return;
      }
      setDraft("");
      toast.success("Comment added");
      startTransition(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="text-muted-foreground size-4" />
          <CardTitle>Comments</CardTitle>
        </div>
        <CardDescription>Engine-stored comments scoped to this task.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No comments yet.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="space-y-1 border-l-2 pl-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{c.userId ?? "(unknown)"}</span>
                  <span className="text-muted-foreground">{formatDate(c.time)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.message}</p>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={submit} className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment…"
            rows={3}
            disabled={busy}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
              {submitting ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
              Post
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
