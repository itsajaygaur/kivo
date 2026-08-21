"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Native <dialog>-based modal: focus trapping, Escape handling, and inert
 * background come from the platform. Rendered only while open so no stray
 * role="dialog" nodes linger in the DOM.
 */
export function Dialog({
  open,
  onClose,
  dismissable = true,
  label,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  dismissable?: boolean;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (element && !element.open) element.showModal();
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={cn("dialog-sheet", className)}
      onCancel={(event) => {
        if (!dismissable) event.preventDefault();
      }}
      onClose={onClose}
      onMouseDown={(event) => {
        if (dismissable && event.target === ref.current) ref.current?.close();
      }}
    >
      {children}
    </dialog>
  );
}
