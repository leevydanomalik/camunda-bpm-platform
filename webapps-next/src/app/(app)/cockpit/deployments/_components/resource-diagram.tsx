"use client";

import dynamic from "next/dynamic";

const BpmnViewerClient = dynamic(() => import("@/components/bpmn-viewer").then((m) => m.BpmnViewer), {
  ssr: false,
  loading: () => (
    <div
      className="bg-muted/10 text-muted-foreground flex items-center justify-center rounded-md border p-4 text-sm"
      style={{ minHeight: 420 }}
    >
      Loading BPMN…
    </div>
  ),
});

const DmnViewerClient = dynamic(() => import("@/components/dmn-viewer").then((m) => m.DmnViewer), {
  ssr: false,
  loading: () => (
    <div
      className="bg-muted/10 text-muted-foreground flex items-center justify-center rounded-md border p-4 text-sm"
      style={{ minHeight: 480 }}
    >
      Loading decision…
    </div>
  ),
});

export function ResourceBpmn({ xml, height = 480 }: { xml: string; height?: number | string }) {
  return (
    <div className="bpmn-viewer-wrapper">
      <BpmnViewerClient xml={xml} height={height} />
    </div>
  );
}

export function ResourceDmn({ xml, height = 520 }: { xml: string; height?: number | string }) {
  return <DmnViewerClient xml={xml} height={height} />;
}
