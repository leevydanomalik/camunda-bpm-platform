import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineGet } from "@/lib/camunda/engine";

import { InstancesTimeseriesChart, type TimeseriesPoint } from "./instances-timeseries-chart";
import { bucketize, type Range } from "./range";

type Count = { count: number };

function isoNoMs(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "");
}

async function fetchBucket(start: Date, end: Date): Promise<number> {
  try {
    const res = await engineGet<Count>(
      `/history/process-instance/count?startedAfter=${isoNoMs(start)}&startedBefore=${isoNoMs(end)}`,
    );
    return res.count;
  } catch {
    return 0;
  }
}

function bucketGranularity(range: Range): "daily" | "weekly" {
  if (range.key === "90d") return "weekly";
  if (range.key === "custom") {
    const days = Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000);
    return days > 31 ? "weekly" : "daily";
  }
  return "daily";
}

export async function InstancesTimeseriesCard({ range }: { range: Range }) {
  const buckets = bucketize(range);
  const counts = await Promise.all(buckets.map((b) => fetchBucket(b.start, b.end)));
  const data: TimeseriesPoint[] = buckets.map((b, i) => ({
    bucketStart: b.start.toISOString(),
    count: counts[i],
  }));

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Process instances started</CardTitle>
        <CardDescription className="text-xs">
          Over the selected range, bucketed {bucketGranularity(range)}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InstancesTimeseriesChart data={data} />
      </CardContent>
    </Card>
  );
}
