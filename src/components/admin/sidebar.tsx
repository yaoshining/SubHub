"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  KeyRound,
  Moon,
  Server,
  Settings,
  Sun,
  Users,
} from "@/components/icons/lucide";
import { cn } from "@/lib/utils";

export type AdminUserSummary = {
  displayName: string;
  identifier: string;
};

const navigationItems = [
  {
    href: "/dashboard",
    label: "仪表盘",
    iconName: "layout-dashboard",
    Icon: LayoutDashboard,
  },
  { href: "/providers", label: "服务商", iconName: "server", Icon: Server },
  {
    href: "/api-keys",
    label: "API 密钥",
    iconName: "key-round",
    Icon: KeyRound,
  },
  { href: "/users", label: "用户", iconName: "users", Icon: Users },
  { href: "/settings", label: "设置", iconName: "settings", Icon: Settings },
] as const;

type SidebarProps = {
  user?: AdminUserSummary;
  onNavigate?: () => void;
  className?: string;
};

export function Sidebar({ user, onNavigate, className }: SidebarProps) {
  const pathname = usePathname();
  const [theme, setTheme] = React.useState<"dark" | "light">(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    const storage = window.localStorage;
    const getStoredTheme =
      storage && typeof storage.getItem === "function"
        ? storage.getItem("subhub-theme")
        : null;

    return getStoredTheme === "light" ? "light" : "dark";
  });

  React.useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (typeof window.localStorage?.setItem === "function") {
      window.localStorage.setItem("subhub-theme", nextTheme);
    }
    document.documentElement.classList.toggle("light", nextTheme === "light");
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  return (
    <aside
      className={cn(
        "flex min-h-[100dvh] w-sidebar flex-col overflow-hidden border-r bg-surface text-foreground",
        className,
      )}
      data-testid="admin-sidebar"
    >
      <Link
        aria-label="SubHub 控制台首页"
        className="flex h-14 items-center gap-2 border-b px-5"
        href="/dashboard"
        onClick={onNavigate}
      >
        <span className="relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-muted">
          <Image
            alt="SubHub Timeline S"
            className="hidden size-[23px] dark:block"
            height={24}
            src="/logo-dark.png"
            width={23}
          />
          <Image
            alt="SubHub Timeline S"
            className="size-[23px] dark:hidden"
            height={24}
            src="/logo-light.png"
            width={23}
          />
        </span>
        <span className="font-brand text-lg font-semibold leading-none">
          <span className="text-foreground">Sub</span>
          <span className="text-primary">Hub</span>
        </span>
      </Link>

      <nav aria-label="后台主导航" className="flex-1 space-y-1 px-3 py-4">
        {navigationItems.map(({ href, label, iconName, Icon }) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Button
              key={href}
              asChild
              className={cn(
                "h-10 w-full justify-start rounded-md px-3 text-sm text-muted-foreground transition-[background-color,color,transform] active:scale-[0.99]",
                active &&
                  "bg-surface-elevated text-foreground ring-1 ring-border",
              )}
              data-icon={iconName}
              variant="ghost"
            >
              <Link
                aria-current={active ? "page" : undefined}
                href={href}
                onClick={onNavigate}
              >
                <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            </Button>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted p-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {user?.displayName ?? "维护者"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.identifier ?? "admin@subhub.local"}
            </p>
          </div>
          <Button
            aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
            data-icon={theme === "dark" ? "moon" : "sun"}
            onClick={toggleTheme}
            size="icon"
            type="button"
            variant="ghost"
          >
            {theme === "dark" ? (
              <Moon aria-hidden="true" className="size-4" strokeWidth={1.8} />
            ) : (
              <Sun aria-hidden="true" className="size-4" strokeWidth={1.8} />
            )}
          </Button>
        </div>
        <Separator className="mt-3 bg-border/80" />
        <p className="mt-3 text-xs text-muted-foreground">
          自托管字幕网关控制台
        </p>
      </div>
    </aside>
  );
}

export { navigationItems };
