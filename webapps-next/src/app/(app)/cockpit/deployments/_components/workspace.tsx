"use client";

import type { ReactNode } from "react";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export function DeploymentsWorkspace({
  listSlot,
  resourcesSlot,
  detailSlot,
}: {
  listSlot: ReactNode;
  resourcesSlot: ReactNode;
  detailSlot: ReactNode;
}) {
  return (
    <ResizablePanelGroup
      direction="horizontal"
      autoSaveId="deployments-workspace-v1"
      className="bg-card h-full overflow-hidden rounded-lg border shadow-sm"
    >
      <ResizablePanel defaultSize={22} minSize={16} maxSize={32} className="bg-muted/30">
        {listSlot}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={28} minSize={20} className="bg-card">
        {resourcesSlot}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={50} minSize={30} className="bg-card">
        {detailSlot}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
