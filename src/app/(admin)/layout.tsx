import type * as React from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ProtectedLayout } from "@/components/admin/protected-layout";
import { getAdminPageMeta } from "@/components/admin/admin-page-meta";
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
  const pageTitle = getAdminPageMeta(headerStore.get(adminRequestPathHeader));

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
