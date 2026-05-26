import { describe, expect, it } from "vitest";
import { getServerEnv } from "@/lib/env";

const baseEnv = {} as NodeJS.ProcessEnv;

describe("getServerEnv", () => {
  it("在测试环境使用独立 SQLite 测试数据库", () => {
    const env = getServerEnv({ ...baseEnv, NODE_ENV: "test" });

    expect(env.nodeEnv).toBe("test");
    expect(env.sqlitePath).toContain("subhub.test.sqlite");
  });

  it("读取显式 SQLite 路径与 Provider 凭据加密密钥", () => {
    const env = getServerEnv({
      ...baseEnv,
      NODE_ENV: "development",
      SUBHUB_SQLITE_PATH: "/tmp/subhub.sqlite",
      PROVIDER_CREDENTIALS_ENCRYPTION_KEY: "test-key"
    });

    expect(env.sqlitePath).toBe("/tmp/subhub.sqlite");
    expect(env.providerCredentialsEncryptionKey).toBe("test-key");
  });

  it("生产环境缺少 Provider 凭据加密密钥时阻止启动", () => {
    expect(() => getServerEnv({ ...baseEnv, NODE_ENV: "production" })).toThrow(
      "PROVIDER_CREDENTIALS_ENCRYPTION_KEY"
    );
  });
});
