import { cn } from "@/lib/utils";
/** Label-wraps-control field: the wrapped input inherits the accessible name. */
export function Field({
  label,
  className,
  children,
}: {
  label: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("field", className)}>
      {label}
      {children}
    </label>
  );
}
