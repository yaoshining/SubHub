import type * as React from "react";
import { cookies } from "next/headers";

import { ProtectedLayout } from "@/components/admin/protected-layout";
import type { AdminUserSummary } from "@/components/admin/sidebar";
import {
  adminSessionCookieName,
  requireActiveAdminSession,
} from "@/lib/auth/session";

type AdminLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const cookieStore = await cookies();
  const session = await requireActiveAdminSession(
    cookieStore.get(adminSessionCookieName)?.value,
    { touchLastSeen: true },
  );
  const user: AdminUserSummary = {
    displayName: session.adminUser.displayName,
    identifier: session.adminUser.identifier,
  };

  return <ProtectedLayout user={user}>{children}</ProtectedLayout>;
}
