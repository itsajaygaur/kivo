import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
export function Notice({
  error = false,
  className,
  children,
}: {
  error?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("notice", error && "error", className)} role={error ? "alert" : "status"}>
      {error ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
      {children}
    </div>
  );
}
