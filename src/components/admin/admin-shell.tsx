import type * as React from "react";

import { PageHeader } from "@/components/admin/page-header";
import { ResponsiveDrawer } from "@/components/admin/responsive-drawer";
import { Sidebar, type AdminUserSummary } from "@/components/admin/sidebar";
import { cn } from "@/lib/utils";

type AdminShellProps = {
  children: React.ReactNode;
  user?: AdminUserSummary;
  title?: string;
  description?: string;
  header?: React.ReactNode;
  actions?: React.ReactNode;
  secondaryPanel?: React.ReactNode;
  className?: string;
};

export function AdminShell({
  children,
  user,
  title = "仪表盘",
  description = "查看 SubHub 当前运营状态与下一步配置入口。",
  header,
  actions,
  secondaryPanel,
  className,
}: AdminShellProps) {
  return (
    <div
      className="min-h-[100dvh] overflow-x-hidden bg-background text-foreground desktop:h-screen desktop:overflow-hidden"
      data-testid="admin-shell"
    >
      <Sidebar
        className="hidden desktop:fixed desktop:inset-y-0 desktop:left-0 desktop:z-30 desktop:flex"
        user={user}
      />
      <div
        className="min-w-0 desktop:h-screen desktop:overflow-y-auto desktop:pl-[var(--sidebar-width)]"
        data-testid="admin-content-region"
      >
        <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur desktop:hidden">
          <ResponsiveDrawer user={user} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              SubHub
            </p>
            <p className="truncate text-xs text-muted-foreground">后台控制台</p>
          </div>
        </div>
        {header ?? (
          <PageHeader
            title={title}
            description={description}
            actions={actions}
          />
        )}
        <main
          className={cn(
            "mx-auto grid w-full max-w-[1400px] gap-6 px-4 py-6 sm:px-6 xl:px-8",
            secondaryPanel && "desktop:grid-cols-[minmax(0,1fr)_20rem]",
            className,
          )}
        >
          <div className="min-w-0">{children}</div>
          {secondaryPanel ? (
            <aside className="min-w-0 desktop:sticky desktop:top-20 desktop:self-start">
              {secondaryPanel}
            </aside>
          ) : null}
        </main>
      </div>
    </div>
  );
}
