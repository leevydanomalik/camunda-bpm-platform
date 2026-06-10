"use client";

import { useState } from "react";

import Link from "next/link";

import { Flame, Play, Square } from "lucide-react";

import { type ActivityBadge, BpmnViewer } from "@/components/bpmn-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePluginInstalled } from "@/lib/plugins/install-state";
import { HEATMAP_PLUGIN_ID, TOKEN_SIMULATION_PLUGIN_ID } from "@/lib/plugins/manifests";

import { ProcessAiDialog } from "../../_components/process-ai-dialog";

// Diagram card for the process-definition page. The heatmap toggle lives in
// the header row (next to Ask AI) and only exists when the Heatmap Pro plugin
// is installed — without it the diagram renders plain, no toggle, no overlay.
export function DiagramCard({
  xml,
  badges,
  heatmap,
  heatMode,
  processKey,
  processName,
}: {
  xml: string;
  badges: ActivityBadge[];
  heatmap?: Record<string, number>;
  heatMode: "runtime" | "history";
  processKey: string;
  processName: string;
}) {
  const heatmapPlugin = usePluginInstalled(HEATMAP_PLUGIN_ID, false);
  const tokenSimPlugin = usePluginInstalled(TOKEN_SIMULATION_PLUGIN_ID, false);
  const [heatVisible, setHeatVisible] = useState(true);
  const [simOn, setSimOn] = useState(false);
  const heat = heatmapPlugin ? heatmap : undefined;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Diagram</CardTitle>
            <CardDescription>
              Instance counts bottom-left · incident counts top-right
              {heat
                ? ` · heatmap weighted by ${heatMode === "history" ? "all-time" : "currently running"} activity instances.`
                : "."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {tokenSimPlugin ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setSimOn((v) => !v)}
                aria-pressed={simOn}
              >
                {simOn ? (
                  <Square className="size-3.5 text-emerald-500" />
                ) : (
                  <Play className="text-muted-foreground size-3.5" />
                )}
                {simOn ? "Stop simulation" : "Simulate"}
              </Button>
            ) : null}
            {heat ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setHeatVisible((v) => !v)}
                aria-pressed={heatVisible}
              >
                <Flame className={`size-3.5 ${heatVisible ? "text-orange-500" : "text-muted-foreground"}`} />
                {heatVisible ? "Heatmap on" : "Heatmap off"}
              </Button>
            ) : null}
            <ProcessAiDialog processKey={processKey} processName={processName} />
            <div className="bg-muted text-muted-foreground inline-flex items-center rounded-md p-0.5 text-xs">
              <Link
                href={`/cockpit/processes/${encodeURIComponent(processKey)}`}
                className={`rounded-sm px-2.5 py-1 ${heatMode === "runtime" ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"}`}
              >
                Runtime
              </Link>
              <Link
                href={`/cockpit/processes/${encodeURIComponent(processKey)}?heat=history`}
                className={`rounded-sm px-2.5 py-1 ${heatMode === "history" ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"}`}
              >
                All-time
              </Link>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Heat hides while simulating — tokens deserve a clean canvas. */}
        <BpmnViewer
          xml={xml}
          height={460}
          badges={badges}
          heatmap={heat}
          heatmapVisible={heatVisible && !simOn}
          tokenSimulation
          tokenSimulationOn={simOn}
        />
      </CardContent>
    </Card>
  );
}
