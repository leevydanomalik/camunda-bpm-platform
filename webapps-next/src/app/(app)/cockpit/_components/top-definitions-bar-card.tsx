import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";

import { type DefinitionRow, TopDefinitionsBarChart } from "./top-definitions-bar-chart";

type StatisticsDto = {
  id: string;
  instances: number;
  definition: {
    key: string;
    name: string | null;
  };
};

export async function TopDefinitionsBarCard() {
  let stats: StatisticsDto[] = [];
  try {
    stats = await engineGet<StatisticsDto[]>("/process-definition/statistics?failedJobs=false&incidents=false");
  } catch {
    stats = [];
  }

  const data: DefinitionRow[] = stats
    .filter((s) => s.instances > 0)
    .map((s) => ({
      key: s.definition.key,
      name: s.definition.name ?? s.definition.key,
      count: s.instances,
    }))
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
