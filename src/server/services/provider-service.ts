import { AppError } from "@/lib/errors";
import { recordAdminActionResult } from "@/server/audit/action-results";
import {
  ProviderRepository,
  providerTypeRequiresCredentials,
  sanitizeProviderCredential,
  type CreateProviderCredentialInput,
  type CreateProviderInput,
  type ProviderDetail,
} from "@/server/providers/provider-repository";
import {
  isolateCredential as isolateCredentialInPool,
  restoreCredential as restoreCredentialInPool,
} from "@/server/providers/credential-pool";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import type { Provider } from "@/server/storage/schema";
import type { ProviderFilter } from "@/server/providers/provider-repository";

export type ProviderServiceOptions = {
  db?: StorageDatabase;
  now?: Date;
  actorAdminUserId?: string | null;
};

export type ProviderListResult = {
  items: Awaited<ReturnType<ProviderRepository["listProviders"]>>;
  total: number;
};

export type UpdateProviderInput = Partial<
  Pick<
    Provider,
    | "name"
    | "priority"
    | "weight"
    | "concurrencyLimit"
    | "rotationEnabled"
    | "cooldownSeconds"
    | "fallbackProviderId"
  >
>;

const getRepository = (db?: StorageDatabase) =>
  new ProviderRepository(db ?? getStorageClient().db);

export async function listProviders(
  filter?: ProviderFilter,
  options: ProviderServiceOptions = {},
): Promise<ProviderListResult> {
  const repository = getRepository(options.db);
  const items = await repository.listProviders(filter, options.now);

  return { items, total: items.length };
}

export async function getProviderDetail(
  providerId: string,
  options: ProviderServiceOptions = {},
): Promise<ProviderDetail> {
  return getRepository(options.db).requireProvider(providerId, options.now);
}

export async function createProvider(
  input: CreateProviderInput,
  options: ProviderServiceOptions = {},
): Promise<ProviderDetail> {
  const repository = getRepository(options.db);
  const provider = await repository.createProvider(input, options.now);

  if (provider.status === "enabled") {
    await recordAdminActionResult({
      db: options.db,
      actorAdminUserId: options.actorAdminUserId ?? null,
      actionType: "provider_enabled",
      targetType: "provider",
      targetId: provider.id,
      result: "success",
      message: "Provider 已创建并启用。",
      createdAt: (options.now ?? new Date()).toISOString(),
    });
  }

  return provider;
}

export async function updateProvider(
  providerId: string,
  input: UpdateProviderInput,
  options: ProviderServiceOptions = {},
): Promise<ProviderDetail> {
  return getRepository(options.db).updateProviderPolicy(
    providerId,
    input,
    options.now,
  );
}

export async function enableProvider(
  providerId: string,
  options: ProviderServiceOptions = {},
): Promise<ProviderDetail> {
  const repository = getRepository(options.db);
  const current = await repository.requireProvider(providerId, options.now);

  // Type-aware credential check: Xunlei skips credential validation
  if (
    providerTypeRequiresCredentials(current.type) &&
    current.availableCredentialCount === 0
  ) {
    await recordAdminActionResult({
      db: options.db,
      actorAdminUserId: options.actorAdminUserId ?? null,
      actionType: "provider_enabled",
      targetType: "provider",
      targetId: providerId,
      result: "failed",
      message: "Provider 启用失败：没有可用上游凭据。",
      createdAt: (options.now ?? new Date()).toISOString(),
    });
    throw new AppError(
      "PROVIDER_CREDENTIAL_EXHAUSTED",
      "Provider 没有可用上游凭据，无法启用。",
      "credential_pool",
    );
  }

  const provider = await repository.setProviderStatus(
    providerId,
    "enabled",
    options.now,
  );

  await recordAdminActionResult({
    db: options.db,
    actorAdminUserId: options.actorAdminUserId ?? null,
    actionType: "provider_enabled",
    targetType: "provider",
    targetId: providerId,
    result: "success",
    message: "Provider 已启用。",
    createdAt: (options.now ?? new Date()).toISOString(),
  });

  return provider;
}

export async function disableProvider(
  providerId: string,
  options: ProviderServiceOptions = {},
): Promise<ProviderDetail> {
  const provider = await getRepository(options.db).setProviderStatus(
    providerId,
    "disabled",
    options.now,
  );

  await recordAdminActionResult({
    db: options.db,
    actorAdminUserId: options.actorAdminUserId ?? null,
    actionType: "provider_disabled",
    targetType: "provider",
    targetId: providerId,
    result: "success",
    message: "Provider 已停用。",
    createdAt: (options.now ?? new Date()).toISOString(),
  });

  return provider;
}

export async function listProviderCredentials(
  providerId: string,
  options: ProviderServiceOptions = {},
) {
  const repository = getRepository(options.db);
  await repository.requireProvider(providerId, options.now);
  const credentials = await repository.listProviderCredentials(providerId);

  return {
    items: credentials.map(sanitizeProviderCredential),
    total: credentials.length,
  };
}

export async function addProviderCredential(
  providerId: string,
  input: CreateProviderCredentialInput,
  options: ProviderServiceOptions = {},
) {
  const credential = await getRepository(options.db).addCredential(
    providerId,
    input,
    options.now,
  );

  return credential;
}

export async function isolateProviderCredential(
  providerId: string,
  credentialId: string,
  reason: string,
  options: ProviderServiceOptions = {},
) {
  const repository = getRepository(options.db);
  const before = await repository.requireProvider(providerId, options.now);
  const credential = await isolateCredentialInPool(
    providerId,
    credentialId,
    reason,
    {
      db: options.db,
      now: options.now,
    },
  );
  let after = await repository.requireProvider(providerId, options.now);

  if (after.status === "enabled" && after.availableCredentialCount === 0) {
    after = await repository.setProviderStatus(
      providerId,
      "degraded",
      options.now,
    );
  }

  await recordAdminActionResult({
    db: options.db,
    actorAdminUserId: options.actorAdminUserId ?? null,
    actionType: "credential_isolated",
    targetType: "provider_credential",
    targetId: credentialId,
    result: "success",
    message: `凭据已隔离；Provider 可用凭据 ${before.availableCredentialCount} -> ${after.availableCredentialCount}。`,
    createdAt: (options.now ?? new Date()).toISOString(),
  });

  return {
    credential: sanitizeProviderCredential(credential),
    provider: after,
  };
}

export async function restoreProviderCredential(
  providerId: string,
  credentialId: string,
  options: ProviderServiceOptions = {},
) {
  const repository = getRepository(options.db);
  const credential = await restoreCredentialInPool(providerId, credentialId, {
    db: options.db,
    now: options.now,
  });
  let provider = await repository.requireProvider(providerId, options.now);

  if (provider.status === "degraded" && provider.availableCredentialCount > 0) {
    provider = await repository.setProviderStatus(
      providerId,
      "enabled",
      options.now,
    );
  }

  await recordAdminActionResult({
    db: options.db,
    actorAdminUserId: options.actorAdminUserId ?? null,
    actionType: "credential_restored",
    targetType: "provider_credential",
    targetId: credentialId,
    result: "success",
    message: "凭据已恢复为 active。",
    createdAt: (options.now ?? new Date()).toISOString(),
  });

  return {
    credential: sanitizeProviderCredential(credential),
    provider,
  };
}
