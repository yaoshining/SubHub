import type * as React from "react";

import { CloudOff, KeyRound, Users } from "@/components/icons/lucide";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const emptyStateIcons = {
  "cloud-off": CloudOff,
  "key-round": KeyRound,
  users: Users,
} as const;

export type EmptyStateIconName = keyof typeof emptyStateIcons;

type EmptyStateCardProps = {
  icon: EmptyStateIconName;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyStateCard({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateCardProps) {
  const Icon = emptyStateIcons[icon];

  return (
    <Card
      className={cn(
        "border-border bg-surface shadow-none",
        className,
      )}
      data-empty-icon={icon}
      data-testid="empty-state-card"
    >
      <CardContent className="flex flex-col items-center gap-5 px-8 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-lg border bg-background text-muted-foreground">
          <Icon aria-hidden="true" className="size-6" strokeWidth={1.8} />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="flex min-h-9 items-center">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

export function EmptyStateActionButton(props: React.ComponentProps<typeof Button>) {
  return <Button size="sm" {...props} />;
}
