import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import { createStorageClient } from "@/server/storage/client";
import { createDirectPostgresClient } from "@/server/storage/postgres-client";
import {
  buildLocalTestDatabaseUrls,
  withLocalTestDatabaseEnvDefaults,
} from "@/server/storage/test-database";
import { adminUsers } from "@/server/storage/schema";

const describeWhenLocalPostgresEnabled =
  process.env.RUN_POSTGRES_TESTS === "true" ? describe : describe.skip;

const truncateAdminTablesSql =
  'TRUNCATE TABLE "admin_action_results", "admin_sessions", "admin_invitations", "admin_users" RESTART IDENTITY CASCADE';

describeWhenLocalPostgresEnabled(
  "StorageClient smoke on local Docker Postgres",
  () => {
    const testEnv = withLocalTestDatabaseEnvDefaults(process.env);
    const { runtimeUrl, directUrl } = buildLocalTestDatabaseUrls();

    let closeDirectClient: (() => Promise<void>) | undefined;
    let directSql:
      | ReturnType<typeof createDirectPostgresClient>["sql"]
      | undefined;

    beforeAll(async () => {
      Object.assign(process.env, testEnv);

      const directClient = createDirectPostgresClient({
        directDatabaseUrl: directUrl,
      });

      directSql = directClient.sql;
      closeDirectClient = () => directClient.close();
    });

    beforeEach(async () => {
      await directSql?.unsafe(truncateAdminTablesSql);
    });

    afterAll(async () => {
      await closeDirectClient?.();
    });

    it("maps runtimeUrl and directUrl to the correct pooled/unpooled endpoints", async () => {
      const client = createStorageClient({
        runtimeDatabaseUrl: runtimeUrl,
        directDatabaseUrl: directUrl,
      });

      try {
        expect(client.runtimeUrl).toBe(runtimeUrl);
        expect(client.directUrl).toBe(directUrl);
      } finally {
        await client.close();
      }
    });

    it("applies schema migration and creates expected tables on the real test database", async () => {
      const client = createStorageClient({
        runtimeDatabaseUrl: runtimeUrl,
        directDatabaseUrl: directUrl,
      });

      try {
        await client.migrate();

        const rows = await client.db
          .select({ id: adminUsers.id })
          .from(adminUsers)
          .limit(1);

        // admin_users table exists — no error, empty result is fine
        expect(Array.isArray(rows)).toBe(true);
      } finally {
        await client.close();
      }
    });

    it("executes a read-write transaction through the runtime connection", async () => {
      const client = createStorageClient({
        runtimeDatabaseUrl: runtimeUrl,
        directDatabaseUrl: directUrl,
      });

      try {
        await client.migrate();

        const now = new Date("2026-06-01T00:00:00.000Z").toISOString();

        const inserted = await client.transaction(async (tx) => {
          const [row] = await tx
            .insert(adminUsers)
            .values({
              id: "admin_smoke_runtime",
              identifier: "smoke-runtime@subhub.dev",
              displayName: "Smoke Runtime",
              passwordHash: "smoke-hash",
              status: "active",
              role: "admin",
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          return row;
        });

        expect(inserted).toMatchObject({
          id: "admin_smoke_runtime",
          identifier: "smoke-runtime@subhub.dev",
          status: "active",
        });

        // Verify through a second read on the runtime path
        const [read] = await client.db
          .select()
          .from(adminUsers)
          .where(eq(adminUsers.id, "admin_smoke_runtime"))
          .limit(1);

        expect(read).toBeDefined();
        expect(read?.identifier).toBe("smoke-runtime@subhub.dev");
      } finally {
        await client.close();
      }
    });

    it("closes both runtime and direct connections without throwing", async () => {
      const client = createStorageClient({
        runtimeDatabaseUrl: runtimeUrl,
        directDatabaseUrl: directUrl,
      });

      await client.migrate();
      await expect(client.close()).resolves.toBeUndefined();
    });

    it("fails fast when the direct/unpooled URL is missing or not a postgres URL", () => {
      expect(() =>
        createStorageClient({
          runtimeDatabaseUrl: runtimeUrl,
          directDatabaseUrl: "",
        }),
      ).toThrow("DATABASE_URL_UNPOOLED 未配置。");

      expect(() =>
        createStorageClient({
          runtimeDatabaseUrl: runtimeUrl,
          directDatabaseUrl: "file:.subhub/subhub.sqlite",
        }),
      ).toThrow("DATABASE_URL_UNPOOLED 必须是 Postgres URL。");
    });
  },
);
