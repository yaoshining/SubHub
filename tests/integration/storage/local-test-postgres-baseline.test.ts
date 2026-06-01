import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  localTestPostgresBaseline,
  resolveTestDatabaseUrls,
  withLocalTestDatabaseEnvDefaults,
} from "@/server/storage/test-database";

const describeWhenLocalPostgresEnabled =
  process.env.RUN_POSTGRES_TESTS === "true" ? describe : describe.skip;

describeWhenLocalPostgresEnabled("local Docker Postgres test database", () => {
  const testEnv = withLocalTestDatabaseEnvDefaults(process.env);
  const { runtimeUrl, directUrl } = resolveTestDatabaseUrls();

  let closeStorageClient: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    Object.assign(process.env, testEnv);

    const { createStorageClient } =
      await import("../../../src/server/storage/client.js");

    const client = createStorageClient({
      runtimeDatabaseUrl: runtimeUrl,
      directDatabaseUrl: directUrl,
    });

    closeStorageClient = () => client.close();
    await client.migrate();
  });

  afterAll(async () => {
    await closeStorageClient?.();
  });

  it("migrates schema into the dedicated local test database", async () => {
    const { createDirectPostgresClient } =
      await import("../../../src/server/storage/postgres-client.js");

    const directClient = createDirectPostgresClient({
      directDatabaseUrl: directUrl,
    });

    try {
      const rows = await directClient.sql.unsafe<
        Array<{ current_database: string; admin_users: string | null }>
      >(
        "select current_database() as current_database, to_regclass('public.admin_users')::text as admin_users",
      );

      expect(rows[0]?.current_database).toBe(
        localTestPostgresBaseline.databaseName,
      );
      expect(rows[0]?.admin_users).toBe("admin_users");
    } finally {
      await directClient.close();
    }
  });
});
