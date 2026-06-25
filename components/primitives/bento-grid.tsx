import { cn } from "@/lib/utils";

const COL: Record<number, string> = {
  1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3", 4: "lg:col-span-4",
  5: "lg:col-span-5", 6: "lg:col-span-6", 7: "lg:col-span-7", 8: "lg:col-span-8",
  9: "lg:col-span-9", 10: "lg:col-span-10", 11: "lg:col-span-11", 12: "lg:col-span-12",
};
const ROW: Record<number, string> = { 1: "lg:row-span-1", 2: "lg:row-span-2", 3: "lg:row-span-3" };

export function BentoGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-5 lg:grid-cols-12", className)}>{children}</div>;
}

export function BentoItem({
  span = 4,
  rowSpan,
  className,
  children,
}: {
  span?: number;
  rowSpan?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn(COL[span], rowSpan ? ROW[rowSpan] : "", className)}>{children}</div>;
}
