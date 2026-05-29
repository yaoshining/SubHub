import {
  getCreateAdminUserInvitationUrl,
  getListAdminUsersUrl,
  getRemediateAdminSessionUrl,
  getRestoreAdminUserUrl,
  getSuspendAdminUserUrl,
} from "./generated/users/users";
import type {
  AdminInvitation,
  AdminInvitationStatus,
  AdminMember,
  AdminRolePreset,
  AdminSessionAttentionSummary,
  AdminSessionRemediationAction,
  AdminInvitationResponse,
  AdminSessionRemediationRequest,
  AdminSessionRemediationResponse,
  AdminSessionRemediationResult,
  AdminUserActionResponse,
  AdminUserActionResult,
  AdminUserStatus,
  AdminUsersOverview,
  AdminUsersOverviewResponse,
  CreateAdminInvitationRequest,
  CreateAdminInvitationRequestAccessPreset,
} from "./generated/model";
import { subhubApiClient } from "./client";

export type {
  AdminInvitation,
  AdminInvitationStatus,
  AdminMember,
  AdminRolePreset,
  AdminSessionAttentionSummary,
  AdminSessionRemediationAction,
  AdminSessionRemediationRequest,
  AdminSessionRemediationResult,
  AdminUserActionResult,
  AdminUserStatus,
  AdminUsersOverview,
  CreateAdminInvitationRequest,
  CreateAdminInvitationRequestAccessPreset,
};

const jsonHeaders = (options?: RequestInit) => ({
  "Content-Type": "application/json",
  ...options?.headers,
});

export async function fetchAdminUsersOverview(
  options?: RequestInit,
): Promise<AdminUsersOverview> {
  const response = await subhubApiClient<AdminUsersOverviewResponse>(
    getListAdminUsersUrl(),
    { ...options, method: "GET" },
  );

  return response.data;
}

export async function createAdminInvitation(
  input: CreateAdminInvitationRequest,
  options?: RequestInit,
): Promise<AdminInvitation> {
  const response = await subhubApiClient<AdminInvitationResponse>(
    getCreateAdminUserInvitationUrl(),
    {
      ...options,
      method: "POST",
      headers: jsonHeaders(options),
      body: JSON.stringify(input),
    },
  );

  return response.data;
}

export async function suspendAdminUser(
  userId: string,
  options?: RequestInit,
): Promise<AdminUserActionResult> {
  const response = await subhubApiClient<AdminUserActionResponse>(
    getSuspendAdminUserUrl(userId),
    { ...options, method: "POST" },
  );

  return response.data;
}

export async function restoreAdminUser(
  userId: string,
  options?: RequestInit,
): Promise<AdminUserActionResult> {
  const response = await subhubApiClient<AdminUserActionResponse>(
    getRestoreAdminUserUrl(userId),
    { ...options, method: "POST" },
  );

  return response.data;
}

export async function remediateAdminSession(
  sessionId: string,
  input: AdminSessionRemediationRequest,
  options?: RequestInit,
): Promise<AdminSessionRemediationResult> {
  const response = await subhubApiClient<AdminSessionRemediationResponse>(
    getRemediateAdminSessionUrl(sessionId),
    {
      ...options,
      method: "POST",
      headers: jsonHeaders(options),
      body: JSON.stringify(input),
    },
  );

  return response.data;
}
