import { randomBytes } from "node:crypto";

import { and, eq, inArray, ne } from "drizzle-orm";

import { AppError } from "@/lib/errors";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import {
  isConstraintError,
  isForeignKeyConstraintError,
  isUniqueConstraintError,
} from "@/server/storage/database-errors";
import {
  providerCredentials,
  providers,
  providerTypes,
  type NewProvider,
  type NewProviderCredential,
  type Provider,
  type ProviderCredential,
} from "@/server/storage/schema";
import {
  createCredentialDisplayParts,
  encryptProviderCredentialSecret,
  hashProviderCredentialSecret,
} from "./provider-secrets";

export type ProviderPolicyInput = Pick<
  Provider,
  | "priority"
  | "weight"
  | "concurrencyLimit"
  | "rotationEnabled"
  | "cooldownSeconds"
  | "fallbackProviderId"
>;

export type ProviderFilter = {
  type?: (typeof providerTypes)[number];
  status?: Provider["status"];
};

export type CreateProviderInput = {
  name: string;
  type: Provider["type"];
  initialCredential?: {
    label: string;
    secret: string;
  };
};

export type CreateProviderCredentialInput = {
  label: string;
  secret: string;
};

export type ProviderWithCredentialSummary = Provider & {
  activeCredentialCount: number;
  availableCredentialCount: number;
  credentialCount: number;
};

export type ProviderDetail = ProviderWithCredentialSummary & {
  credentials: SanitizedProviderCredential[];
};

export type SanitizedProviderCredential = Omit<
  ProviderCredential,
  "secretEncrypted" | "secretHash"
>;

export type ProviderRepositoryOptions = {
  db?: StorageDatabase;
  now?: Date;
};

const createProviderId = () =>
  `provider_${randomBytes(16).toString("base64url")}`;

const createCredentialId = () =>
  `cred_${randomBytes(16).toString("base64url")}`;

export const sanitizeProviderCredential = (
  credential: ProviderCredential,
): SanitizedProviderCredential => ({
  id: credential.id,
  providerId: credential.providerId,
  label: credential.label,
  displayPrefix: credential.displayPrefix,
  displaySuffix: credential.displaySuffix,
  status: credential.status,
  remainingQuota: credential.remainingQuota,
  lastUsedAt: credential.lastUsedAt,
  lastErrorAt: credential.lastErrorAt,
  lastErrorSummary: credential.lastErrorSummary,
  cooldownUntil: credential.cooldownUntil,
  createdAt: credential.createdAt,
  updatedAt: credential.updatedAt,
});

const isCredentialCurrentlyAvailable = (
  credential: ProviderCredential,
  now: Date,
) =>
  (credential.status === "active" &&
    (!credential.cooldownUntil || new Date(credential.cooldownUntil) <= now)) ||
  (credential.status === "cooldown" &&
    !!credential.cooldownUntil &&
    new Date(credential.cooldownUntil) <= now);

const addCredentialSummary = (
  provider: Provider,
  credentials: ProviderCredential[],
  now: Date,
): ProviderWithCredentialSummary => {
  const credentialCount = credentials.length;
  const activeCredentialCount = credentials.filter(
    (credential) => credential.status === "active",
  ).length;
  const availableCredentialCount =
    provider.type === "xunlei"
      ? 1 // xunlei doesn't use credentials — always treat as available
      : credentials.filter((credential) =>
          isCredentialCurrentlyAvailable(credential, now),
        ).length;

  return {
    ...provider,
    credentialCount,
    activeCredentialCount,
    availableCredentialCount,
  };
};

/**
 * Check whether a provider type requires credentials for operation.
 */
export const providerTypeRequiresCredentials = (
  type: string,
): type is "opensubtitles" => type === "opensubtitles";

export class ProviderRepository {
  constructor(private readonly db = getStorageClient().db) {}

  async listProviders(
    filter?: ProviderFilter,
    now = new Date(),
  ): Promise<ProviderWithCredentialSummary[]> {
    const conditions = [];
    if (filter?.type) {
      conditions.push(eq(providers.type, filter.type));
    }
    if (filter?.status) {
      conditions.push(eq(providers.status, filter.status));
    }

    const providerRows = await this.db
      .select()
      .from(providers)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(providers.priority, providers.name);
    const providerIds = providerRows.map((provider: Provider) => provider.id);
    const credentialRows =
      providerIds.length > 0
        ? await this.db
            .select()
            .from(providerCredentials)
            .where(inArray(providerCredentials.providerId, providerIds))
        : [];
    const credentialsByProviderId = new Map<string, ProviderCredential[]>();
    for (const credential of credentialRows) {
      const credentials = credentialsByProviderId.get(credential.providerId);
      if (credentials) {
        credentials.push(credential);
      } else {
        credentialsByProviderId.set(credential.providerId, [credential]);
      }
    }

    return providerRows.map((provider: Provider) =>
      addCredentialSummary(
        provider,
        credentialsByProviderId.get(provider.id) ?? [],
        now,
      ),
    );
  }

  async getProvider(
    providerId: string,
    now = new Date(),
  ): Promise<ProviderDetail | undefined> {
    const [provider] = await this.db
      .select()
      .from(providers)
      .where(eq(providers.id, providerId))
      .limit(1);

    if (!provider) {
      return undefined;
    }

    const credentials = await this.listProviderCredentials(providerId);

    return {
      ...addCredentialSummary(provider, credentials, now),
      credentials: credentials.map(sanitizeProviderCredential),
    };
  }

  async requireProvider(providerId: string, now = new Date()) {
    const provider = await this.getProvider(providerId, now);

    if (!provider) {
      throw new AppError(
        "PROVIDER_UNAVAILABLE",
        "Provider 不存在。",
        "providerId",
      );
    }

    return provider;
  }

  async createProvider(
    input: CreateProviderInput,
    now = new Date(),
  ): Promise<ProviderDetail> {
    const createdAt = now.toISOString();
    const name = input.name.trim();

    if (!name) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Provider 名称不能为空。",
        "name",
      );
    }

    if (input.type === "xunlei") {
      throw new AppError(
        "VALIDATION_FAILED",
        "Xunlei 是预置 Provider，不支持通过创建入口新增。",
        "type",
      );
    }

    let provider: Provider | undefined;

    try {
      provider = await this.db.transaction(async (tx: StorageDatabase) => {
        const [insertedProvider] = await tx
          .insert(providers)
          .values({
            id: createProviderId(),
            name,
            type: input.type,
            status: input.initialCredential ? "enabled" : "needs_config",
            priority: 100,
            weight: 100,
            concurrencyLimit: 1,
            rotationEnabled: true,
            cooldownSeconds: 60,
            fallbackProviderId: null,
            lastHealthStatus: input.initialCredential ? "ready" : null,
            lastErrorSummary: null,
            createdAt,
            updatedAt: createdAt,
          } satisfies NewProvider)
          .returning();

        if (!insertedProvider) {
          throw new AppError("UPSTREAM_FAILED", "创建 Provider 失败。");
        }

        if (input.initialCredential) {
          await tx
            .insert(providerCredentials)
            .values(
              this.buildCredentialInsert(
                insertedProvider.id,
                input.initialCredential,
                createdAt,
              ),
            )
            .returning();
        }

        return insertedProvider;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError(
          "VALIDATION_FAILED",
          "同类型 Provider 名称或凭据已存在。",
          "name",
        );
      }
      if (isConstraintError(error)) {
        throw new AppError(
          "VALIDATION_FAILED",
          "Provider 配置不符合约束。",
          isForeignKeyConstraintError(error)
            ? "fallbackProviderId"
            : "provider",
        );
      }
      throw error;
    }

    if (!provider) {
      throw new AppError("UPSTREAM_FAILED", "创建 Provider 失败。");
    }

    return this.requireProvider(provider.id, now);
  }

  async updateProviderPolicy(
    providerId: string,
    input: Partial<ProviderPolicyInput> & {
      name?: string;
      status?: Provider["status"];
    },
    now = new Date(),
  ): Promise<ProviderDetail> {
    await this.requireProvider(providerId, now);
    const updatedAt = now.toISOString();
    const values: Partial<Provider> = {
      updatedAt,
    };

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new AppError(
          "VALIDATION_FAILED",
          "Provider 名称不能为空。",
          "name",
        );
      }
      values.name = name;
    }
    for (const key of [
      "priority",
      "weight",
      "concurrencyLimit",
      "rotationEnabled",
      "cooldownSeconds",
      "fallbackProviderId",
    ] as const) {
      if (input[key] !== undefined) {
        // Xunlei: rotationEnabled is silently ignored
        if (key === "rotationEnabled" && input[key] !== undefined) {
          const currentProvider = await this.db
            .select()
            .from(providers)
            .where(eq(providers.id, providerId))
            .limit(1)
            .then((rows) => rows[0]);
          if (currentProvider?.type === "xunlei") {
            continue; // silently ignore for xunlei
          }
        }
        values[key] = input[key] as never;
      }
    }

    // Validate fallback target before saving
    if (
      input.fallbackProviderId !== undefined &&
      input.fallbackProviderId !== null
    ) {
      await this.validateFallbackTarget(
        providerId,
        input.fallbackProviderId,
        now,
      );
    }

    if (input.status !== undefined) {
      values.status = input.status;
    }

    try {
      await this.db
        .update(providers)
        .set(values)
        .where(eq(providers.id, providerId));
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError(
          "VALIDATION_FAILED",
          "同类型 Provider 名称已存在。",
          "name",
        );
      }
      if (isConstraintError(error)) {
        throw new AppError(
          "VALIDATION_FAILED",
          "Provider 策略参数不符合约束。",
          isForeignKeyConstraintError(error)
            ? "fallbackProviderId"
            : "provider",
        );
      }
      throw error;
    }

    return this.requireProvider(providerId, now);
  }

  async setProviderStatus(
    providerId: string,
    status: Provider["status"],
    now = new Date(),
  ): Promise<ProviderDetail> {
    await this.requireProvider(providerId, now);

    await this.db
      .update(providers)
      .set({
        status,
        lastHealthStatus:
          status === "enabled"
            ? "ready"
            : status === "degraded"
              ? "degraded"
              : null,
        updatedAt: now.toISOString(),
      })
      .where(eq(providers.id, providerId));

    return this.requireProvider(providerId, now);
  }

  async listProviderCredentials(providerId: string) {
    return this.db
      .select()
      .from(providerCredentials)
      .where(eq(providerCredentials.providerId, providerId))
      .orderBy(providerCredentials.createdAt, providerCredentials.label);
  }

  async addCredential(
    providerId: string,
    input: CreateProviderCredentialInput,
    now = new Date(),
  ): Promise<SanitizedProviderCredential> {
    await this.requireProvider(providerId, now);
    const createdAt = now.toISOString();

    try {
      const [credential] = await this.db
        .insert(providerCredentials)
        .values(this.buildCredentialInsert(providerId, input, createdAt))
        .returning();

      if (!credential) {
        throw new AppError("UPSTREAM_FAILED", "创建 Provider 凭据失败。");
      }

      return sanitizeProviderCredential(credential);
    } catch (error) {
      if (isConstraintError(error)) {
        throw new AppError(
          "VALIDATION_FAILED",
          "同一 Provider 下凭据标签或密钥已存在。",
          "credential",
        );
      }
      throw error;
    }
  }

  async updateCredential(
    providerId: string,
    credentialId: string,
    values: Partial<ProviderCredential>,
    now = new Date(),
  ): Promise<SanitizedProviderCredential> {
    await this.requireCredential(providerId, credentialId);
    const [credential] = await this.db
      .update(providerCredentials)
      .set({ ...values, updatedAt: now.toISOString() })
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

    return sanitizeProviderCredential(credential);
  }

  async requireCredential(providerId: string, credentialId: string) {
    const [credential] = await this.db
      .select()
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.providerId, providerId),
          eq(providerCredentials.id, credentialId),
        ),
      )
      .limit(1);

    if (!credential) {
      throw new AppError(
        "PROVIDER_UNAVAILABLE",
        "Provider 凭据不存在。",
        "credentialId",
      );
    }

    return credential;
  }

  async findByProviderType(
    type: Provider["type"],
    now = new Date(),
  ): Promise<ProviderWithCredentialSummary | undefined> {
    const providers = await this.listProviders({ type }, now);
    return providers[0];
  }

  async updateHealthStatus(
    providerId: string,
    healthStatus: string | null,
    errorSummary: string | null,
    now = new Date(),
  ): Promise<void> {
    await this.db
      .update(providers)
      .set({
        lastHealthStatus: healthStatus,
        lastErrorSummary: errorSummary,
        lastHealthCheckedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      .where(eq(providers.id, providerId));
  }

  async validateFallbackTarget(
    providerId: string,
    fallbackProviderId: string,
    now = new Date(),
  ): Promise<void> {
    // Self-reference check
    if (providerId === fallbackProviderId) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Provider 不能自引用作为 fallback。",
        "fallbackProviderId",
      );
    }

    // Target must exist
    const target = await this.getProvider(fallbackProviderId, now);
    if (!target) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Fallback 目标 Provider 不存在。",
        "fallbackProviderId",
      );
    }

    // Cycle detection: follow the fallback chain to check for cycles
    const visited = new Set<string>([providerId, fallbackProviderId]);
    let currentFallbackId = target.fallbackProviderId;
    while (currentFallbackId) {
      if (visited.has(currentFallbackId)) {
        throw new AppError(
          "VALIDATION_FAILED",
          "Fallback 配置形成循环引用，请检查 provider 的 fallback 链。",
          "fallbackProviderId",
        );
      }
      visited.add(currentFallbackId);

      const currentProvider = await this.db
        .select()
        .from(providers)
        .where(eq(providers.id, currentFallbackId))
        .limit(1)
        .then((rows) => rows[0]);
      if (!currentProvider) break;
      currentFallbackId = currentProvider.fallbackProviderId;
    }
  }

  private buildCredentialInsert(
    providerId: string,
    input: CreateProviderCredentialInput,
    createdAt: string,
  ): NewProviderCredential {
    const label = input.label.trim();
    const secret = input.secret.trim();

    if (!label) {
      throw new AppError("VALIDATION_FAILED", "凭据标签不能为空。", "label");
    }
    if (!secret) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Provider 凭据不能为空。",
        "secret",
      );
    }

    return {
      id: createCredentialId(),
      providerId,
      label,
      secretHash: hashProviderCredentialSecret(secret),
      secretEncrypted: encryptProviderCredentialSecret(secret),
      ...createCredentialDisplayParts(secret),
      status: "active",
      remainingQuota: null,
      lastUsedAt: null,
      lastErrorAt: null,
      lastErrorSummary: null,
      cooldownUntil: null,
      createdAt,
      updatedAt: createdAt,
    };
  }
}
