"use client";

/**
 * Re-exports NativeSelect as a drop-in replacement for Radix UI Select.
 *
 * Radix UI's Select stores React elements inside a JavaScript Set
 * (nativeOptionsSet state), which React 19 dev-mode flags as a serialization
 * error and displays as a blocking overlay. NativeSelect renders a plain
 * <select> element — no Sets, no overlay — with the same compound API.
 *
 * All import paths stay the same; this file is the only change needed.
 */

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from "@/components/ui/native-select";

/** Radix-specific scroll buttons — no-ops in the native implementation. */
export function SelectScrollUpButton() {
  return null;
}
SelectScrollUpButton.displayName = "SelectScrollUpButton";

export function SelectScrollDownButton() {
  return null;
}
SelectScrollDownButton.displayName = "SelectScrollDownButton";
