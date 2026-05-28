import { randomBytes } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { AppError } from "@/lib/errors";
import {
  getStorageClient,
  type StorageDatabase,
} from "@/server/storage/client";
import {
  providerCredentials,
  providers,
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

const isSqliteConstraintError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  String(error.code).startsWith("SQLITE_CONSTRAINT");

const isSqliteUniqueConstraintError = (error: unknown) =>
  isSqliteConstraintError(error) &&
  (String((error as { code?: unknown }).code) === "SQLITE_CONSTRAINT_UNIQUE" ||
    String((error as { message?: unknown }).message).includes(
      "UNIQUE constraint failed",
    ));

const isSqliteForeignKeyConstraintError = (error: unknown) =>
  isSqliteConstraintError(error) &&
  (String((error as { code?: unknown }).code) ===
    "SQLITE_CONSTRAINT_FOREIGNKEY" ||
    String((error as { message?: unknown }).message).includes(
      "FOREIGN KEY constraint failed",
    ));

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
    (!credential.cooldownUntil ||
      new Date(credential.cooldownUntil) <= now)) ||
  (credential.status === "cooldown" &&
    !!credential.cooldownUntil &&
    new Date(credential.cooldownUntil) <= now);

const addCredentialSummary = (
  provider: Provider,
  credentials: ProviderCredential[],
  now: Date,
): ProviderWithCredentialSummary => ({
  ...provider,
  credentialCount: credentials.length,
  activeCredentialCount: credentials.filter(
    (credential) => credential.status === "active",
  ).length,
  availableCredentialCount: credentials.filter((credential) =>
    isCredentialCurrentlyAvailable(credential, now),
  ).length,
});

export class ProviderRepository {
  constructor(private readonly db = getStorageClient().db) {}

  async listProviders(
    now = new Date(),
  ): Promise<ProviderWithCredentialSummary[]> {
    const providerRows = await this.db
      .select()
      .from(providers)
      .orderBy(providers.priority, providers.name);
    const providerIds = providerRows.map((provider) => provider.id);
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

    return providerRows.map((provider) =>
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

    let provider: Provider | undefined;

    try {
      provider = this.db.transaction((tx) => {
        const [insertedProvider] = tx
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
          .returning()
          .all();

        if (!insertedProvider) {
          throw new AppError("UPSTREAM_FAILED", "创建 Provider 失败。");
        }

        if (input.initialCredential) {
          tx.insert(providerCredentials)
            .values(
              this.buildCredentialInsert(
                insertedProvider.id,
                input.initialCredential,
                createdAt,
              ),
            )
            .run();
        }

        return insertedProvider;
      });
    } catch (error) {
      if (isSqliteUniqueConstraintError(error)) {
        throw new AppError(
          "VALIDATION_FAILED",
          "同类型 Provider 名称或凭据已存在。",
          "name",
        );
      }
      if (isSqliteConstraintError(error)) {
        throw new AppError(
          "VALIDATION_FAILED",
          "Provider 配置不符合约束。",
          isSqliteForeignKeyConstraintError(error)
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
    input: Partial<ProviderPolicyInput> & { name?: string },
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
        values[key] = input[key] as never;
      }
    }

    try {
      await this.db
        .update(providers)
        .set(values)
        .where(eq(providers.id, providerId));
    } catch (error) {
      if (isSqliteUniqueConstraintError(error)) {
        throw new AppError(
          "VALIDATION_FAILED",
          "同类型 Provider 名称已存在。",
          "name",
        );
      }
      if (isSqliteConstraintError(error)) {
        throw new AppError(
          "VALIDATION_FAILED",
          "Provider 策略参数不符合约束。",
          isSqliteForeignKeyConstraintError(error)
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
      if (isSqliteConstraintError(error)) {
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
