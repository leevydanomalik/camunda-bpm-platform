import { NextResponse } from "next/server";

import type { ActivityItem, ActivityResponse } from "@/app/(app)/cockpit/_components/activity-types";
import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

type ProcessDefinitionDto = {
  id: string;
  key: string;
  name: string | null;
  version: number;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const dtos = await engineGet<ProcessDefinitionDto[]>(
      "/process-definition?latestVersion=true&sortBy=name&sortOrder=asc&maxResults=10",
    );
    const items: ActivityItem[] = dtos.map((d) => ({
      id: d.id,
      title: d.name ?? d.key,
      subtitle: `v${d.version} · ${d.key}`,
      href: `/cockpit/processes/${encodeURIComponent(d.key)}`,
    }));
    const body: ActivityResponse = { items };
    return NextResponse.json(body);
  } catch {
    const body: ActivityResponse = { items: [] };
    return NextResponse.json(body);
  }
}
