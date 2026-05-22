import { NextResponse } from "next/server";

import type { ActivityItem, ActivityResponse } from "@/app/(app)/cockpit/_components/activity-types";
import { getSession } from "@/lib/auth/session";
import { engineGet } from "@/lib/camunda/engine";

type DeploymentDto = {
  id: string;
  name: string | null;
  source: string | null;
  deploymentTime: string;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const dtos = await engineGet<DeploymentDto[]>("/deployment?sortBy=deploymentTime&sortOrder=desc&maxResults=10");
    const items: ActivityItem[] = dtos.map((d) => ({
      id: d.id,
      title: d.name ?? d.id,
      subtitle: d.source ?? undefined,
      timestamp: d.deploymentTime,
      href: "/cockpit/deployments",
    }));
    const body: ActivityResponse = { items };
    return NextResponse.json(body);
  } catch {
    const body: ActivityResponse = { items: [] };
    return NextResponse.json(body);
  }
}
