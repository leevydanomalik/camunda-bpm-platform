import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";

import { type DefinitionRow, TopDefinitionsBarChart } from "./top-definitions-bar-chart";

type ProcessDefinitionDto = {
  key: string;
  name: string | null;
};

type Count = { count: number };

async function safeCount(path: string): Promise<number> {
  try {
    const res = await engineGet<Count>(path);
    return res.count;
  } catch {
    return 0;
  }
}

export async function TopDefinitionsBarCard() {
  let defs: ProcessDefinitionDto[] = [];
  try {
    defs = await engineGet<ProcessDefinitionDto[]>(
      "/process-definition?latestVersion=true&active=true&sortBy=name&sortOrder=asc&maxResults=50",
    );
  } catch {
    defs = [];
  }

  const withCounts = await Promise.all(
    defs.map(async (d) => ({
      key: d.key,
      name: d.name ?? d.key,
      count: await safeCount(`/process-instance/count?processDefinitionKey=${encodeURIComponent(d.key)}`),
    })),
  );

  const data: DefinitionRow[] = withCounts
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Top process definitions</CardTitle>
        <CardDescription className="text-xs">By running instance count.</CardDescription>
      </CardHeader>
      <CardContent>
        <TopDefinitionsBarChart data={data} />
      </CardContent>
    </Card>
  );
}
