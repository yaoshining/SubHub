import { redirect } from "next/navigation";
import type * as React from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import type { AdminUserSummary } from "@/components/admin/sidebar";

type ProtectedLayoutProps = {
  children: React.ReactNode;
  user?: AdminUserSummary;
};

export function ProtectedLayout({ children, user }: ProtectedLayoutProps) {
  if (!user) {
    redirect("/login");
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
