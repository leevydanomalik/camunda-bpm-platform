import Link from "next/link";

import { ClipboardList, Users, Workflow } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

async function safeCount(path: string): Promise<number | null> {
  try {
    return (await engineGet<{ count: number }>(path)).count;
  } catch {
    return null;
  }
}

export default async function WelcomePage() {
  const session = await getSession();
  // Layout already enforces session; this is defensive for type narrowing.
  const username = session?.username ?? "guest";

  const [yourTasks, allTasks] = await Promise.all([
    safeCount(`/task/count?assignee=${encodeURIComponent(username)}`),
    safeCount("/task/count"),
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {username}</h1>
        <p className="text-muted-foreground text-sm">Camunda Platform</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard title="Your open tasks" value={yourTasks} description="Assigned to you" />
        <StatCard title="All open tasks" value={allTasks} description="Across the engine" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AppCard href="/cockpit" title="Cockpit" description="Process & decision administration" icon={Workflow} />
        <AppCard href="/tasklist" title="Tasklist" description="User task inbox" icon={ClipboardList} />
        <AppCard href="/admin" title="Admin" description="Users, groups, authorizations" icon={Users} />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number | null;
  description: string;
}) {
  const display = value === null ? "—" : new Intl.NumberFormat().format(value);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{display}</div>
        <p className="text-muted-foreground text-xs">
          {value === null ? "Engine unreachable" : description}
        </p>
      </CardContent>
    </Card>
  );
}

function AppCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: typeof Workflow;
}) {
  return (
    <Link href={href} className="group">
      <Card className="hover:border-primary/40 transition-colors">
        <CardHeader>
          <div className="bg-muted text-foreground mb-2 flex aspect-square size-10 items-center justify-center rounded-md">
            <Icon className="size-5" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
