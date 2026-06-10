"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { File, FileCode, FileText, GitBranch, Inbox, MousePointerClick, Table2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type ResourceRow = {
  id: string;
  /** Engine field — full path inside deployment, e.g. "processes/invoice.bpmn". */
  name: string;
  deploymentId: string;
};

function splitPath(name: string): { dir: string; file: string } {
  const idx = name.lastIndexOf("/");
  if (idx < 0) return { dir: "", file: name };
  return { dir: name.slice(0, idx + 1), file: name.slice(idx + 1) };
}

function kindOf(filename: string): "bpmn" | "dmn" | "cmmn" | "form" | "code" {
  const f = filename.toLowerCase();
  if (f.endsWith(".bpmn") || f.endsWith(".bpmn20.xml")) return "bpmn";
  if (f.endsWith(".dmn") || f.endsWith(".dmn11.xml") || f.endsWith(".dmn1.xml")) return "dmn";
  if (f.endsWith(".cmmn") || f.endsWith(".cmmn11.xml") || f.endsWith(".cmmn10.xml")) return "cmmn";
  if (f.endsWith(".form")) return "form";
  return "code";
}

function iconFor(kind: ReturnType<typeof kindOf>) {
  switch (kind) {
    case "bpmn":
      return GitBranch;
    case "dmn":
      return Table2;
    case "cmmn":
      return GitBranch;
    case "form":
      return FileText;
    default:
      return FileCode;
  }
}

export function ResourceList({
  deploymentId,
  resources,
  selectedResourceId,
  error,
}: {
  deploymentId: string | null;
  resources: ResourceRow[] | null;
  selectedResourceId: string | null;
  error: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selectResource(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("resourceId", id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (!deploymentId) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
          <MousePointerClick className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="text-foreground text-sm font-medium">Select a deployment</p>
          <p className="text-xs">Pick one from the left rail to see its resources.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="space-y-1 border-b px-4 py-2.5">
        <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Resources</div>
        <div className="text-sm font-medium">
          {resources !== null ? `${resources.length} file${resources.length === 1 ? "" : "s"}` : "Loading…"}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="text-muted-foreground p-8 text-center text-sm">Failed to load resources: {error}</div>
        ) : resources === null ? (
          <div className="text-muted-foreground p-8 text-center text-sm">Loading resources…</div>
        ) : resources.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
              <Inbox className="size-5" />
            </div>
            <p className="text-sm font-medium">No resources</p>
          </div>
        ) : (
          <ol className="divide-y">
            {resources.map((r) => {
              const isActive = selectedResourceId === r.id;
              const { dir, file } = splitPath(r.name);
              const kind = kindOf(file);
              const Icon = iconFor(kind);
              return (
                <li key={r.id} className="relative">
                  {isActive ? <span className="bg-primary absolute inset-y-0 left-0 w-1" /> : null}
                  <button
                    type="button"
                    onClick={() => selectResource(r.id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                      isActive ? "bg-accent/60" : "hover:bg-accent/30",
                    )}
                  >
                    <Icon
                      className={cn("mt-0.5 size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
                    />
                    <div className="min-w-0 flex-1">
                      {dir ? <div className="text-muted-foreground truncate font-mono text-[10px]">{dir}</div> : null}
                      <div
                        className={cn(
                          "truncate text-sm leading-snug font-medium",
                          isActive ? "text-primary" : "text-foreground",
                        )}
                        title={file}
                      >
                        {file}
                      </div>
                      <div className="text-muted-foreground mt-0.5 text-[10px] tracking-wider uppercase">{kind}</div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
