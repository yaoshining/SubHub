import { describe, expect, it } from "vitest";
import { createApiRequest } from "../helpers/api";
import { createTestSqlitePath } from "../helpers/db";
import { setViewport, viewportBreakpoints } from "../helpers/ui";

describe("测试辅助工具", () => {
  it("创建 JSON API 请求", async () => {
    const request = createApiRequest("/api/providers", {
      method: "POST",
      json: { name: "opensubtitles" }
    });

    expect(request.url).toBe("http://localhost:3000/api/providers");
    expect(request.headers.get("content-type")).toBe("application/json");
    await expect(request.json()).resolves.toEqual({ name: "opensubtitles" });
  });

  it("提供响应式断点辅助", () => {
    setViewport(viewportBreakpoints.mobile);

    expect(window.innerWidth).toBe(375);
  });

  it("为每个测试生成独立 SQLite 路径", () => {
    expect(createTestSqlitePath("Provider Pool")).toContain(
      ".data/tests/provider-pool.sqlite"
    );
  });
});
