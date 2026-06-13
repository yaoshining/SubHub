import { afterEach, describe, expect, it, vi } from "vitest";

import { runDeploySmoke } from "../../../scripts/deploy/deploy-smoke";

const buildProductionReadyPayload = () => ({
  data: {
    initialized: true,
    mode: "production",
    schemaReady: true,
    bootstrapReady: true,
    seedState: "not_applicable",
    adminInitializationState: "completed",
    missingTables: [],
    adminUsersCount: 1,
    runtimeGateRequired: true,
    directUrlReady: true,
    directUrlError: null,
    runtimeReady: true,
    blockingReasons: [],
    lastCheckedAt: "2026-06-11T00:00:00.000Z",
  },
});

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

  it("要求非 production tier 的 bootstrap 状态入口返回可识别的 initialized 布尔值", async () => {
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

  it("production tier 消费 #64 readiness 信号，runtimeReady=true 时通过 deploy gate", async () => {
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
        new Response(JSON.stringify(buildProductionReadyPayload()), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    await expect(
      runDeploySmoke({
        baseUrl: "https://subhub.example.com",
        tier: "production",
        fetchImpl: fetchMock,
      }),
    ).resolves.toBeUndefined();
  });

  it("production tier 在 runtimeReady=false 时阻断 deploy gate 并报告 blocking reasons", async () => {
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
        new Response(
          JSON.stringify({
            data: {
              ...buildProductionReadyPayload().data,
              runtimeReady: false,
              schemaReady: false,
              bootstrapReady: false,
              adminInitializationState: "required",
              blockingReasons: ["schema_not_ready"],
              missingTables: ["admin_users"],
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    await expect(
      runDeploySmoke({
        baseUrl: "https://subhub.example.com",
        tier: "production",
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/production runtime readiness 未通过.*schema_not_ready/);
  });

  it("production tier 在缺少 #64 readiness 字段时快速失败", async () => {
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
        new Response(
          JSON.stringify({ data: { initialized: true, runtimeReady: true } }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    await expect(
      runDeploySmoke({
        baseUrl: "https://subhub.example.com",
        tier: "production",
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/缺少 data\.runtimeGateRequired/);
  });
});
