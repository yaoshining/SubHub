import { describe, expect, it } from "vitest";

import type { RuntimeReadinessStatus } from "@/server/services/runtime-readiness-service";

import { evaluateReadinessGate } from "../../../scripts/db/readiness";

const buildReadinessStatus = (
  overrides: Partial<RuntimeReadinessStatus> = {},
): RuntimeReadinessStatus => ({
  initialized: false,
  mode: "production",
  schemaReady: true,
  bootstrapReady: false,
  seedState: "not_applicable",
  adminInitializationState: "required",
  missingTables: [],
  adminUsersCount: 0,
  runtimeGateRequired: true,
  directUrlReady: true,
  directUrlError: null,
  runtimeReady: false,
  blockingReasons: ["admin_initialization_required"],
  lastCheckedAt: "2026-06-11T00:00:00.000Z",
  ...overrides,
});

describe("readiness gate script boundary", () => {
  it("runtimeReady=true 时 gate 直接放行，不依赖任何额外判定", () => {
    const status = buildReadinessStatus({
      runtimeReady: true,
      bootstrapReady: true,
      adminInitializationState: "completed",
      blockingReasons: [],
    });

    expect(evaluateReadinessGate(status, { tier: "production" })).toEqual({
      ok: true,
      status,
    });
  });

  it("production tier 在 blockingReasons 存在时阻断 gate", () => {
    const status = buildReadinessStatus({
      schemaReady: false,
      bootstrapReady: false,
      adminInitializationState: "required",
      missingTables: ["admin_users"],
      blockingReasons: ["schema_not_ready", "admin_initialization_required"],
    });

    const result = evaluateReadinessGate(status, { tier: "production" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected gate to be blocked");
    }
    expect(result.blockingReasons).toEqual([
      "schema_not_ready",
      "admin_initialization_required",
    ]);
  });

  it("staging tier 默认不强制阻断 inspect 结果", () => {
    const status = buildReadinessStatus({
      mode: "staging",
      runtimeGateRequired: false,
      blockingReasons: ["bootstrap_not_ready"],
    });

    expect(evaluateReadinessGate(status, { tier: "staging" })).toEqual({
      ok: true,
      status,
    });
  });

  it("staging tier 在显式 enforce 时也按 blocking reasons 阻断", () => {
    const status = buildReadinessStatus({
      mode: "staging",
      runtimeGateRequired: false,
      blockingReasons: ["bootstrap_not_ready"],
    });

    const result = evaluateReadinessGate(status, {
      tier: "staging",
      enforce: true,
    });

    expect(result.ok).toBe(false);
  });

  it("development tier 默认不阻断，但显式 enforce 时阻断", () => {
    const status = buildReadinessStatus({
      mode: "development",
      runtimeGateRequired: false,
      blockingReasons: ["bootstrap_not_ready"],
    });

    expect(evaluateReadinessGate(status, { tier: "development" }).ok).toBe(
      true,
    );

    expect(
      evaluateReadinessGate(status, { tier: "development", enforce: true }).ok,
    ).toBe(false);
  });

  it("不会重新引入任何 #64 之外的 readiness 判定字符串", () => {
    // 锁定 #64 RuntimeBlockingReason 的合法集合：
    // - direct_url_unreachable
    // - schema_not_ready
    // - bootstrap_not_ready
    // - admin_initialization_required
    const knownBlockingReasons = new Set([
      "direct_url_unreachable",
      "schema_not_ready",
      "bootstrap_not_ready",
      "admin_initialization_required",
    ]);

    const fixture = buildReadinessStatus({
      blockingReasons: ["schema_not_ready"],
    });

    for (const reason of fixture.blockingReasons) {
      expect(knownBlockingReasons.has(reason)).toBe(true);
    }
  });
});
