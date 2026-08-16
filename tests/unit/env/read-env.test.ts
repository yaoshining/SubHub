import { describe, expect, it } from "vitest";

import { createLocalTestEnv } from "../../helpers/env-scenarios";
import { readEnv } from "@/lib/env";

describe("readEnv", () => {
  it("exposes postgres runtime and test URLs instead of legacy sqlite path", () => {
    const env = readEnv(
      createLocalTestEnv({
        DATABASE_URL: "postgresql://runtime-user@localhost:5432/subhub",
        DATABASE_URL_UNPOOLED: "postgresql://direct-user@localhost:5432/subhub",
        DATABASE_URL_TEST:
          "postgresql://test-runtime@localhost:5432/subhub_test",
        DATABASE_URL_TEST_UNPOOLED:
          "postgresql://test-direct@localhost:5432/subhub_test",
      }),
    );

    expect(env.DATABASE_URL).toBe(
      "postgresql://runtime-user@localhost:5432/subhub",
    );
    expect(env.DATABASE_URL_UNPOOLED).toBe(
      "postgresql://direct-user@localhost:5432/subhub",
    );
    expect(env).not.toHaveProperty("SQLITE_DATABASE_PATH");
  });

  it("passes through non-url database values in test mode without throwing", () => {
    const env = readEnv(
      createLocalTestEnv({
        DATABASE_URL: "not-a-url",
        DATABASE_URL_UNPOOLED: "postgresql://direct-user@localhost:5432/subhub",
        DATABASE_URL_TEST:
          "postgresql://test-runtime@localhost:5432/subhub_test",
        DATABASE_URL_TEST_UNPOOLED:
          "postgresql://test-direct@localhost:5432/subhub_test",
      }),
    );

    expect(env.DATABASE_URL).toBe("not-a-url");
  });

  it("falls back to default test URLs when dedicated test urls are missing", () => {
    const env = readEnv(
      createLocalTestEnv({
        DATABASE_URL: "postgresql://runtime-user@localhost:5432/subhub",
        DATABASE_URL_UNPOOLED: "postgresql://direct-user@localhost:5432/subhub",
        DATABASE_URL_TEST: undefined,
        DATABASE_URL_TEST_UNPOOLED: undefined,
      }),
    );

    expect(env.DATABASE_URL).toBe(
      "postgresql://runtime-user@localhost:5432/subhub",
    );
    expect(env.DATABASE_URL_UNPOOLED).toBe(
      "postgresql://direct-user@localhost:5432/subhub",
    );
  });

  it("coerces xunlei provider retry/timeout config from string env values", () => {
    const env = readEnv(
      createLocalTestEnv({
        XUNLEI_API_TIMEOUT_MS: "1234",
        XUNLEI_API_MAX_RETRIES: "2",
        XUNLEI_API_RETRY_BACKOFF_MS: "400",
      }),
    );

    expect(env.XUNLEI_API_TIMEOUT_MS).toBe(1234);
    expect(env.XUNLEI_API_MAX_RETRIES).toBe(2);
    expect(env.XUNLEI_API_RETRY_BACKOFF_MS).toBe(400);
  });

  it("falls back to defaults for xunlei provider retry/timeout config", () => {
    const env = readEnv(createLocalTestEnv());

    expect(env.XUNLEI_API_TIMEOUT_MS).toBe(8000);
    expect(env.XUNLEI_API_MAX_RETRIES).toBe(1);
    expect(env.XUNLEI_API_RETRY_BACKOFF_MS).toBe(200);
  });

  it("rejects xunlei timeout above the setTimeout 32-bit ceiling", () => {
    expect(() =>
      readEnv(
        createLocalTestEnv({
          XUNLEI_API_TIMEOUT_MS: "2147483648",
        }),
      ),
    ).toThrow();
  });
});
