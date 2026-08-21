import { cn } from "@/lib/utils";
export function StatusStamp({
  failed = false,
  className,
  children,
}: {
  failed?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={cn("status", failed && "failed", className)}>{children}</span>;
}
