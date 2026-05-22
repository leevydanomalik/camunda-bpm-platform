import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";

import { type Range } from "./range";
import { type IncidentTypeRow, TopIncidentsBarChart } from "./top-incidents-bar-chart";

type HistoricIncidentDto = { incidentType: string };

function isoNoMs(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "");
}

export async function TopIncidentsBarCard({ range }: { range: Range }) {
  let incidents: HistoricIncidentDto[] = [];
  try {
    incidents = await engineGet<HistoricIncidentDto[]>(
      `/history/incident?createTimeAfter=${isoNoMs(range.from)}&createTimeBefore=${isoNoMs(range.to)}&maxResults=200`,
    );
  } catch {
    incidents = [];
  }

  const counts = new Map<string, number>();
  for (const i of incidents) {
    counts.set(i.incidentType, (counts.get(i.incidentType) ?? 0) + 1);
  }

  const data: IncidentTypeRow[] = [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Top incident types</CardTitle>
        <CardDescription className="text-xs">In the selected range.</CardDescription>
      </CardHeader>
      <CardContent>
        <TopIncidentsBarChart data={data} />
      </CardContent>
    </Card>
  );
}
