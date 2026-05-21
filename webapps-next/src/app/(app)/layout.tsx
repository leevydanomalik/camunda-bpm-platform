import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getSession } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    // Belt-and-braces: proxy.ts also enforces this.
    redirect("/login");
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar username={session.username} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b">
          <div className="flex w-full items-center gap-2 px-4 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 h-4" />
          </div>
        </header>
        <div className="h-full p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
