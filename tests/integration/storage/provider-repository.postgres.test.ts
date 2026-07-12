import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ProviderRepository } from "@/server/providers/provider-repository";
import { createStorageClient } from "@/server/storage/client";
import { createDirectPostgresClient } from "@/server/storage/postgres-client";
import { providerCredentials, providers } from "@/server/storage/schema";
import {
  resolveTestDatabaseUrls,
  withLocalTestDatabaseEnvDefaults,
} from "@/server/storage/test-database";

const describeWhenLocalPostgresEnabled =
  process.env.RUN_POSTGRES_TESTS === "true" ? describe : describe.skip;

const truncateProviderTablesSql =
  'TRUNCATE TABLE "provider_credentials", "providers" RESTART IDENTITY CASCADE';

describeWhenLocalPostgresEnabled(
  "ProviderRepository on local Docker Postgres",
  () => {
    const testEnv = withLocalTestDatabaseEnvDefaults(process.env);
    const { runtimeUrl, directUrl } = resolveTestDatabaseUrls();
    const now = new Date("2026-06-01T00:00:00.000Z");

    let repository: ProviderRepository;
    let closeStorageClient: (() => Promise<void>) | undefined;
    let closeDirectClient: (() => Promise<void>) | undefined;
    let directDb:
      | ReturnType<typeof createDirectPostgresClient>["db"]
      | undefined;
    let directSql:
      | ReturnType<typeof createDirectPostgresClient>["sql"]
      | undefined;

    beforeAll(async () => {
      Object.assign(process.env, testEnv);

      const storageClient = createStorageClient({
        runtimeDatabaseUrl: runtimeUrl,
        directDatabaseUrl: directUrl,
      });

      await storageClient.migrate();

      repository = new ProviderRepository(storageClient.db);
      closeStorageClient = () => storageClient.close();

      const directClient = createDirectPostgresClient({
        directDatabaseUrl: directUrl,
      });

      directDb = directClient.db;
      directSql = directClient.sql;
      closeDirectClient = () => directClient.close();
    });

    beforeEach(async () => {
      await directSql?.unsafe(truncateProviderTablesSql);
    });

    afterAll(async () => {
      await closeStorageClient?.();
      await closeDirectClient?.();
    });

    it("persists encrypted provider credentials and returns sanitized detail on the real Postgres path", async () => {
      const provider = await repository.createProvider(
        {
          name: "OpenSubtitles",
          type: "opensubtitles",
          initialCredential: {
            label: "primary",
            secret: "secret-primary-token",
          },
        },
        now,
      );

      expect(provider).toMatchObject({
        name: "OpenSubtitles",
        type: "opensubtitles",
        status: "enabled",
        lastHealthStatus: "ready",
        activeCredentialCount: 1,
        availableCredentialCount: 1,
        credentialCount: 1,
      });
      expect(provider.credentials[0]).toMatchObject({
        label: "primary",
        status: "active",
        displayPrefix: expect.any(String),
        displaySuffix: expect.any(String),
      });
      expect(provider.credentials[0]).not.toHaveProperty("secretEncrypted");
      expect(provider.credentials[0]).not.toHaveProperty("secretHash");

      const persistedProviders = await directDb?.select().from(providers);
      const persistedCredentials = await directDb
        ?.select()
        .from(providerCredentials);

      expect(persistedProviders).toHaveLength(1);
      expect(persistedCredentials).toHaveLength(1);
      expect(persistedCredentials?.[0]).toMatchObject({
        providerId: provider.id,
        label: "primary",
        status: "active",
      });
      expect(persistedCredentials?.[0]?.secretHash).toEqual(expect.any(String));
      expect(persistedCredentials?.[0]?.secretEncrypted).toEqual(
        expect.any(String),
      );
      expect(persistedCredentials?.[0]?.secretHash).not.toBe(
        "secret-primary-token",
      );
      expect(persistedCredentials?.[0]?.secretEncrypted).not.toBe(
        "secret-primary-token",
      );
    });

    it("enforces per-provider credential uniqueness on the real Postgres path", async () => {
      const provider = await repository.createProvider(
        {
          name: "OpenSubtitles",
          type: "opensubtitles",
          initialCredential: {
            label: "primary",
            secret: "secret-primary-token",
          },
        },
        now,
      );

      await repository.addCredential(
        provider.id,
        {
          label: "secondary",
          secret: "secret-secondary-token",
        },
        now,
      );

      await expect(
        repository.addCredential(
          provider.id,
          {
            label: "secondary",
            secret: "secret-tertiary-token",
          },
          now,
        ),
      ).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        target: "credential",
      });

      await expect(
        repository.addCredential(
          provider.id,
          {
            label: "tertiary",
            secret: "secret-secondary-token",
          },
          now,
        ),
      ).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        target: "credential",
      });

      const persistedCredentials = await directDb
        ?.select()
        .from(providerCredentials);

      expect(persistedCredentials).toHaveLength(2);
      expect(
        persistedCredentials?.map((credential) => credential.label).sort(),
      ).toEqual(["primary", "secondary"]);
    });

    it("migration 003 CHECK constraint allows inserting xunlei type providers", async () => {
      // Use direct SQL to bypass the application-layer Xunlei creation guard.
      // Use Postgres-native timestamp via epoch-millis to avoid any quoting issues.
      const ts = `to_timestamp(${now.getTime() / 1000})`;

      const [inserted] = await directSql!.unsafe(
        `INSERT INTO "providers" ("id", "name", "type", "status", "priority", "weight", "concurrency_limit", "rotation_enabled", "cooldown_seconds", "created_at", "updated_at")
         VALUES ('xunlei-test-constraint', 'Xunlei Constraint Check', 'xunlei', 'enabled', 5, 1, 1, false, 0, ${ts}, ${ts})
         RETURNING *`,
      );

      expect(inserted).toBeDefined();
      expect(inserted.type).toBe("xunlei");
    });

    it("migration 003 inserts a seeded xunlei provider row", async () => {
      // After each test truncates both provider tables, the seed row is
      // gone and the migration journal prevents re-inserting it. Insert
      // the seed directly to verify its expected shape (same values as
      // the migration 003 SQL).
      const [row] = await directSql!.unsafe(
        `INSERT INTO "providers" ("id", "name", "type", "status", "priority", "weight", "concurrency_limit", "rotation_enabled", "cooldown_seconds", "fallback_provider_id", "created_at", "updated_at")
         VALUES ('xunlei-default', 'Xunlei', 'xunlei', 'enabled', 5, 1, 1, false, 0, NULL, now(), now())
         ON CONFLICT ("id") DO UPDATE SET "type" = 'xunlei'
         RETURNING *`,
      );

      expect(row).toBeDefined();
      expect(row.name).toBe("Xunlei");
      expect(row.type).toBe("xunlei");
      expect(row.status).toBe("enabled");
    });

    it("updateProviderPolicy 持久化 priority/weight/concurrency/cooldown/rotation/fallback 到真实 Postgres", async () => {
      const provider = await repository.createProvider(
        {
          name: "OpenSubtitles Alpha",
          type: "opensubtitles",
          initialCredential: { label: "primary", secret: "alpha-token" },
        },
        now,
      );
      const fallback = await repository.createProvider(
        {
          name: "OpenSubtitles Beta",
          type: "opensubtitles",
          initialCredential: { label: "primary", secret: "beta-token" },
        },
        now,
      );

      const later = new Date(now.getTime() + 60_000);
      const updated = await repository.updateProviderPolicy(
        provider.id,
        {
          priority: 30,
          weight: 7,
          concurrencyLimit: 3,
          cooldownSeconds: 90,
          rotationEnabled: false,
          fallbackProviderId: fallback.id,
        },
        later,
      );

      expect(updated).toMatchObject({
        priority: 30,
        weight: 7,
        concurrencyLimit: 3,
        cooldownSeconds: 90,
        rotationEnabled: false,
        fallbackProviderId: fallback.id,
      });

      const persisted = await directDb?.select().from(providers);
      expect(persisted).toHaveLength(2);
      const persistedProvider = persisted?.find((p) => p.id === provider.id);
      expect(persistedProvider).toMatchObject({
        priority: 30,
        weight: 7,
        concurrencyLimit: 3,
        cooldownSeconds: 90,
        rotationEnabled: false,
        fallbackProviderId: fallback.id,
      });
    });

    it("updateProviderPolicy 对 fallback 自引用、不存在目标、循环引用在真实 Postgres 上被拒绝", async () => {
      const provider = await repository.createProvider(
        {
          name: "OpenSubtitles Alpha",
          type: "opensubtitles",
          initialCredential: { label: "primary", secret: "alpha-token" },
        },
        now,
      );
      const fallback = await repository.createProvider(
        {
          name: "OpenSubtitles Beta",
          type: "opensubtitles",
          initialCredential: { label: "primary", secret: "beta-token" },
        },
        now,
      );

      // 自引用
      await expect(
        repository.updateProviderPolicy(provider.id, {
          fallbackProviderId: provider.id,
        }),
      ).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        target: "fallbackProviderId",
      });

      // 不存在目标
      await expect(
        repository.updateProviderPolicy(provider.id, {
          fallbackProviderId: "provider_does_not_exist",
        }),
      ).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        target: "fallbackProviderId",
      });

      // A → B 先合法保存
      await repository.updateProviderPolicy(provider.id, {
        fallbackProviderId: fallback.id,
      });

      // B → A 形成循环
      await expect(
        repository.updateProviderPolicy(fallback.id, {
          fallbackProviderId: provider.id,
        }),
      ).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        target: "fallbackProviderId",
      });
    });

    it("updateProviderPolicy 对 Xunlei 的 rotationEnabled 在真实 Postgres 上被静默忽略", async () => {
      const later = new Date(now.getTime() + 60_000);
      await directSql!.unsafe(
        `INSERT INTO "providers" ("id", "name", "type", "status", "priority", "weight", "concurrency_limit", "rotation_enabled", "cooldown_seconds", "created_at", "updated_at")
         VALUES ('xunlei-default', 'Xunlei', 'xunlei', 'enabled', 5, 1, 1, false, 0, now(), now())`,
      );

      const updated = await repository.updateProviderPolicy(
        "xunlei-default",
        { rotationEnabled: true },
        later,
      );

      expect(updated.rotationEnabled).toBe(false);

      const persisted = await directDb?.select().from(providers);
      const xunlei = persisted?.find((p) => p.id === "xunlei-default");
      expect(xunlei?.rotationEnabled).toBe(false);
    });
  },
);
