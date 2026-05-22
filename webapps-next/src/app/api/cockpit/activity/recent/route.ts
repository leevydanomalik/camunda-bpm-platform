import { NextResponse } from "next/server";

import type { ActivityItem, ActivityResponse } from "@/app/(app)/cockpit/_components/activity-types";
import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

type HistoricInstanceDto = {
  id: string;
  processDefinitionName: string | null;
  processDefinitionKey: string;
  endTime: string | null;
  state: string;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const dtos = await engineGet<HistoricInstanceDto[]>(
      "/history/process-instance?finished=true&sortBy=endTime&sortOrder=desc&maxResults=10",
    );
    const items: ActivityItem[] = dtos.map((d) => ({
      id: d.id,
      title: d.processDefinitionName ?? d.processDefinitionKey,
      subtitle: d.state,
      timestamp: d.endTime ?? undefined,
      href: `/cockpit/processes/${encodeURIComponent(d.processDefinitionKey)}/instances/${encodeURIComponent(d.id)}`,
    }));
    const body: ActivityResponse = { items };
    return NextResponse.json(body);
  } catch {
    const body: ActivityResponse = { items: [] };
    return NextResponse.json(body);
  }
}
