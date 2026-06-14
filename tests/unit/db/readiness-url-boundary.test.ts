import { describe, expect, it } from "vitest";

import { resolveReadinessClientOptions } from "../../../scripts/db/readiness";

describe("db readiness script URL boundary", () => {
  it("runtime 读路径走 pooled DATABASE_URL，direct 路径走 unpooled DATABASE_URL_UNPOOLED", () => {
    expect(
      resolveReadinessClientOptions({
        DATABASE_URL: "postgresql://runtime-user@localhost:5432/subhub",
        DATABASE_URL_UNPOOLED: "postgresql://direct-user@localhost:5432/subhub",
      }),
    ).toEqual({
      runtimeDatabaseUrl: "postgresql://runtime-user@localhost:5432/subhub",
      directDatabaseUrl: "postgresql://direct-user@localhost:5432/subhub",
    });
  });

  it("不把 runtime 读查询错误地绑到 unpooled 连接", () => {
    const result = resolveReadinessClientOptions({
      DATABASE_URL: "postgresql://runtime-user@localhost:5432/subhub",
      DATABASE_URL_UNPOOLED: "postgresql://direct-user@localhost:5432/subhub",
    });

    expect(result.runtimeDatabaseUrl).not.toBe(result.directDatabaseUrl);
    expect(result.runtimeDatabaseUrl).toBe(
      "postgresql://runtime-user@localhost:5432/subhub",
    );
    expect(result.directDatabaseUrl).toBe(
      "postgresql://direct-user@localhost:5432/subhub",
    );
  });
});
