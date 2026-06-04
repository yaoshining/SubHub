/**
 * db-url.ts 单元测试 — 数据库 URL 解析唯一真源
 *
 * 这些测试同时也是"真源一致性回归测试"：
 * 确保 resolveDbUrls / resolvePooledDbUrl / resolveDirectDbUrl 是
 * postgres-client.ts、drizzle.config.ts、数据库脚本共用的唯一规则，
 * 防止未来再次出现各自手写 fallback 的漂移。
 */
import { describe, expect, it } from "vitest";

import {
  isDevEnvironment,
  resolveDbUrls,
  resolveDirectDbUrl,
  resolvePooledDbUrl,
} from "@/lib/db-url";

describe("isDevEnvironment", () => {
  it("本地 development（无 VERCEL_ENV）返回 true", () => {
    expect(isDevEnvironment({ NODE_ENV: "development" })).toBe(true);
  });

  it("Vercel development 返回 true", () => {
    expect(
      isDevEnvironment({ NODE_ENV: "development", VERCEL_ENV: "development" }),
    ).toBe(true);
  });

  it("tsx -e / pnpm db:migrate 场景：NODE_ENV 缺失但注入 DEV_DATABASE_URL* 仍识别为 dev", () => {
    // 这是 db:migrate 报错 "DATABASE_URL 未配置" 的回归测试。
    // 此前实现只看 NODE_ENV=development，导致 tsx -e 运行（无 NODE_ENV）
    // 时误判为 production/preview 分支。
    expect(
      isDevEnvironment({
        DEV_DATABASE_URL: "postgresql://dev@localhost:5432/subhub",
        DEV_DATABASE_URL_UNPOOLED:
          "postgresql://dev@localhost:5432/subhub_direct",
      }),
    ).toBe(true);
  });

  it("未注入 NODE_ENV 但注入了 DATABASE_URL* 时识别为 production/preview", () => {
    expect(
      isDevEnvironment({
        DATABASE_URL: "postgresql://prod@neon.tech:5432/subhub",
        DATABASE_URL_UNPOOLED: "postgresql://prod@neon.tech:5432/subhub_direct",
      }),
    ).toBe(false);
  });

  it("test 环境返回 false（即使 NODE_ENV=development 逻辑无关）", () => {
    expect(isDevEnvironment({ NODE_ENV: "test" })).toBe(false);
  });

  it("Vercel production 返回 false", () => {
    expect(
      isDevEnvironment({ NODE_ENV: "production", VERCEL_ENV: "production" }),
    ).toBe(false);
  });

  it("DEV_* 和 DATABASE_URL* 同时存在时 dev 优先（本地脚本场景）", () => {
    // 模拟 .env.production.local 漏出 DATABASE_URL* 的场景
    expect(
      isDevEnvironment({
        DEV_DATABASE_URL: "postgresql://dev@localhost:5432/subhub",
        DEV_DATABASE_URL_UNPOOLED:
          "postgresql://dev@localhost:5432/subhub_direct",
        DATABASE_URL: "postgresql://prod@neon.tech:5432/subhub",
        DATABASE_URL_UNPOOLED: "postgresql://prod@neon.tech:5432/subhub_direct",
      }),
    ).toBe(true);
  });

  it("Vercel preview 返回 false", () => {
    expect(
      isDevEnvironment({ NODE_ENV: "production", VERCEL_ENV: "preview" }),
    ).toBe(false);
  });
});

describe("resolveDbUrls — 本地 development", () => {
  it("使用 DEV_DATABASE_URL / DEV_DATABASE_URL_UNPOOLED", () => {
    const result = resolveDbUrls({
      NODE_ENV: "development",
      DEV_DATABASE_URL: "postgresql://dev@localhost:5432/subhub_dev",
      DEV_DATABASE_URL_UNPOOLED:
        "postgresql://dev@localhost:5432/subhub_dev_direct",
    });

    expect(result).toEqual({
      pooledUrl: "postgresql://dev@localhost:5432/subhub_dev",
      directUrl: "postgresql://dev@localhost:5432/subhub_dev_direct",
    });
  });

  it("tsx -e / pnpm db:migrate 场景：NODE_ENV 缺失但只注入 DEV_* 时使用 DEV_*", () => {
    // 回归测试：之前 db:migrate 报错 "DATABASE_URL 未配置" 就是因为
    // 误判环境。修复后应正确走 DEV_* 分支。
    const result = resolveDbUrls({
      DEV_DATABASE_URL: "postgresql://dev@localhost:5432/subhub_dev",
      DEV_DATABASE_URL_UNPOOLED:
        "postgresql://dev@localhost:5432/subhub_dev_direct",
    });

    expect(result).toEqual({
      pooledUrl: "postgresql://dev@localhost:5432/subhub_dev",
      directUrl: "postgresql://dev@localhost:5432/subhub_dev_direct",
    });
  });

  it("本地 dev 缺少 DEV_DATABASE_URL 时抛出含 DEV_DATABASE_URL 的错误", () => {
    expect(() =>
      resolveDbUrls({
        NODE_ENV: "development",
        DEV_DATABASE_URL_UNPOOLED: "postgresql://dev@localhost:5432/direct",
      }),
    ).toThrow(/DEV_DATABASE_URL/);
  });

  it("本地 dev 缺少 DEV_DATABASE_URL_UNPOOLED 时抛出含 DEV_DATABASE_URL_UNPOOLED 的错误", () => {
    expect(() =>
      resolveDbUrls({
        NODE_ENV: "development",
        DEV_DATABASE_URL: "postgresql://dev@localhost:5432/subhub",
      }),
    ).toThrow(/DEV_DATABASE_URL_UNPOOLED/);
  });
});

describe("resolveDbUrls — Vercel development", () => {
  it("VERCEL_ENV=development 也使用 DEV_DATABASE_URL*", () => {
    const result = resolveDbUrls({
      NODE_ENV: "development",
      VERCEL_ENV: "development",
      DEV_DATABASE_URL: "postgresql://dev@localhost:5432/vercel_dev",
      DEV_DATABASE_URL_UNPOOLED:
        "postgresql://dev@localhost:5432/vercel_dev_direct",
    });

    expect(result).toEqual({
      pooledUrl: "postgresql://dev@localhost:5432/vercel_dev",
      directUrl: "postgresql://dev@localhost:5432/vercel_dev_direct",
    });
  });
});

describe("resolveDbUrls — Vercel production / preview", () => {
  it("production 使用 DATABASE_URL / DATABASE_URL_UNPOOLED", () => {
    const result = resolveDbUrls({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      DATABASE_URL: "postgresql://prod@neon.tech:5432/subhub",
      DATABASE_URL_UNPOOLED:
        "postgresql://prod@neon.tech:5432/subhub?sslmode=require",
    });

    expect(result).toEqual({
      pooledUrl: "postgresql://prod@neon.tech:5432/subhub",
      directUrl: "postgresql://prod@neon.tech:5432/subhub?sslmode=require",
    });
  });

  it("preview 使用 DATABASE_URL / DATABASE_URL_UNPOOLED", () => {
    const result = resolveDbUrls({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      DATABASE_URL: "postgresql://preview@neon.tech:5432/subhub_preview",
      DATABASE_URL_UNPOOLED:
        "postgresql://preview@neon.tech:5432/subhub_preview_direct",
    });

    expect(result).toEqual({
      pooledUrl: "postgresql://preview@neon.tech:5432/subhub_preview",
      directUrl: "postgresql://preview@neon.tech:5432/subhub_preview_direct",
    });
  });

  it("production 缺少 DATABASE_URL 时抛出明确错误", () => {
    expect(() =>
      resolveDbUrls({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        DATABASE_URL_UNPOOLED: "postgresql://prod@neon.tech:5432/direct",
      }),
    ).toThrow(/DATABASE_URL/);
  });
});

describe("resolveDbUrls — test 环境", () => {
  it("NODE_ENV=test 使用 DATABASE_URL（可为占位符）", () => {
    const result = resolveDbUrls({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test@localhost:5432/subhub_test",
      DATABASE_URL_UNPOOLED: "postgresql://test@localhost:5432/subhub_test",
    });

    expect(result.pooledUrl).toBe(
      "postgresql://test@localhost:5432/subhub_test",
    );
    expect(result.directUrl).toBe(
      "postgresql://test@localhost:5432/subhub_test",
    );
  });
});

describe("resolvePooledDbUrl / resolveDirectDbUrl — 便捷函数", () => {
  it("resolvePooledDbUrl 返回 pooledUrl", () => {
    expect(
      resolvePooledDbUrl({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        DATABASE_URL: "postgresql://prod@neon.tech:5432/subhub",
        DATABASE_URL_UNPOOLED: "postgresql://prod@neon.tech:5432/subhub_direct",
      }),
    ).toBe("postgresql://prod@neon.tech:5432/subhub");
  });

  it("resolveDirectDbUrl 返回 directUrl", () => {
    expect(
      resolveDirectDbUrl({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        DATABASE_URL: "postgresql://prod@neon.tech:5432/subhub",
        DATABASE_URL_UNPOOLED: "postgresql://prod@neon.tech:5432/subhub_direct",
      }),
    ).toBe("postgresql://prod@neon.tech:5432/subhub_direct");
  });
});

/**
 * 真源一致性回归测试
 *
 * 防止未来 postgres-client.ts、drizzle.config.ts 再次私自分叉出独立 fallback 规则。
 * 这些测试明确约定"本地 dev 必须使用 DEV_DATABASE_URL*"这一行为由
 * db-url.ts 统一决定，而不是由各调用方各自实现。
 */
describe("真源一致性回归测试", () => {
  it("本地 dev 环境传入 DATABASE_URL 不会被静默接受（必须使用 DEV_DATABASE_URL）", () => {
    // 模拟有人误在本地 dev 设置了 DATABASE_URL（可能是生产 URL）
    // 正确行为：resolveDbUrls 应该忽略 DATABASE_URL，只用 DEV_*
    // 若 DEV_* 未设置，应报错，而不是静默 fallback 到 DATABASE_URL
    expect(() =>
      resolveDbUrls({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://prod@neon.tech:5432/subhub", // 误设的生产 URL
        DATABASE_URL_UNPOOLED: "postgresql://prod@neon.tech:5432/direct",
        // 无 DEV_* 变量
      }),
    ).toThrow(/DEV_DATABASE_URL/);
  });

  it("dev 环境不会误读 DEV_DATABASE_URL 作为 production URL", () => {
    // 验证 production 环境不受 DEV_* 变量影响
    const result = resolveDbUrls({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      DATABASE_URL: "postgresql://prod@neon.tech:5432/prod",
      DATABASE_URL_UNPOOLED: "postgresql://prod@neon.tech:5432/prod_direct",
      DEV_DATABASE_URL: "postgresql://dev@localhost:5432/dev", // 不应被使用
      DEV_DATABASE_URL_UNPOOLED: "postgresql://dev@localhost:5432/dev_direct",
    });

    expect(result.pooledUrl).toBe("postgresql://prod@neon.tech:5432/prod");
    expect(result.directUrl).toBe(
      "postgresql://prod@neon.tech:5432/prod_direct",
    );
  });
});
