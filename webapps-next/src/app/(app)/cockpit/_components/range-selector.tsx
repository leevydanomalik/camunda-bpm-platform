"use client";

import { useCallback } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { RANGE_KEYS, type RangeKey } from "./range";

const LABEL: Record<RangeKey, string> = {
  "7d": "7D",
  "30d": "30D",
  "90d": "90D",
  custom: "Custom",
};

export function RangeSelector({ value }: { value: RangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = useCallback(
    (next: string) => {
      if (!next || next === value) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("range", next);
      if (next !== "custom") {
        params.delete("from");
        params.delete("to");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, value],
  );

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={onChange}
      variant="outline"
      size="sm"
      className="bg-card rounded-full p-0.5"
      aria-label="Time range"
    >
      {RANGE_KEYS.map((key) => (
        <ToggleGroupItem
          key={key}
          value={key}
          aria-label={`Last ${LABEL[key].toLowerCase()}`}
          className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-full border-0 px-3 text-xs font-medium"
        >
          {LABEL[key]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
