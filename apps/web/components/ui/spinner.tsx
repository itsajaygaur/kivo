import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return <LoaderCircle aria-hidden size={size} className={cn("spin", className)} />;
}
