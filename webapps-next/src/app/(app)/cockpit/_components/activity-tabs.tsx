"use client";

import { useState } from "react";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import type { ActivityItem, ActivityResponse, ActivityTab } from "./activity-types";

const TABS: { value: ActivityTab; label: string }[] = [
  { value: "recent", label: "Activity" },
  { value: "incidents", label: "Incidents" },
  { value: "deployments", label: "Deployments" },
  { value: "jobs", label: "Jobs" },
  { value: "definitions", label: "Definitions" },
];

async function fetchActivity(tab: ActivityTab): Promise<ActivityResponse> {
  const res = await fetch(`/api/cockpit/activity/${tab}`, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as ActivityResponse;
}

export function ActivityTabs() {
  const [active, setActive] = useState<ActivityTab>("recent");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={active} onValueChange={(v) => setActive(v as ActivityTab)}>
          <TabsList className="bg-transparent p-0">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-full text-xs"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((t) => (
            <TabsContent key={t.value} value={t.value} className="mt-4">
              <ActivityList tab={t.value} active={active === t.value} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ActivityList({ tab, active }: { tab: ActivityTab; active: boolean }) {
  const query = useQuery({
    queryKey: ["cockpit-activity", tab],
    queryFn: () => fetchActivity(tab),
    enabled: active,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="text-muted-foreground bg-muted/30 flex items-center gap-2 rounded p-3 text-xs">
        <AlertTriangle className="size-4" />
        Couldn't load activity. Switch tabs to retry.
      </div>
    );
  }

  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="text-muted-foreground bg-muted/30 flex items-center justify-center rounded p-6 text-xs">
        Nothing to show here yet.
      </div>
    );
  }

  return (
    <ul className="divide-border divide-y">
      {items.map((item) => (
        <li key={item.id}>
          <ActivityRow item={item} />
        </li>
      ))}
    </ul>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const inner = (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-sm font-medium", item.tone === "warning" && "text-destructive")}>
          {item.title}
        </div>
        {item.subtitle ? <div className="text-muted-foreground truncate text-xs">{item.subtitle}</div> : null}
      </div>
      {item.timestamp ? (
        <div className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs">
          <Clock className="size-3" />
          {new Date(item.timestamp).toLocaleString()}
        </div>
      ) : null}
    </div>
  );

  return item.href ? (
    <Link href={item.href} className="hover:bg-accent/40 -mx-2 block rounded px-2 transition-colors">
      {inner}
    </Link>
  ) : (
    <div className="-mx-2 px-2">{inner}</div>
  );
}
