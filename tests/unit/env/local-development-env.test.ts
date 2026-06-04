import { describe, expect, it } from "vitest";

import { createLocalDevelopmentEnv } from "../../helpers/env-scenarios";
import { readEnv } from "@/lib/env";

describe("readEnv 本地 development 护栏", () => {
  it("将 DEV_DATABASE_URL / DEV_DATABASE_URL_UNPOOLED 映射为运行时单一 URL 对", () => {
    const env = readEnv(
      createLocalDevelopmentEnv({
        DEV_DATABASE_URL: "dev-pooled-url",
        DEV_DATABASE_URL_UNPOOLED: "dev-direct-url",
      }),
    );

    expect(env).toMatchObject({
      deploymentProvider: "local",
      vercelEnvironment: "none",
      gitBranch: null,
      resolvedTier: "development",
      DATABASE_URL: "dev-pooled-url",
      DATABASE_URL_UNPOOLED: "dev-direct-url",
    });
  });

  it("在 vercel dev 场景下仍然使用 DEV_* 真源", () => {
    const env = readEnv(
      createLocalDevelopmentEnv({
        VERCEL_ENV: "development",
        DEV_DATABASE_URL: "dev-pooled-url",
        DEV_DATABASE_URL_UNPOOLED: "dev-direct-url",
      }),
    );

    expect(env).toMatchObject({
      deploymentProvider: "vercel",
      vercelEnvironment: "development",
      resolvedTier: "development",
      DATABASE_URL: "dev-pooled-url",
      DATABASE_URL_UNPOOLED: "dev-direct-url",
    });
  });

  it("在本地 development 直接注入 DATABASE_URL 时阻断误连", () => {
    expect(() =>
      readEnv(
        createLocalDevelopmentEnv({
          DATABASE_URL: "prod-pooled-url",
          DATABASE_URL_UNPOOLED: "prod-direct-url",
        }),
      ),
    ).toThrowError(/DEV_DATABASE_URL/);
  });

  it("在本地 development 仅注入 DATABASE_URL_UNPOOLED 时也会精确阻断", () => {
    expect(() =>
      readEnv(
        createLocalDevelopmentEnv({
          DEV_DATABASE_URL: undefined,
          DATABASE_URL_UNPOOLED: "prod-direct-url",
        }),
      ),
    ).toThrowError(/DATABASE_URL_UNPOOLED/);
  });

  it("在本地 development 缺少 DEV_* 真源时失败", () => {
    expect(() =>
      readEnv(
        createLocalDevelopmentEnv({
          DEV_DATABASE_URL: "dev-pooled-url",
          DEV_DATABASE_URL_UNPOOLED: undefined,
        }),
      ),
    ).toThrowError(/DEV_DATABASE_URL_UNPOOLED/);
  });
});
