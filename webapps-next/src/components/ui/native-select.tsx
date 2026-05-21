"use client";

/**
 * NativeSelect — drop-in replacement for Radix UI Select.
 *
 * Same compound-component API:
 *   <Select value={v} onValueChange={setV}>
 *     <SelectTrigger id="..." className="...">
 *       <SelectValue placeholder="..." />
 *     </SelectTrigger>
 *     <SelectContent>
 *       <SelectItem value="a">Label A</SelectItem>
 *       <SelectItem value="b">Label B</SelectItem>
 *     </SelectContent>
 *   </Select>
 *
 * Why: Radix UI's Select stores React elements inside a JavaScript Set
 * (nativeOptionsSet state), which React 19 dev-mode flags as a serialization
 * error and shows as a blocking error overlay. This implementation renders a
 * plain <select> element — no Sets, no overlay.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

// ─── Internal helpers ──────────────────────────────────────────────────────────

/** Recursively extract text from a React node (for option labels). */
function textContent(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (React.isValidElement(node)) return textContent((node.props as any).children);
  return "";
}

/** Flatten React children through fragments and arrays into a flat element list. */
function flattenChildren(children: React.ReactNode): React.ReactElement[] {
  const result: React.ReactElement[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      result.push(...flattenChildren((child.props as any).children));
    } else {
      result.push(child);
    }
  });
  return result;
}

// ─── Compound sub-components (data carriers — render nothing themselves) ───────

/** Mirrors SelectTrigger: accepts id, className, children (SelectValue). */
export function SelectTrigger({
  children: _children,
  className: _className,
  id: _id,
  ...rest
}: React.HTMLAttributes<HTMLElement> & { id?: string }) {
  // Intentionally renders nothing — data extracted by parent <Select>.
  return null;
}
SelectTrigger.displayName = "SelectTrigger";

/** Mirrors SelectValue: declares the placeholder. */
export function SelectValue({ placeholder: _p }: { placeholder?: string }) {
  return null;
}
SelectValue.displayName = "SelectValue";

/** Mirrors SelectContent: wraps SelectItem children. */
export function SelectContent({ children: _children }: { children?: React.ReactNode }) {
  return null;
}
SelectContent.displayName = "SelectContent";

/** Mirrors SelectItem: represents one <option>. */
export function SelectItem({
  value: _value,
  children: _children,
  disabled: _disabled,
  className: _className,
}: {
  value: string;
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return null;
}
SelectItem.displayName = "SelectItem";

/** Mirrors SelectGroup: groups options (rendered as <optgroup> if label supplied). */
export function SelectGroup({
  label,
  children: _children,
}: {
  label?: string;
  children?: React.ReactNode;
}) {
  return null;
}
SelectGroup.displayName = "SelectGroup";

/** Mirrors SelectLabel — no-op. */
export function SelectLabel({ children: _children }: { children?: React.ReactNode }) {
  return null;
}
SelectLabel.displayName = "SelectLabel";

/** Mirrors SelectSeparator — no-op. */
export function SelectSeparator({ className: _className }: { className?: string }) {
  return null;
}
SelectSeparator.displayName = "SelectSeparator";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OptionMeta {
  value: string;
  label: string;
  disabled?: boolean;
}

interface GroupMeta {
  label?: string;
  options: OptionMeta[];
}

// ─── Main Select component ─────────────────────────────────────────────────────

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  children?: React.ReactNode;
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  disabled,
  name,
  required,
  children,
}: SelectProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internal;

  // ── Helpers for robust type detection (handles re-exports / different references) ──
  const isType = (type: any, Component: React.FC<any>) =>
    type === Component || (typeof type === "function" && (type as any).displayName === (Component as any).displayName);

  // ── Extract trigger props, placeholder, and option groups from child tree ──
  let triggerId: string | undefined;
  let triggerClassName: string | undefined;
  let placeholder: string | undefined;
  const groups: GroupMeta[] = [];

  flattenChildren(children).forEach((child) => {
    // SelectTrigger → id, className, SelectValue (placeholder)
    if (isType(child.type, SelectTrigger)) {
      const p = child.props as any;
      triggerId = p.id;
      triggerClassName = p.className;
      flattenChildren(p.children).forEach((tc) => {
        if (isType(tc.type, SelectValue)) {
          placeholder = (tc.props as any).placeholder;
        }
      });
    }

    // SelectContent → SelectGroup | SelectItem
    if (isType(child.type, SelectContent)) {
      const contentKids = flattenChildren((child.props as any).children);
      const ungrouped: OptionMeta[] = [];

      contentKids.forEach((item) => {
        if (isType(item.type, SelectGroup)) {
          const gp = item.props as any;
          const groupOpts: OptionMeta[] = [];
          flattenChildren(gp.children).forEach((gi) => {
            if (isType(gi.type, SelectItem)) {
              const ip = gi.props as any;
              groupOpts.push({
                value: ip.value,
                label: textContent(ip.children) || ip.value,
                disabled: ip.disabled,
              });
            }
          });
          if (groupOpts.length) groups.push({ label: gp.label, options: groupOpts });
        } else if (isType(item.type, SelectItem)) {
          const ip = item.props as any;
          ungrouped.push({
            value: ip.value,
            label: textContent(ip.children) || ip.value,
            disabled: ip.disabled,
          });
        }
      });

      if (ungrouped.length) groups.push({ options: ungrouped });
    }
  });

  const selectRef = React.useRef<HTMLSelectElement>(null);

  // Ensure DOM <select> stays in sync with React controlled value (React 19 safety net)
  React.useEffect(() => {
    if (selectRef.current && selectRef.current.value !== currentValue) {
      selectRef.current.value = currentValue;
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
  };

  return (
    <select
      ref={selectRef}
      id={triggerId}
      name={name}
      required={required}
      value={currentValue}
      onChange={handleChange}
      disabled={disabled}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
        "focus:outline-none focus:ring-1 focus:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Dark mode: browsers paint <select> with system background by default
        "dark:bg-background",
        triggerClassName,
      )}
    >
      {placeholder !== undefined && (
        <option value="" disabled={currentValue !== ""}>
          {placeholder}
        </option>
      )}
      {groups.map((group, gi) =>
        group.label ? (
          <optgroup key={gi} label={group.label}>
            {group.options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </optgroup>
        ) : (
          group.options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))
        ),
      )}
    </select>
  );
}
Select.displayName = "Select";
