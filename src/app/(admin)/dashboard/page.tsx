import { DashboardClient } from "@/app/(admin)/dashboard/dashboard-client";
import { getDashboardSummary } from "@/server/services/dashboard-service";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  return <DashboardClient initialSummary={summary} />;
}
