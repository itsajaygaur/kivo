import { cn } from "@/lib/utils";
const variantClass = {
  primary: "button-primary",
  secondary: "button-secondary",
  ghost: "icon-button",
} as const;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variantClass;
  compact?: boolean;
  danger?: boolean;
};
export function Button({
  variant = "secondary",
  compact = false,
  danger = false,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(variantClass[variant], compact && "compact", danger && "danger", className)}
      {...props}
    />
  );
}
