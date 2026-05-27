import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AdminStatusTone = "success" | "warning" | "destructive" | "secondary";

type StatusBadgeProps = Omit<BadgeProps, "variant"> & {
  tone: AdminStatusTone;
};

const toneToVariant = {
  success: "success",
  warning: "warning",
  destructive: "destructive",
  secondary: "secondary",
} as const;

export function StatusBadge({ tone, className, ...props }: StatusBadgeProps) {
  return (
    <Badge
      className={cn("w-fit gap-1 whitespace-nowrap", className)}
      data-status-tone={tone}
      variant={toneToVariant[tone]}
      {...props}
    />
  );
}
