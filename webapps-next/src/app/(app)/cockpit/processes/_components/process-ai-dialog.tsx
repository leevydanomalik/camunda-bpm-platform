"use client";

import { Fragment, type ReactNode, useRef, useState } from "react";

import { Loader2, RotateCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Inline **bold** → <strong>, rest as text. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="text-foreground font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/** Tiny markdown-lite renderer: ## headings, - bullets, paragraphs, **bold**. */
function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let bullets: string[] = [];

  const flushBullets = (key: string) => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={key} className="my-1.5 ml-4 list-disc space-y-1">
        {bullets.map((b, i) => (
          <li key={i}>{inline(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^#{1,6}\s/.test(line)) {
      flushBullets(`ul-${i}`);
      blocks.push(
        <h3 key={i} className="text-foreground mt-4 mb-1 text-sm font-semibold first:mt-0">
          {inline(line.replace(/^#{1,6}\s/, ""))}
        </h3>,
      );
    } else if (/^[-*]\s/.test(line)) {
      bullets.push(line.replace(/^[-*]\s/, ""));
    } else if (line.trim() === "") {
      flushBullets(`ul-${i}`);
    } else {
      flushBullets(`ul-${i}`);
      blocks.push(
        <p key={i} className="my-1.5 leading-relaxed">
          {inline(line)}
        </p>,
      );
    }
  });
  flushBullets("ul-end");
  return <>{blocks}</>;
}

export function ProcessAiDialog({ processKey, processName }: { processKey: string; processName: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStatus("loading");
    setError(null);
    setText("");
    setReasoning("");
    try {
      const res = await fetch(`/api/processes/${encodeURIComponent(processKey)}/explain`, {
        method: "POST",
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const msg = (await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`;
        setError(msg);
        setStatus("error");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const { t, c } = JSON.parse(line) as { t: "reasoning" | "answer"; c: string };
            if (t === "answer") setText((p) => p + c);
            else setReasoning((p) => p + c);
          } catch {
            // partial line — ignore
          }
        }
      }
      setStatus("done");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to reach AI");
      setStatus("error");
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && status === "idle") run();
    if (!next) abortRef.current?.abort();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <Sparkles className="size-3.5 text-violet-500" />
          Ask AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-violet-500" />
            Process interpretation
          </DialogTitle>
          <DialogDescription>
            DeepSeek reading <span className="text-foreground/80 font-medium">{processName}</span> and its current
            runtime state.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto px-6 py-4 text-sm">
          {status === "error" ? (
            <div className="text-destructive bg-destructive/10 rounded-md border px-3 py-2 text-sm">{error}</div>
          ) : (
            <>
              {/* While the reasoning model thinks (no answer yet), show its live
                  chain-of-thought dimmed so the wait reads as progress. */}
              {text === "" ? (
                <div className="text-muted-foreground/70 space-y-2">
                  <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
                    <Loader2 className="size-3.5 animate-spin" />
                    {reasoning ? "Thinking…" : "Analyzing the diagram and runtime data…"}
                  </div>
                  {reasoning ? (
                    <p className="border-muted max-h-32 overflow-y-auto border-l-2 pl-3 text-xs leading-relaxed whitespace-pre-wrap italic">
                      {reasoning.slice(-600)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <Markdown text={text} />
                  {status === "loading" ? (
                    <span className="bg-foreground ml-0.5 inline-block h-4 w-1.5 animate-pulse" />
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-6 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={run}
            disabled={status === "loading"}
            className="text-muted-foreground"
          >
            {status === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
            <span className="ml-1.5">Regenerate</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
