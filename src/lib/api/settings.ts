import { getGetAdminSettingsStatusUrl } from "./generated/system/system";
import type {
  ReadinessSummary,
  SettingsStatusResponse,
} from "./generated/model";
import { subhubApiClient } from "./client";

export type { ReadinessSummary as SettingsStatus };

export async function fetchSettingsStatus(
  options?: RequestInit,
): Promise<ReadinessSummary> {
  const response = await subhubApiClient<SettingsStatusResponse>(
    getGetAdminSettingsStatusUrl(),
    { ...options, method: "GET" },
  );

  return response.data;
}
