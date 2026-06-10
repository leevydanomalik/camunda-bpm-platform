"use client";

/**
 * NativeDialog — drop-in replacement for Shadcn/Radix Dialog.
 *
 * Why: Radix Dialog wraps scrollable content in a `display:table` element,
 * causing `w-full` form inputs to expand beyond the dialog boundary.
 * This implementation uses standard flexbox — predictable box model, zero overflow.
 *
 * Compound API (mirrors Shadcn Dialog):
 *   <Dialog open={open} onOpenChange={setOpen}>
 *     <DialogContent className="max-w-lg">
 *       <DialogHeader>
 *         <DialogTitle>Title</DialogTitle>
 *         <DialogDescription>Subtitle</DialogDescription>
 *       </DialogHeader>
 *       <DialogBody>          ← scrollable middle section
 *         {children}
 *       </DialogBody>
 *       <DialogFooter>
 *         <Button>Cancel</Button>
 *         <Button>Save</Button>
 *       </DialogFooter>
 *     </DialogContent>
 *   </Dialog>
 */

import * as React from "react";
import { createPortal } from "react-dom";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";

// ─── Context ───────────────────────────────────────────────────────────────────

interface DialogCtx {
  onClose: () => void;
}

const DialogContext = React.createContext<DialogCtx | null>(null);

function useDialogContext() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error("Dialog compound components must be used inside <Dialog>");
  return ctx;
}

// ─── Dialog root ───────────────────────────────────────────────────────────────

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const onClose = React.useCallback(() => onOpenChange(false), [onOpenChange]);

  if (!open || !mounted) return null;

  return (
    <DialogContext.Provider value={{ onClose }}>
      {createPortal(children, document.body)}
    </DialogContext.Provider>
  );
}
Dialog.displayName = "Dialog";

// ─── DialogContent ─────────────────────────────────────────────────────────────

export interface DialogContentProps {
  className?: string;
  children?: React.ReactNode;
  /** Show the default × close button. Default: true */
  showCloseButton?: boolean;
  /** Max height of the dialog panel. Default: "90vh" */
  maxHeight?: string;
  /** aria-labelledby id */
  "aria-labelledby"?: string;
}

export function DialogContent({
  className,
  children,
  showCloseButton = true,
  maxHeight = "90vh",
  "aria-labelledby": labelledBy,
}: DialogContentProps) {
  const { onClose } = useDialogContext();
  const overlayRef = React.useRef<HTMLDivElement>(null);

  // Escape key
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Body scroll lock
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // When this dialog is opened from inside a Radix Sheet/Dialog, that ancestor
  // installs `react-remove-scroll` capture-phase wheel/touchmove listeners on
  // `document` which preventDefault on events outside its tracked region —
  // including events inside our portaled dialog, which freezes scrolling.
  // Intercept on `window` (capture runs before document) and stop propagation
  // for events inside our backdrop so the ancestor handlers never run.
  React.useEffect(() => {
    const isInside = (target: EventTarget | null) =>
      target instanceof Element && target.closest("[data-native-dialog]") === overlayRef.current;
    const block = (e: Event) => {
      if (isInside(e.target)) e.stopImmediatePropagation();
    };
    window.addEventListener("wheel", block, { capture: true, passive: false });
    window.addEventListener("touchmove", block, { capture: true, passive: false });
    return () => {
      window.removeEventListener("wheel", block, { capture: true });
      window.removeEventListener("touchmove", block, { capture: true });
    };
  }, []);

  // Track whether mousedown started on the backdrop itself.
  // Only close if BOTH mousedown AND mouseup land on the backdrop.
  // This prevents Radix Tabs (and similar components) from accidentally
  // closing the dialog when DOM restructuring during click causes
  // mouseup to land on the backdrop.
  const pointerDownOnBackdrop = React.useRef(false);

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      pointerDownOnBackdrop.current = e.target === overlayRef.current;
    },
    [],
  );

  const handlePointerUp = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pointerDownOnBackdrop.current && e.target === overlayRef.current) {
        onClose();
      }
      pointerDownOnBackdrop.current = false;
    },
    [onClose],
  );

  return (
    /* Backdrop */
    <div
      ref={overlayRef}
      data-native-dialog=""
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 pointer-events-auto"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          "relative flex w-full max-w-lg flex-col rounded-lg border bg-background shadow-lg",
          className,
        )}
        style={{ maxHeight }}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
DialogContent.displayName = "DialogContent";

// ─── DialogHeader ──────────────────────────────────────────────────────────────

export function DialogHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 border-b px-6 py-4 pr-12", className)}
      {...props}
    >
      {children}
    </div>
  );
}
DialogHeader.displayName = "DialogHeader";

// ─── DialogTitle ───────────────────────────────────────────────────────────────

export function DialogTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-lg font-semibold leading-none", className)}
      {...props}
    >
      {children}
    </h2>
  );
}
DialogTitle.displayName = "DialogTitle";

// ─── DialogDescription ─────────────────────────────────────────────────────────

export function DialogDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props}>
      {children}
    </p>
  );
}
DialogDescription.displayName = "DialogDescription";

// ─── DialogBody ────────────────────────────────────────────────────────────────
// The scrollable middle section — key difference from Shadcn.
// Uses min-h-0 + flex-1 so it grows/shrinks within the flex panel and scrolls.

export function DialogBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}
DialogBody.displayName = "DialogBody";

// ─── DialogFooter ──────────────────────────────────────────────────────────────

export function DialogFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex justify-end gap-2 border-t px-6 py-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}
DialogFooter.displayName = "DialogFooter";

// ─── DialogClose ───────────────────────────────────────────────────────────────

export function DialogClose({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onClose } = useDialogContext();
  return (
    <button type="button" onClick={onClose} {...props}>
      {children}
    </button>
  );
}
DialogClose.displayName = "DialogClose";
