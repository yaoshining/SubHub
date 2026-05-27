import {
  getGetAdminBootstrapStatusUrl,
  getCreateInitialAdminUrl,
  getLoginAdminUrl,
  getLogoutAdminUrl,
  getGetCurrentAdminUrl,
} from "./generated/admin-auth/admin-auth";
import type {
  AdminLoginRequest,
  AdminLoginResponse,
  AdminPrincipal,
  BootstrapStatus,
  BootstrapStatusResponse,
  CreateInitialAdminRequest,
  CreateInitialAdminResult,
  CreateInitialAdminResponse,
  CurrentAdminResponse,
} from "./generated/model";
import { subhubApiClient } from "./client";

export type {
  AdminLoginRequest,
  AdminPrincipal,
  BootstrapStatus,
  CreateInitialAdminRequest,
  CreateInitialAdminResult,
};

export async function fetchBootstrapStatus(
  options?: RequestInit,
): Promise<BootstrapStatus> {
  const response = await subhubApiClient<BootstrapStatusResponse>(
    getGetAdminBootstrapStatusUrl(),
    { ...options, method: "GET" },
  );

  return response.data;
}

export async function bootstrapInitialAdmin(
  input: CreateInitialAdminRequest,
  options?: RequestInit,
): Promise<CreateInitialAdminResult> {
  const response = await subhubApiClient<CreateInitialAdminResponse>(
    getCreateInitialAdminUrl(),
    {
      ...options,
      method: "POST",
      headers: { "Content-Type": "application/json", ...options?.headers },
      body: JSON.stringify(input),
    },
  );

  return response.data;
}

export async function loginAdminUser(
  input: AdminLoginRequest,
  options?: RequestInit,
): Promise<AdminPrincipal> {
  const response = await subhubApiClient<AdminLoginResponse>(
    getLoginAdminUrl(),
    {
      ...options,
      method: "POST",
      headers: { "Content-Type": "application/json", ...options?.headers },
      body: JSON.stringify(input),
    },
  );

  return response.data.admin;
}

export async function logoutAdminUser(options?: RequestInit): Promise<void> {
  await subhubApiClient<void>(getLogoutAdminUrl(), {
    ...options,
    method: "POST",
  });
}

export async function fetchCurrentAdmin(
  options?: RequestInit,
): Promise<AdminPrincipal> {
  const response = await subhubApiClient<CurrentAdminResponse>(
    getGetCurrentAdminUrl(),
    { ...options, method: "GET" },
  );

  return response.data.admin;
}
