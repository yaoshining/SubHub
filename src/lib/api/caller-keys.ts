import {
  getCreateAdminCallerKeyUrl,
  getGetAdminCallerKeyUsageUrl,
  getListAdminCallerKeysUrl,
  getRotateAdminCallerKeyUrl,
  getSuspendAdminCallerKeyUrl,
} from "./generated/caller-keys/caller-keys";
import type {
  CallerKey,
  CallerKeyList,
  CallerKeyListResponse,
  CallerKeyResponse,
  CallerKeyReveal,
  CallerKeyRevealResponse,
  CallerKeyRotationResult,
  CallerKeyRotationResponse,
  CallerKeyUsage,
  CallerKeyUsageResponse,
  CreateCallerKeyRequest,
} from "./generated/model";
import { subhubApiClient } from "./client";

export type {
  CallerKey,
  CallerKeyList,
  CallerKeyReveal,
  CallerKeyRotationResult,
  CallerKeyUsage,
  CreateCallerKeyRequest,
};

const jsonHeaders = (options?: RequestInit) => ({
  "Content-Type": "application/json",
  ...options?.headers,
});

export async function fetchCallerKeys(
  options?: RequestInit,
): Promise<CallerKeyList> {
  const response = await subhubApiClient<CallerKeyListResponse>(
    getListAdminCallerKeysUrl(),
    { ...options, method: "GET" },
  );

  return response.data;
}

export async function createCallerKey(
  input: CreateCallerKeyRequest,
  options?: RequestInit,
): Promise<CallerKeyReveal> {
  const response = await subhubApiClient<CallerKeyRevealResponse>(
    getCreateAdminCallerKeyUrl(),
    {
      ...options,
      method: "POST",
      headers: jsonHeaders(options),
      body: JSON.stringify(input),
    },
  );

  return response.data;
}

export async function rotateCallerKey(
  keyId: string,
  options?: RequestInit,
): Promise<CallerKeyRotationResult> {
  const response = await subhubApiClient<CallerKeyRotationResponse>(
    getRotateAdminCallerKeyUrl(keyId),
    { ...options, method: "POST" },
  );

  return response.data;
}

export async function suspendCallerKey(
  keyId: string,
  options?: RequestInit,
): Promise<CallerKey> {
  const response = await subhubApiClient<CallerKeyResponse>(
    getSuspendAdminCallerKeyUrl(keyId),
    { ...options, method: "POST" },
  );

  return response.data;
}

export async function fetchCallerKeyUsage(
  keyId: string,
  options?: RequestInit,
): Promise<CallerKeyUsage> {
  const response = await subhubApiClient<CallerKeyUsageResponse>(
    getGetAdminCallerKeyUsageUrl(keyId),
    { ...options, method: "GET" },
  );

  return response.data;
}
