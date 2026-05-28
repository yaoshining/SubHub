import { renderWithTheme } from "../helpers/ui";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardClient } from "@/app/(admin)/dashboard/dashboard-client";
import { fetchDashboardSummary } from "@/lib/api/dashboard";
import type { DashboardSummary } from "@/lib/api/generated/model";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/api/dashboard", () => ({
  fetchDashboardSummary: vi.fn(),
}));

const mockedFetchDashboardSummary = vi.mocked(fetchDashboardSummary);

const dashboardSummary: DashboardSummary = {
  readiness: {
    adminInitialized: true,
    activeProviderCount: 0,
    activeCallerKeyCount: 0,
    gatewayReady: false,
    missingConditions: ["provider", "caller_key"],
    lastCheckedAt: "2026-05-27T07:00:00.000Z",
  },
  northStar: {
    status: "not_ready",
    message: "当前实例尚未完成首轮服务条件，请优先处理缺失项。",
  },
  providerSnapshot: {
    total: 1,
    available: 0,
    needsAttention: 1,
    items: [
      {
        id: "provider_1",
        name: "OpenSubtitles",
        type: "opensubtitles",
        status: "needs_config",
        activeCredentialCount: 0,
        lastHealthStatus: null,
        lastErrorSummary: "缺少活跃凭据",
      },
    ],
  },
  callerKeySnapshot: {
    active: 0,
    suspended: 0,
    rotated: 0,
  },
  queue: {
    status: "idle",
    pendingJobs: 0,
    failedJobs: 0,
  },
  cache: {
    status: "not_configured",
    hitRate: null,
    coverage: "not_available",
  },
  recentIssues: [
    {
      id: "issue_1",
      targetType: "provider",
      targetId: "provider_1",
      message: "缺少活跃凭据",
      createdAt: "2026-05-27T07:00:00.000Z",
    },
  ],
  nextActions: [
    {
      id: "configure-provider",
      label: "配置可用 Provider",
      href: "/providers",
      priority: "high",
    },
    {
      id: "create-caller-key",
      label: "创建调用方 Key",
      href: "/api-keys",
      priority: "medium",
    },
  ],
};

describe("Dashboard 页面体验", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未就绪状态优先展示缺失条件与下一步入口", () => {
    renderWithTheme(<DashboardClient initialSummary={dashboardSummary} />);

    expect(screen.getByText("未就绪")).toBeInTheDocument();
    expect(screen.getByText("未完成首轮开通")).toBeInTheDocument();
    expect(screen.getAllByText("可用 Provider").length).toBeGreaterThan(0);
    expect(screen.getByText("调用方 Key")).toBeInTheDocument();
    expect(screen.getByText("待配置")).toBeInTheDocument();
    expect(screen.queryByText("needs_config")).not.toBeInTheDocument();
    expect(screen.getByText("队列状态：空闲")).toBeInTheDocument();
    expect(screen.queryByText(/队列状态：idle/)).not.toBeInTheDocument();
    expect(screen.getByText("缓存状态：未配置")).toBeInTheDocument();
    expect(
      screen.queryByText(/缓存状态：not_configured/),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/覆盖状态：暂无信号/)).toBeInTheDocument();
    expect(
      screen.queryByText(/覆盖状态：not_available/),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("provider-snapshot-table-scroll")).toHaveClass(
      "overflow-x-auto",
    );
    expect(
      screen.getByRole("link", { name: /配置可用 Provider/ }),
    ).toHaveAttribute("href", "/providers");
    expect(
      screen.getByRole("link", { name: /创建调用方 Key/ }),
    ).toHaveAttribute("href", "/api-keys");
  });

  it("没有下一步动作时不显示该栏目", () => {
    renderWithTheme(
      <DashboardClient
        initialSummary={{
          ...dashboardSummary,
          nextActions: [],
        }}
      />,
    );

    expect(screen.queryByText("下一步动作")).not.toBeInTheDocument();
  });

  it("摘要局部失败时保留已知信息并指出失败对象", async () => {
    const user = userEvent.setup();
    mockedFetchDashboardSummary.mockRejectedValue(
      new AppError("UPSTREAM_FAILED", "Provider 快照读取失败。", "provider"),
    );

    renderWithTheme(<DashboardClient initialSummary={dashboardSummary} />);

    await user.click(
      screen.getByRole("button", { name: "刷新 Dashboard 摘要" }),
    );

    expect(
      await screen.findByTestId("dashboard-partial-error"),
    ).toHaveTextContent("失败对象为 Dashboard 摘要：Provider 快照读取失败。");
    expect(screen.getByText("OpenSubtitles")).toBeInTheDocument();
    expect(screen.getAllByText("缺少活跃凭据").length).toBeGreaterThan(0);
  });

  it("初次进入页面时先展示骨架，再加载 Dashboard 摘要", async () => {
    mockedFetchDashboardSummary.mockResolvedValue(dashboardSummary);

    renderWithTheme(<DashboardClient />);

    expect(screen.getByRole("status")).toHaveAccessibleName(
      "正在加载 Dashboard 摘要",
    );
    await waitFor(() => {
      expect(screen.getByTestId("dashboard-summary")).toBeInTheDocument();
    });
  });
});
