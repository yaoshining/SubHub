import { afterEach, describe, expect, it, vi } from "vitest";

import { runDeploySmoke } from "../../../scripts/deploy/deploy-smoke";

describe("deploy smoke script", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("按顺序校验最小 deploy smoke 入口", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("<!doctype html><html><body>login</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("openapi: 3.1.0\ninfo:\n  title: SubHub API\n", {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { initialized: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    await runDeploySmoke({
      baseUrl: "https://subhub.example.com/",
      tier: "staging",
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://subhub.example.com/login",
      expect.objectContaining({
        headers: { "x-subhub-deploy-smoke-tier": "staging" },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://subhub.example.com/api/openapi.yaml",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://subhub.example.com/api/admin/bootstrap/status",
      expect.any(Object),
    );
  });

  it("在关键入口返回非 2xx 时快速失败", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("<!doctype html><html><body>login</body></html>", {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response("gateway unavailable", {
          status: 503,
        }),
      );

    await expect(
      runDeploySmoke({
        baseUrl: "https://subhub.example.com",
        tier: "production",
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/OpenAPI 文档入口 smoke 失败：HTTP 503/);
  });

  it("要求 bootstrap 状态入口返回可识别的 initialized 布尔值", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("<!doctype html><html><body>login</body></html>", {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response("openapi: 3.1.0\n", {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { initialized: "pending" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    await expect(
      runDeploySmoke({
        baseUrl: "https://subhub.example.com",
        tier: "development",
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(
      /bootstrap 状态入口 smoke 失败：响应未返回 data\.initialized 布尔值/,
    );
  });
});
