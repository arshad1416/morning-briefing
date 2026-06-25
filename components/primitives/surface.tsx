import { cn } from "@/lib/utils";

type Variant = "default" | "raised" | "inset";
const VARIANTS: Record<Variant, string> = {
  default: "bg-surface border border-border transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)]",
  raised: "bg-elevated border border-border shadow-[var(--shadow-raised)] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised-hover)]",
  inset: "bg-surface-2 border border-border",
};

export function Surface({
  variant = "default",
  className,
  as: As = "div",
  children,
  ...rest
}: {
  variant?: Variant;
  as?: React.ElementType;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cn("rounded-lg", VARIANTS[variant], className)} {...rest}>
      {children}
    </As>
  );
}

export function SurfaceHeader({
  title,
  children,
  className,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 border-b border-border px-4 py-3", className)}>
      <h3 className="text-sm font-medium text-fg">{title}</h3>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}
