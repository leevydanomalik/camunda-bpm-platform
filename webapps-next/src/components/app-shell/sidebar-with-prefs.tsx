"use client";

import { useEffect, useState } from "react";

import { AppSidebar } from "./app-sidebar";
import { type SidebarCollapse, type SidebarStyle, usePreferences } from "./preferences-store";

/**
 * Reads sidebar prefs and forwards them as props to AppSidebar.
 *
 * Initial values come from cookies the server resolved in (app)/layout.tsx, so
 * the first paint already renders the user's chosen variant — no hydration
 * flicker. After mount, the localStorage-driven `usePreferences` hook takes
 * over and reflects any subsequent toggles.
 */
export function SidebarWithPrefs({
  username,
  initialStyle,
  initialCollapse,
}: {
  username: string;
  initialStyle: SidebarStyle;
  initialCollapse: SidebarCollapse;
}) {
  const { prefs } = usePreferences();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const variant = hydrated ? prefs.sidebarStyle : initialStyle;
  const collapsible = hydrated ? prefs.sidebarCollapse : initialCollapse;

  return <AppSidebar username={username} variant={variant} collapsible={collapsible} />;
}
