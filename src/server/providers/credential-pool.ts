import { and, asc, eq, isNull, lte, or } from "drizzle-orm";

import { AppError } from "@/lib/errors";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import {
  providerCredentials,
  type Provider,
  type ProviderCredential,
} from "@/server/storage/schema";
import { decryptProviderCredentialSecret } from "./provider-secrets";

export type CredentialPoolOptions = {
  db?: StorageDatabase;
  now?: Date;
};

export type SelectedProviderCredential = ProviderCredential & {
  secret: string;
};

export type CredentialFailureReason =
  | "rate_limited"
  | "authentication_failed"
  | "quota_exhausted"
  | "timeout"
  | "upstream_failed";

const summarizeCredentialError = (summary: string) =>
  summary.trim().replaceAll(/\s+/g, " ").slice(0, 240);

export async function selectProviderCredential(
  providerId: string,
  { db = getStorageClient().db, now = new Date() }: CredentialPoolOptions = {},
): Promise<SelectedProviderCredential> {
  const nowIso = now.toISOString();
  const [credential] = await db
    .select()
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.providerId, providerId),
        eq(providerCredentials.status, "active"),
        or(
          isNull(providerCredentials.cooldownUntil),
          lte(providerCredentials.cooldownUntil, nowIso),
        ),
      ),
    )
    .orderBy(
      asc(providerCredentials.lastUsedAt),
      asc(providerCredentials.createdAt),
    )
    .limit(1);

  if (!credential) {
    throw new AppError(
      "PROVIDER_CREDENTIAL_EXHAUSTED",
      "当前 Provider 没有可参与调度的活跃凭据。",
      "credential_pool",
    );
  }

  return {
    ...credential,
    secret: decryptProviderCredentialSecret(credential.secretEncrypted),
  };
}

export async function markCredentialUsed(
  providerId: string,
  credentialId: string,
  { db = getStorageClient().db, now = new Date() }: CredentialPoolOptions = {},
) {
  await db
    .update(providerCredentials)
    .set({
      lastUsedAt: now.toISOString(),
      lastErrorAt: null,
      lastErrorSummary: null,
      updatedAt: now.toISOString(),
    })
    .where(
      and(
        eq(providerCredentials.providerId, providerId),
        eq(providerCredentials.id, credentialId),
      ),
    );
}

export async function markCredentialFailure(
  provider: Pick<Provider, "id" | "cooldownSeconds">,
  credentialId: string,
  reason: CredentialFailureReason,
  message: string,
  { db = getStorageClient().db, now = new Date() }: CredentialPoolOptions = {},
) {
  const failureAt = now.toISOString();
  const summary = summarizeCredentialError(message);
  const status: ProviderCredential["status"] =
    reason === "quota_exhausted" || reason === "authentication_failed"
      ? "exhausted"
      : "cooldown";
  const cooldownUntil =
    status === "cooldown"
      ? new Date(now.getTime() + provider.cooldownSeconds * 1000).toISOString()
      : null;

  await db
    .update(providerCredentials)
    .set({
      status,
      cooldownUntil,
      lastErrorAt: failureAt,
      lastErrorSummary: summary,
      updatedAt: failureAt,
    })
    .where(
      and(
        eq(providerCredentials.providerId, provider.id),
        eq(providerCredentials.id, credentialId),
      ),
    );
}

export async function isolateCredential(
  providerId: string,
  credentialId: string,
  reason: string,
  options: CredentialPoolOptions = {},
) {
  const now = options.now ?? new Date();
  const db = options.db ?? getStorageClient().db;

  const [credential] = await db
    .update(providerCredentials)
    .set({
      status: "isolated",
      cooldownUntil: null,
      lastErrorAt: now.toISOString(),
      lastErrorSummary: summarizeCredentialError(reason),
      updatedAt: now.toISOString(),
    })
    .where(
      and(
        eq(providerCredentials.providerId, providerId),
        eq(providerCredentials.id, credentialId),
      ),
    )
    .returning();

  if (!credential) {
    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      "Provider 凭据不存在。",
      "credentialId",
    );
  }

  return credential;
}

export async function restoreCredential(
  providerId: string,
  credentialId: string,
  options: CredentialPoolOptions = {},
) {
  const now = options.now ?? new Date();
  const db = options.db ?? getStorageClient().db;
  const [credential] = await db
    .update(providerCredentials)
    .set({
      status: "active",
      cooldownUntil: null,
      lastErrorAt: null,
      lastErrorSummary: null,
      updatedAt: now.toISOString(),
    })
    .where(
      and(
        eq(providerCredentials.providerId, providerId),
        eq(providerCredentials.id, credentialId),
      ),
    )
    .returning();

  if (!credential) {
    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      "Provider 凭据不存在。",
      "credentialId",
    );
  }

  return credential;
}
