import {
  getCreateAdminProviderCredentialUrl,
  getCreateAdminProviderUrl,
  getDisableAdminProviderUrl,
  getEnableAdminProviderUrl,
  getGetAdminProviderUrl,
  getIsolateAdminProviderCredentialUrl,
  getListAdminProviderCredentialsUrl,
  getListAdminProvidersUrl,
  getRestoreAdminProviderCredentialUrl,
  getUpdateAdminProviderUrl,
} from "./generated/providers/providers";
import type {
  CreateProviderCredentialRequest,
  CreateProviderRequest,
  IsolateProviderCredentialRequest,
  Provider,
  ProviderCredential,
  ProviderCredentialActionResponse,
  ProviderCredentialList,
  ProviderCredentialListResponse,
  ProviderCredentialResponse,
  ProviderCredentialStatus,
  ProviderDetail,
  ProviderDetailResponse,
  ProviderList,
  ProviderListResponse,
  ProviderStatus,
  UpdateProviderRequest,
} from "./generated/model";
import { subhubApiClient } from "./client";

export type {
  CreateProviderCredentialRequest,
  CreateProviderRequest,
  IsolateProviderCredentialRequest,
  Provider,
  ProviderCredential,
  ProviderCredentialList,
  ProviderCredentialStatus,
  ProviderDetail,
  ProviderList,
  ProviderStatus,
  UpdateProviderRequest,
};

const jsonHeaders = (options?: RequestInit) => ({
  "Content-Type": "application/json",
  ...options?.headers,
});

export async function fetchProviders(
  options?: RequestInit,
): Promise<ProviderList> {
  const response = await subhubApiClient<ProviderListResponse>(
    getListAdminProvidersUrl(),
    { ...options, method: "GET" },
  );

  return response.data;
}

export async function createProvider(
  input: CreateProviderRequest,
  options?: RequestInit,
): Promise<ProviderDetail> {
  const response = await subhubApiClient<ProviderDetailResponse>(
    getCreateAdminProviderUrl(),
    {
      ...options,
      method: "POST",
      headers: jsonHeaders(options),
      body: JSON.stringify(input),
    },
  );

  return response.data;
}

export async function fetchProviderDetail(
  providerId: string,
  options?: RequestInit,
): Promise<ProviderDetail> {
  const response = await subhubApiClient<ProviderDetailResponse>(
    getGetAdminProviderUrl(providerId),
    { ...options, method: "GET" },
  );

  return response.data;
}

export async function updateProvider(
  providerId: string,
  input: UpdateProviderRequest,
  options?: RequestInit,
): Promise<ProviderDetail> {
  const response = await subhubApiClient<ProviderDetailResponse>(
    getUpdateAdminProviderUrl(providerId),
    {
      ...options,
      method: "PATCH",
      headers: jsonHeaders(options),
      body: JSON.stringify(input),
    },
  );

  return response.data;
}

export async function enableProvider(
  providerId: string,
  options?: RequestInit,
): Promise<ProviderDetail> {
  const response = await subhubApiClient<ProviderDetailResponse>(
    getEnableAdminProviderUrl(providerId),
    { ...options, method: "POST" },
  );

  return response.data;
}

export async function disableProvider(
  providerId: string,
  options?: RequestInit,
): Promise<ProviderDetail> {
  const response = await subhubApiClient<ProviderDetailResponse>(
    getDisableAdminProviderUrl(providerId),
    { ...options, method: "POST" },
  );

  return response.data;
}

export async function fetchProviderCredentials(
  providerId: string,
  options?: RequestInit,
): Promise<ProviderCredentialList> {
  const response = await subhubApiClient<ProviderCredentialListResponse>(
    getListAdminProviderCredentialsUrl(providerId),
    { ...options, method: "GET" },
  );

  return response.data;
}

export async function createProviderCredential(
  providerId: string,
  input: CreateProviderCredentialRequest,
  options?: RequestInit,
): Promise<ProviderCredential> {
  const response = await subhubApiClient<ProviderCredentialResponse>(
    getCreateAdminProviderCredentialUrl(providerId),
    {
      ...options,
      method: "POST",
      headers: jsonHeaders(options),
      body: JSON.stringify(input),
    },
  );

  return response.data;
}

export async function isolateProviderCredential(
  providerId: string,
  credentialId: string,
  input?: IsolateProviderCredentialRequest,
  options?: RequestInit,
): Promise<ProviderCredentialActionResponse["data"]> {
  const response = await subhubApiClient<ProviderCredentialActionResponse>(
    getIsolateAdminProviderCredentialUrl(providerId, credentialId),
    {
      ...options,
      method: "POST",
      headers: jsonHeaders(options),
      body: JSON.stringify(input ?? {}),
    },
  );

  return response.data;
}

export async function restoreProviderCredential(
  providerId: string,
  credentialId: string,
  options?: RequestInit,
): Promise<ProviderCredentialActionResponse["data"]> {
  const response = await subhubApiClient<ProviderCredentialActionResponse>(
    getRestoreAdminProviderCredentialUrl(providerId, credentialId),
    { ...options, method: "POST" },
  );

  return response.data;
}
