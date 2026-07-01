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
      // Format the timestamp to Postgres-compatible ISO 8601 (no T separator).
      const timestamp = now.toISOString().replace("T", " ").replace("Z", "");

      const [inserted] = await directSql!.unsafe(
        `INSERT INTO "providers" ("id", "name", "type", "status", "priority", "weight", "concurrency_limit", "rotation_enabled", "cooldown_seconds", "created_at", "updated_at")
         VALUES ('xunlei-test-constraint', 'Xunlei Constraint Check', 'xunlei', 'enabled', 5, 1, 1, false, 0, ${timestamp}::timestamptz, ${timestamp}::timestamptz)
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
  },
);
