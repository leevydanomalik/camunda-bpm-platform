import type { RangeKey } from "./range";
import { RangeSelector } from "./range-selector";

export function DashboardHeader({ username, range }: { username: string; range: RangeKey }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {username}</h1>
        <p className="text-muted-foreground text-sm">Cockpit dashboard</p>
      </div>
      <RangeSelector value={range} />
    </header>
  );
}
