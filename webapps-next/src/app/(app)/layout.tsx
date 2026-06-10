import type { ReactNode } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { HeaderBell } from "@/components/app-shell/header-bell";
import { HeaderUserMenu } from "@/components/app-shell/header-user-menu";
import { PreferencesPopover } from "@/components/app-shell/preferences-popover";
import {
  SIDEBAR_COLLAPSE_COOKIE,
  SIDEBAR_STYLE_COOKIE,
  type SidebarCollapse,
  type SidebarStyle,
} from "@/components/app-shell/preferences-store";
import { SidebarWithPrefs } from "@/components/app-shell/sidebar-with-prefs";
import { ThemeSwitcher } from "@/components/app-shell/theme-switcher";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getSession } from "@/lib/auth/session";

const SIDEBAR_STYLES: SidebarStyle[] = ["inset", "sidebar", "floating"];
const SIDEBAR_COLLAPSES: SidebarCollapse[] = ["icon", "offcanvas"];

function pickStyle(v: string | undefined): SidebarStyle {
  return SIDEBAR_STYLES.includes(v as SidebarStyle) ? (v as SidebarStyle) : "inset";
}
function pickCollapse(v: string | undefined): SidebarCollapse {
  return SIDEBAR_COLLAPSES.includes(v as SidebarCollapse) ? (v as SidebarCollapse) : "icon";
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    // Belt-and-braces: proxy.ts also enforces this.
    redirect("/login");
  }

  // SSR-resolved sidebar prefs — read the cookies the client mirrors on every
  // change so the first paint already shows the user's chosen variant.
  const cookieStore = await cookies();
  const initialStyle = pickStyle(cookieStore.get(SIDEBAR_STYLE_COOKIE)?.value);
  const initialCollapse = pickCollapse(cookieStore.get(SIDEBAR_COLLAPSE_COOKIE)?.value);

  return (
    <SidebarProvider defaultOpen>
      <SidebarWithPrefs username={session.username} initialStyle={initialStyle} initialCollapse={initialCollapse} />
      <SidebarInset>
        <header className="app-layout-header bg-background flex h-12 shrink-0 items-center gap-2 border-b">
          <div className="flex w-full items-center gap-2 px-4 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 h-4" />
            <div className="ml-auto flex items-center gap-1">
              <HeaderBell count={0} />
              <PreferencesPopover />
              <ThemeSwitcher />
              <Separator orientation="vertical" className="mx-1 h-5" />
              <HeaderUserMenu username={session.username} />
            </div>
          </div>
        </header>
        <div className="app-layout-content h-full w-full p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
