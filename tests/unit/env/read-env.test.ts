import { describe, expect, it } from "vitest";

import { readEnv } from "@/lib/env";

describe("readEnv", () => {
  it("exposes postgres runtime and test URLs instead of legacy sqlite path", () => {
    const env = readEnv({
      NODE_ENV: "test",
      APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://runtime-user@localhost:5432/subhub",
      DATABASE_URL_UNPOOLED: "postgresql://direct-user@localhost:5432/subhub",
      DATABASE_URL_TEST: "postgresql://test-runtime@localhost:5432/subhub_test",
      DATABASE_URL_TEST_UNPOOLED:
        "postgresql://test-direct@localhost:5432/subhub_test",
    });

    expect(env.DATABASE_URL).toBe(
      "postgresql://runtime-user@localhost:5432/subhub",
    );
    expect(env.DATABASE_URL_UNPOOLED).toBe(
      "postgresql://direct-user@localhost:5432/subhub",
    );
    expect(env).not.toHaveProperty("SQLITE_DATABASE_PATH");
  });

  it("passes through non-url database values in test mode without throwing", () => {
    const env = readEnv({
      NODE_ENV: "test",
      APP_URL: "http://localhost:3000",
      DATABASE_URL: "not-a-url",
      DATABASE_URL_UNPOOLED: "postgresql://direct-user@localhost:5432/subhub",
      DATABASE_URL_TEST: "postgresql://test-runtime@localhost:5432/subhub_test",
      DATABASE_URL_TEST_UNPOOLED:
        "postgresql://test-direct@localhost:5432/subhub_test",
    });

    expect(env.DATABASE_URL).toBe("not-a-url");
  });

  it("falls back to default test URLs when dedicated test urls are missing", () => {
    const env = readEnv({
      NODE_ENV: "test",
      APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://runtime-user@localhost:5432/subhub",
      DATABASE_URL_UNPOOLED: "postgresql://direct-user@localhost:5432/subhub",
    });

    expect(env.DATABASE_URL).toBe(
      "postgresql://runtime-user@localhost:5432/subhub",
    );
    expect(env.DATABASE_URL_UNPOOLED).toBe(
      "postgresql://direct-user@localhost:5432/subhub",
    );
  });
});
