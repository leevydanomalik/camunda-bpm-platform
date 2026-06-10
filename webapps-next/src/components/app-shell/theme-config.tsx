"use client";

import { Check, Palette } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { THEME_PRESETS, useThemePreset } from "./theme-preset-store";

export function ThemeConfig() {
  const { preset, setPreset } = useThemePreset();
  const active = THEME_PRESETS.find((p) => p.id === preset) ?? THEME_PRESETS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Theme color">
          <Palette className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-muted-foreground text-[10px] tracking-wider uppercase">
          Accent color
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_PRESETS.map((p) => {
          const isActive = p.id === active.id;
          return (
            <DropdownMenuItem key={p.id} onClick={() => setPreset(p.id)} className="flex items-center gap-2">
              <span
                aria-hidden
                className="border-border inline-block size-4 shrink-0 rounded-full border"
                style={{ backgroundColor: p.swatch }}
              />
              <span className="flex-1">{p.label}</span>
              {isActive ? <Check className="text-muted-foreground size-3.5" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
