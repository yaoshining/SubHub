import type * as React from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ProtectedLayout } from "@/components/admin/protected-layout";
import type { AdminUserSummary } from "@/components/admin/sidebar";
import {
  adminRequestPathHeader,
  adminSessionCookieName,
  requireActiveAdminSession,
} from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

type AdminLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

function getLoginRedirectPath(pathname: string | null) {
  if (
    !pathname ||
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    /[\r\n]/.test(pathname) ||
    pathname.startsWith("/login")
  ) {
    return "/login";
  }

  return `/login?${new URLSearchParams({
    next: pathname,
    auth: "session-expired",
  }).toString()}`;
}

function getAdminPageTitle(pathname: string | null) {
  const path = pathname?.split("?")[0] ?? "/dashboard";

  if (path.startsWith("/providers/")) {
    return {
      title: "服务商详情",
      description: "调整单个 Provider 的运行策略、凭据池与最近行为。",
    };
  }
  if (path === "/providers") {
    return {
      title: "服务商",
      description: "比较 Provider 状态、创建 OpenSubtitles 实例并检查凭据池。",
    };
  }
  if (path === "/api-keys") {
    return {
      title: "API 密钥",
      description: "管理下游调用方 Key 生命周期与受控明文展示。",
    };
  }
  if (path === "/users") {
    return {
      title: "用户",
      description: "查看后台成员、邀请、暂停恢复与基础会话处置。",
    };
  }
  if (path === "/settings") {
    return {
      title: "设置",
      description: "确认系统状态，并跳转到正确治理页完成深配置。",
    };
  }

  return {
    title: "仪表盘",
    description: "查看 SubHub 当前运营状态与下一步配置入口。",
  };
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  let session: Awaited<ReturnType<typeof requireActiveAdminSession>>;

  try {
    session = await requireActiveAdminSession(
      cookieStore.get(adminSessionCookieName)?.value,
      { touchLastSeen: true },
    );
  } catch (error) {
    if (error instanceof AppError && error.code === "AUTHENTICATION_REQUIRED") {
      redirect(getLoginRedirectPath(headerStore.get(adminRequestPathHeader)));
    }

    throw error;
  }

  const user: AdminUserSummary = {
    displayName: session.adminUser.displayName,
    identifier: session.adminUser.identifier,
  };
  const pageTitle = getAdminPageTitle(headerStore.get(adminRequestPathHeader));

  return (
    <ProtectedLayout
      user={user}
      title={pageTitle.title}
      description={pageTitle.description}
    >
      {children}
    </ProtectedLayout>
  );
}
