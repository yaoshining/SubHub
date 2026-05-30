import { getGetAdminDashboardSummaryUrl } from "./generated/system/system";
import type {
  DashboardSummary,
  DashboardSummaryResponse,
} from "./generated/model";
import { subhubApiClient } from "./client";

export type { DashboardSummary };

export async function fetchDashboardSummary(
  options?: RequestInit,
): Promise<DashboardSummary> {
  const response = await subhubApiClient<DashboardSummaryResponse>(
    getGetAdminDashboardSummaryUrl(),
    { ...options, method: "GET" },
  );

  return response.data;
}
