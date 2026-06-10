"use client";

import type { ReactNode } from "react";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export function TasklistWorkspace({
  filterSlot,
  listSlot,
  detailSlot,
}: {
  filterSlot: ReactNode;
  listSlot: ReactNode;
  detailSlot: ReactNode;
}) {
  return (
    <ResizablePanelGroup
      direction="horizontal"
      autoSaveId="tasklist-workspace-v1"
      className="bg-card h-full overflow-hidden rounded-lg border shadow-sm"
    >
      <ResizablePanel defaultSize={18} minSize={14} maxSize={28} className="bg-muted/30">
        {filterSlot}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={32} minSize={24} className="bg-card">
        {listSlot}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={50} minSize={30} className="bg-card">
        {detailSlot}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
