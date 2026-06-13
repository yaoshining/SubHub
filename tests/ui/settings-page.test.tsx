import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsClient } from "@/app/(admin)/settings/settings-client";
import { fetchSettingsStatus } from "@/lib/api/settings";
import type { SettingsStatus } from "@/lib/api/settings";
import { AppError } from "@/lib/errors";
import { renderWithTheme } from "../helpers/ui";

vi.mock("@/lib/api/settings", () => ({
  fetchSettingsStatus: vi.fn(),
}));

const mockedFetchSettingsStatus = vi.mocked(fetchSettingsStatus);

const settingsStatus: SettingsStatus = {
  environment: "production",
  version: "0.1.0",
  adminInitialized: true,
  activeProviderCount: 1,
  activeCallerKeyCount: 1,
  gatewayReady: true,
  runtimeGateRequired: true,
  runtimeReady: true,
  schemaReady: true,
  bootstrapReady: true,
  adminInitializationState: "completed",
  directUrlReady: true,
  directUrlError: null,
  blockingReasons: [],
  missingConditions: [],
  lastCheckedAt: "2026-05-30T12:00:00.000Z",
  partialErrors: [],
};

describe("Settings 页面体验", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("展示只读状态卡、配置分流并且没有保存动作", () => {
    renderWithTheme(<SettingsClient initialStatus={settingsStatus} />);

    expect(
      screen.getByText("当前页只做状态确认与配置分流"),
    ).toBeInTheDocument();
    expect(screen.getByText("统一出口已就绪")).toBeInTheDocument();
    expect(screen.getAllByText("部署环境")).toHaveLength(2);
    expect(screen.getAllByText("系统版本")).toHaveLength(2);
    expect(screen.getByText("服务商详情")).toBeInTheDocument();
    expect(screen.getByText("API 密钥")).toBeInTheDocument();
    expect(screen.getByText("用户")).toBeInTheDocument();
    expect(screen.getAllByText("访问控制")).toHaveLength(2);
    expect(screen.getByText("缓存治理")).toBeInTheDocument();
    expect(screen.getByText("镜像策略 / 媒体同步")).toBeInTheDocument();
    expect(screen.getByText("高级系统策略")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /保存|提交/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "前往服务商页" })).toHaveAttribute(
      "href",
      "/providers",
    );
  });

  it("未就绪时优先说明缺失条件并给出明确分流入口", () => {
    renderWithTheme(
      <SettingsClient
        initialStatus={{
          ...settingsStatus,
          activeProviderCount: 0,
          activeCallerKeyCount: 0,
          gatewayReady: false,
          missingConditions: ["provider", "caller_key"],
        }}
      />,
    );

    expect(screen.getByTestId("settings-not-ready")).toHaveTextContent(
      "缺失条件：可用 Provider、调用方 Key",
    );
    expect(
      screen.getByRole("link", { name: "前往服务商页补齐 Provider 与凭据" }),
    ).toHaveAttribute("href", "/providers");
    expect(
      screen.getByRole("link", { name: "前往 API 密钥页补齐调用方 Key" }),
    ).toHaveAttribute("href", "/api-keys");
  });

  it("部署读数局部失败时保留已知信息并指出失败对象", () => {
    renderWithTheme(
      <SettingsClient
        initialStatus={{
          ...settingsStatus,
          environment: "unknown",
          gatewayReady: false,
          missingConditions: [],
          partialErrors: [
            {
              target: "environment",
              code: "UPSTREAM_FAILED",
              message: "environment unavailable",
            },
            {
              target: "provider",
              code: "UPSTREAM_FAILED",
              message: "provider summary unavailable",
            },
          ],
        }}
      />,
    );

    expect(screen.getByTestId("settings-partial-errors")).toHaveTextContent(
      "部署环境：environment unavailable",
    );
    expect(screen.getByTestId("settings-partial-errors")).toHaveTextContent(
      "Provider 可用性：provider summary unavailable",
    );
    expect(screen.getByTestId("settings-readiness-degraded")).toHaveTextContent(
      "统一出口状态暂时无法完全确认",
    );
    expect(screen.queryByTestId("settings-not-ready")).not.toBeInTheDocument();
    expect(screen.getByText("统一出口读数受限")).toBeInTheDocument();
    expect(screen.getAllByText("未知环境")).toHaveLength(3);
    expect(screen.getAllByText("系统版本")).toHaveLength(2);
  });

  it("初次进入页面时先展示骨架，再加载 Settings 状态", async () => {
    mockedFetchSettingsStatus.mockResolvedValue(settingsStatus);

    renderWithTheme(<SettingsClient />);

    expect(screen.getByRole("status")).toHaveAccessibleName(
      "正在加载 Settings 状态",
    );
    await waitFor(() => {
      expect(screen.getByTestId("settings-content")).toBeInTheDocument();
    });
  });

  it("首次读取失败且没有已知信息时显示可重试错误态", async () => {
    mockedFetchSettingsStatus.mockRejectedValue(
      new AppError("UPSTREAM_FAILED", "settings unavailable"),
    );

    renderWithTheme(<SettingsClient />);

    await waitFor(() => {
      expect(screen.getByTestId("settings-empty")).toHaveTextContent(
        "settings unavailable",
      );
    });
    expect(
      screen.getByRole("button", { name: "重新读取状态" }),
    ).toBeInTheDocument();
  });

  it("权限不足时显示独立权限态而不是通用错误态", async () => {
    mockedFetchSettingsStatus.mockRejectedValue(
      new AppError("FORBIDDEN", "当前会话需要先完成基础处置"),
    );

    renderWithTheme(<SettingsClient />);

    expect(await screen.findByTestId("settings-permission")).toHaveTextContent(
      "当前会话需要先完成基础处置",
    );
    expect(screen.queryByTestId("settings-empty")).not.toBeInTheDocument();
  });
});
