import { getAdminDashboardSummary } from "./generated/system/system";
import type {
  DashboardSummary,
  DashboardSummaryResponse,
} from "./generated/model";

export type { DashboardSummary };

export async function fetchDashboardSummary(
  options?: RequestInit,
): Promise<DashboardSummary> {
  const response = (await getAdminDashboardSummary(
    options,
  )) as unknown as DashboardSummaryResponse;

  return response.data;
}
