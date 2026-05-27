"use client";

import * as React from "react";

import { Menu } from "@/components/icons/lucide";
import { Sidebar, type AdminUserSummary } from "@/components/admin/sidebar";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

type ResponsiveDrawerProps = {
  user?: AdminUserSummary;
  className?: string;
};

export function ResponsiveDrawer({ user, className }: ResponsiveDrawerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
      <DrawerTrigger asChild>
        <Button
          aria-label="打开后台导航"
          className={cn("desktop:hidden", className)}
          data-icon="menu"
          size="icon"
          type="button"
          variant="ghost"
        >
          <Menu aria-hidden="true" className="size-5" strokeWidth={1.8} />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="inset-y-0 left-0 right-auto mt-0 h-[100dvh] max-h-[100dvh] w-[min(21rem,calc(100vw-2rem))] rounded-none border-r bg-surface p-0">
        <DrawerHeader className="sr-only">
          <DrawerTitle>后台导航</DrawerTitle>
          <DrawerDescription>打开后可访问仪表盘、服务商、API 密钥、用户和设置。</DrawerDescription>
        </DrawerHeader>
        <Sidebar className="min-h-[100dvh] border-r-0" user={user} onNavigate={() => setOpen(false)} />
      </DrawerContent>
    </Drawer>
  );
}
