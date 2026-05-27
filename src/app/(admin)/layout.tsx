import type * as React from "react";

import { ProtectedLayout } from "@/components/admin/protected-layout";

type AdminLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
