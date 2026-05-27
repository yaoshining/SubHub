import type * as React from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import type { AdminUserSummary } from "@/components/admin/sidebar";

type ProtectedLayoutProps = {
  children: React.ReactNode;
  user?: AdminUserSummary;
};

const fallbackUser: AdminUserSummary = {
  displayName: "维护者",
  identifier: "admin@subhub.local",
};

export function ProtectedLayout({ children, user = fallbackUser }: ProtectedLayoutProps) {
  return <AdminShell user={user}>{children}</AdminShell>;
}
