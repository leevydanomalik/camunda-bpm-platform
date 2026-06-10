"use client";

import dynamic from "next/dynamic";

import type { BpmnViewerProps } from "@/components/bpmn-viewer";

const BpmnViewerClient = dynamic(() => import("@/components/bpmn-viewer").then((m) => m.BpmnViewer), {
  ssr: false,
  loading: () => (
    <div
      className="bg-muted/10 text-muted-foreground flex items-center justify-center rounded-md border p-4 text-sm"
      style={{ minHeight: 360 }}
    >
      Loading diagram…
    </div>
  ),
});

export type TaskDiagramProps = {
  xml: string;
  /** The task's `taskDefinitionKey` — the BPMN element id of the user task. */
  activityId: string | null;
  height?: number | string;
};

export function TaskDiagram({ xml, activityId, height = 360 }: TaskDiagramProps) {
  const props: BpmnViewerProps = {
    xml,
    height,
    activityIds: activityId ? [activityId] : undefined,
  };
  return (
    <div className="bpmn-viewer-wrapper">
      <BpmnViewerClient {...props} />
    </div>
  );
}
