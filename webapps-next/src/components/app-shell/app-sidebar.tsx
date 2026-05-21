"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Workflow } from "lucide-react";

import { UserMenu } from "@/components/app-shell/user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { navSections } from "./nav-items";

function isActive(pathname: string, url: string): boolean {
  if (url === "/cockpit" || url === "/tasklist") return pathname === url;
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function AppSidebar({ username }: { username: string }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link href="/cockpit">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md">
                  <Workflow className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Camunda</span>
                  <span className="text-muted-foreground truncate text-xs">Platform 7.24</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(pathname, item.url)} tooltip={item.title}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <UserMenu username={username} />
      </SidebarFooter>
    </Sidebar>
  );
}
