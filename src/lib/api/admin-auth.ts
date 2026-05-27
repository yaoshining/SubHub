import {
  createInitialAdmin,
  getAdminBootstrapStatus,
  getCurrentAdmin,
  loginAdmin,
  logoutAdmin,
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
  const response = (await getAdminBootstrapStatus(
    options,
  )) as unknown as BootstrapStatusResponse;

  return response.data;
}

export async function bootstrapInitialAdmin(
  input: CreateInitialAdminRequest,
  options?: RequestInit,
): Promise<CreateInitialAdminResult> {
  const response = (await createInitialAdmin(
    input,
    options,
  )) as unknown as CreateInitialAdminResponse;

  return response.data;
}

export async function loginAdminUser(
  input: AdminLoginRequest,
  options?: RequestInit,
): Promise<AdminPrincipal> {
  const response = (await loginAdmin(
    input,
    options,
  )) as unknown as AdminLoginResponse;

  return response.data.admin;
}

export async function logoutAdminUser(options?: RequestInit): Promise<void> {
  await logoutAdmin(options);
}

export async function fetchCurrentAdmin(
  options?: RequestInit,
): Promise<AdminPrincipal> {
  const response = (await getCurrentAdmin(
    options,
  )) as unknown as CurrentAdminResponse;

  return response.data.admin;
}
