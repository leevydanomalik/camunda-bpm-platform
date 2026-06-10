import { Clock } from "lucide-react";

export type HistoryEvent = {
  time: string;
  /** Short verb, e.g. "Created", "Claimed", "Assigned", "Updated". */
  action: string;
  /** Optional detail, e.g. a user id or variable name. */
  detail?: string | null;
};

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Task audit timeline — mirrors the legacy Tasklist "History" tab. */
export function TaskHistory({ events }: { events: HistoryEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-xs">
        There is no history for the task.
      </p>
    );
  }

  return (
    <ol className="space-y-0">
      {events.map((e, i) => (
        <li key={`${e.time}-${i}`} className="flex gap-3 py-2 not-last:border-b">
          <Clock className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-foreground/90 text-sm font-medium">{e.action}</span>
              <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">{fmt(e.time)}</span>
            </div>
            {e.detail ? <p className="text-muted-foreground mt-0.5 font-mono text-xs break-all">{e.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
