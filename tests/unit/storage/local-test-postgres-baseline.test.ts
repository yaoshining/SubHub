import { describe, expect, it } from "vitest";

import {
  buildLocalTestDatabaseUrls,
  localTestPostgresBaseline,
  withLocalTestDatabaseEnvDefaults,
} from "@/server/storage/test-database";

describe("local Docker Postgres test baseline", () => {
  it("defines a dedicated local Docker Postgres baseline for test database", () => {
    expect(localTestPostgresBaseline).toMatchObject({
      containerName: "subhub-postgres-test",
      image: "postgres:16-alpine",
      hostPort: 55432,
      databaseName: "subhub_test",
      username: "subhub_test",
      password: "subhub_test_password",
    });
  });

  it("builds dedicated runtime and direct urls for the local test database", () => {
    expect(buildLocalTestDatabaseUrls()).toEqual({
      runtimeUrl:
        "postgresql://subhub_test:subhub_test_password@127.0.0.1:55432/subhub_test",
      directUrl:
        "postgresql://subhub_test:subhub_test_password@127.0.0.1:55432/subhub_test",
    });
  });

  it("fills DATABASE_URL_TEST defaults without mutating existing explicit values", () => {
    const env = withLocalTestDatabaseEnvDefaults(
      { DATABASE_URL_TEST: "postgresql://custom-runtime@127.0.0.1:9999/custom_test" } as unknown as NodeJS.ProcessEnv,
    );

    expect(env.DATABASE_URL_TEST).toBe(
      "postgresql://custom-runtime@127.0.0.1:9999/custom_test",
    );
    expect(env.DATABASE_URL_TEST_UNPOOLED).toBe(
      "postgresql://subhub_test:subhub_test_password@127.0.0.1:55432/subhub_test",
    );
  });
});
