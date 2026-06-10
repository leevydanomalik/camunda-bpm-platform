"use client";

import dynamic from "next/dynamic";

import type { TaskFormInternalProps } from "./task-form-internal";

// @bpmn-io/form-js is browser-only — load it dynamically with SSR off so
// Turbopack doesn't try to evaluate its DOM-touching modules server-side.
const TaskFormInternal = dynamic(() => import("./task-form-internal").then((m) => m.TaskFormInternal), {
  ssr: false,
  loading: () => (
    <div className="text-muted-foreground bg-muted/10 flex h-32 items-center justify-center rounded-md border text-sm">
      Loading form…
    </div>
  ),
});

export function TaskForm(props: TaskFormInternalProps) {
  return <TaskFormInternal {...props} />;
}
