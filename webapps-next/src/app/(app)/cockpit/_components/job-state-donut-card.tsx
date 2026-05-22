import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";

import { JobStateDonutChart, type JobStateSlice } from "./job-state-donut-chart";

type Count = { count: number };

async function safeCount(path: string): Promise<number> {
  try {
    const res = await engineGet<Count>(path);
    return res.count;
  } catch {
    return 0;
  }
}

export async function JobStateDonutCard() {
  const [failed, suspended, retrying, active] = await Promise.all([
    safeCount("/job/count?withException=true&noRetriesLeft=true&suspended=false"),
    safeCount("/job/count?suspended=true"),
    safeCount("/job/count?withException=true&withRetriesLeft=true&suspended=false"),
    safeCount("/job/count?withException=false&suspended=false"),
  ]);

  const data: JobStateSlice[] = [
    { state: "active", count: active },
    { state: "retrying", count: retrying },
    { state: "failed", count: failed },
    { state: "suspended", count: suspended },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Job state distribution</CardTitle>
        <CardDescription className="text-xs">Right now.</CardDescription>
      </CardHeader>
      <CardContent>
        <JobStateDonutChart data={data} />
      </CardContent>
    </Card>
  );
}
