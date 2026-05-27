import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AdminStatusTone =
  | "success"
  | "warning"
  | "destructive"
  | "secondary";

type StatusBadgeProps = Omit<BadgeProps, "variant"> & {
  tone: AdminStatusTone;
};

const toneConfig = {
  success: {
    variant: "outline",
    className: "border-success/40 bg-success/10 text-success",
  },
  warning: {
    variant: "outline",
    className: "border-warning/40 bg-warning/10 text-warning",
  },
  destructive: {
    variant: "destructive",
    className: "border-destructive bg-destructive text-destructive-foreground",
  },
  secondary: {
    variant: "secondary",
    className: "border-border bg-secondary text-secondary-foreground",
  },
} as const satisfies Record<
  AdminStatusTone,
  { variant: NonNullable<BadgeProps["variant"]>; className: string }
>;

export function StatusBadge({ tone, className, ...props }: StatusBadgeProps) {
  const config = toneConfig[tone];

  return (
    <Badge
      className={cn(
        "w-fit gap-1 whitespace-nowrap rounded-full",
        config.className,
        className,
      )}
      data-status-tone={tone}
      variant={config.variant}
      {...props}
    />
  );
}
