export type ActivityTab = "recent" | "incidents" | "deployments" | "jobs" | "definitions";

export type ActivityItem = {
  id: string;
  title: string;
  subtitle?: string;
  timestamp?: string; // ISO
  tone?: "default" | "warning";
  href?: string;
};

export type ActivityResponse = { items: ActivityItem[] };
