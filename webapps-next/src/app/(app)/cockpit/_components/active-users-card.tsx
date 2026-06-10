import { Users } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";

type EngineUser = { id: string; firstName: string | null; lastName: string | null };

type ActiveUser = {
  id: string;
  name: string;
  initials: string;
  openTasks: number;
};

function initials(u: EngineUser): string {
  const f = u.firstName?.[0] ?? u.id[0] ?? "?";
  const l = u.lastName?.[0] ?? "";
  return `${f}${l}`.toUpperCase();
}

async function loadActiveUsers(): Promise<ActiveUser[]> {
  let users: EngineUser[];
  try {
    users = await engineGet<EngineUser[]>("/user?maxResults=50");
  } catch {
    return [];
  }

  const withCounts = await Promise.all(
    users.map(async (u) => {
      let openTasks = 0;
      try {
        openTasks = (await engineGet<{ count: number }>(`/task/count?assignee=${encodeURIComponent(u.id)}`)).count;
      } catch {
        openTasks = 0;
      }
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.id;
      return { id: u.id, name, initials: initials(u), openTasks };
    }),
  );

  return withCounts.sort((a, b) => b.openTasks - a.openTasks);
}

// Deterministic accent per user so avatars are distinguishable but on-theme.
const AVATAR_TONES = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/15 text-chart-4",
  "bg-chart-5/15 text-chart-5",
];

export async function ActiveUsersCard() {
  const users = await loadActiveUsers();
  const max = Math.max(1, ...users.map((u) => u.openTasks));
  const totalAssigned = users.reduce((s, u) => s + u.openTasks, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="text-primary size-4" />
          Active users
        </CardTitle>
        <CardDescription>Open task load by team member · {totalAssigned} assigned.</CardDescription>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-xs">
            No users found.
          </p>
        ) : (
          <ul className="space-y-3">
            {users.map((u, i) => (
              <li key={u.id} className="flex items-center gap-3">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${AVATAR_TONES[i % AVATAR_TONES.length]}`}
                >
                  {u.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{u.name}</span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {u.openTasks} task{u.openTasks === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${Math.round((u.openTasks / max) * 100)}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
