"use client";

import dynamic from "next/dynamic";

import type { DmnViewerProps } from "./dmn-viewer-internal";

// dmn-js (specifically dmn-js-drd / DrdRenderer) statically imports `ids`,
// which has a CJS/ESM mismatch that breaks under Turbopack SSR. Loading the
// real viewer client-only sidesteps the bundler entirely — the diagram is
// pure browser DOM anyway, nothing to render on the server.
const DmnViewerInternal = dynamic(
  () => import("./dmn-viewer-internal").then((m) => m.DmnViewer),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted/10 text-muted-foreground flex items-center justify-center rounded-md border p-4 text-sm" style={{ minHeight: 480 }}>
        Loading decision…
      </div>
    ),
  },
);

export function DmnViewer(props: DmnViewerProps) {
  return <DmnViewerInternal {...props} />;
}
