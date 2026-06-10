"use client";

import { Settings } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import {
  APP_FONTS,
  NAVBAR_BEHAVIORS,
  PAGE_LAYOUTS,
  SIDEBAR_COLLAPSES,
  SIDEBAR_STYLES,
  THEME_PRESETS,
  usePreferences,
} from "./preferences-store";

export function PreferencesPopover() {
  const { prefs, set, reset } = usePreferences();
  const { theme, setTheme } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Preferences">
          <Settings className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="space-y-1 border-b px-4 py-3">
          <h3 className="text-sm font-semibold tracking-tight">Preferences</h3>
          <p className="text-muted-foreground text-xs">
            Customize your dashboard layout. Settings persist in your browser.
          </p>
        </div>

        <div className="max-h-[28rem] space-y-4 overflow-y-auto px-4 py-4">
          <Field label="Theme preset">
            <Select value={prefs.themePreset} onValueChange={(v) => set("themePreset", v as typeof prefs.themePreset)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEME_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden
                        className="border-border inline-block size-3 shrink-0 rounded-full border"
                        style={{ backgroundColor: p.swatch }}
                      />
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Font">
            <Select value={prefs.font} onValueChange={(v) => set("font", v as typeof prefs.font)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APP_FONTS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Theme mode">
            <Segmented
              value={theme === "system" ? "system" : theme === "dark" ? "dark" : "light"}
              options={[
                { id: "light", label: "Light" },
                { id: "dark", label: "Dark" },
                { id: "system", label: "System" },
              ]}
              onSelect={(v) => setTheme(v)}
            />
          </Field>

          <Field label="Page layout">
            <Segmented
              value={prefs.pageLayout}
              options={PAGE_LAYOUTS}
              onSelect={(v) => set("pageLayout", v as typeof prefs.pageLayout)}
            />
          </Field>

          <Field label="Navbar behavior">
            <Segmented
              value={prefs.navbarBehavior}
              options={NAVBAR_BEHAVIORS}
              onSelect={(v) => set("navbarBehavior", v as typeof prefs.navbarBehavior)}
            />
          </Field>

          <Field label="Sidebar style">
            <Segmented
              value={prefs.sidebarStyle}
              options={SIDEBAR_STYLES}
              onSelect={(v) => set("sidebarStyle", v as typeof prefs.sidebarStyle)}
            />
          </Field>

          <Field label="Sidebar collapse">
            <Segmented
              value={prefs.sidebarCollapse}
              options={SIDEBAR_COLLAPSES}
              onSelect={(v) => set("sidebarCollapse", v as typeof prefs.sidebarCollapse)}
            />
          </Field>
        </div>

        <Separator />
        <div className="px-4 py-3">
          <Button variant="outline" size="sm" onClick={reset} className="w-full">
            Restore defaults
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onSelect,
}: {
  value: T;
  options: { id: T; label: string }[];
  onSelect: (v: T) => void;
}) {
  return (
    <div className="bg-muted text-muted-foreground inline-flex w-full items-center rounded-md p-0.5 text-xs">
      {options.map((o) => {
        const isActive = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id)}
            className={cn(
              "flex-1 rounded-sm px-2 py-1.5 text-center capitalize transition-colors",
              isActive ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
