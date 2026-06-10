import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  FileBox,
  Home,
  Inbox,
  Layers,
  LayoutDashboard,
  PackageCheck,
  PackageOpen,
  ShieldCheck,
  Store,
  TableProperties,
  Users,
  Workflow,
} from "lucide-react";

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    label: "Welcome",
    items: [{ title: "Home", url: "/welcome", icon: Home }],
  },
  {
    label: "Cockpit",
    items: [
      { title: "Dashboard", url: "/cockpit", icon: LayoutDashboard },
      { title: "Processes", url: "/cockpit/processes", icon: Workflow },
      { title: "Decisions", url: "/cockpit/decisions", icon: TableProperties },
      { title: "Tasks", url: "/cockpit/tasks", icon: ClipboardList },
      { title: "Batches", url: "/cockpit/batches", icon: Layers },
      { title: "Deployments", url: "/cockpit/deployments", icon: PackageOpen },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Users", url: "/admin/users", icon: Users },
      { title: "Groups", url: "/admin/groups", icon: ShieldCheck },
      { title: "Authorizations", url: "/admin/authorizations", icon: FileBox },
    ],
  },
  {
    label: "Tasklist",
    items: [{ title: "Inbox", url: "/tasklist", icon: Inbox }],
  },
  {
    label: "Plugin",
    items: [
      { title: "Marketplace", url: "/plugins/marketplace", icon: Store },
      { title: "Installed", url: "/plugins/installed", icon: PackageCheck },
    ],
  },
];
