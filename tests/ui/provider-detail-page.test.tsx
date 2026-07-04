import * as React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderDetailClient } from "@/app/(admin)/providers/[providerId]/provider-detail-client";
import { renderWithTheme } from "../helpers/ui";
import { toast } from "sonner";

const nowMs = Date.now();
const recentUpdatedAt = new Date(nowMs - 30 * 60 * 1000).toISOString();
const recentLastUsedAt = new Date(nowMs - 60 * 60 * 1000).toISOString();
const createdAt = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();

const provider = {
  id: "provider_001",
  name: "OpenSubtitles Primary",
  type: "opensubtitles" as const,
  status: "needs_config" as const,
  priority: 1,
  weight: 50,
  concurrencyLimit: 1,
  rotationEnabled: true,
  cooldownSeconds: 60,
  fallbackProviderId: null,
  lastHealthStatus: null,
  lastErrorSummary: null,
  lastHealthCheckedAt: null,
  createdAt,
  updatedAt: recentUpdatedAt,
  credentialCount: 1,
  activeCredentialCount: 1,
  availableCredentialCount: 1,
  credentials: [
    {
      id: "cred_001",
      providerId: "provider_001",
      label: "primary token",
      displayPrefix: "os",
      displaySuffix: "9f3a",
      status: "active" as const,
      remainingQuota: 47,
      lastUsedAt: recentLastUsedAt,
      lastErrorAt: null,
      lastErrorSummary: null,
      cooldownUntil: null,
      createdAt,
      updatedAt: recentLastUsedAt,
    },
  ],
};

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/api/providers", () => ({
  fetchProviderDetail: vi.fn(),
  fetchProviders: vi.fn(),
  updateProvider: vi.fn(),
  createProviderCredential: vi.fn(),
  isolateProviderCredential: vi.fn(),
  restoreProviderCredential: vi.fn(),
  enableProvider: vi.fn(),
  disableProvider: vi.fn(),
}));

const api = await import("@/lib/api/providers");

const allElementsReserveHelperHeight = (elements: HTMLElement[]) =>
  elements.every((element) => element.classList.contains("min-h-5"));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchProviderDetail).mockResolvedValue(provider);
  vi.mocked(api.fetchProviders).mockResolvedValue({
    items: [provider],
    total: 1,
  });
  vi.mocked(api.updateProvider).mockResolvedValue({
    ...provider,
    weight: 75,
    status: "enabled",
  });
});

describe("Provider Detail 页面", () => {
  it("在 Strict Mode 下通过客户端挂载仍会读取 Provider 详情", async () => {
    renderWithTheme(
      <React.StrictMode>
        <ProviderDetailClient providerId="provider_001" />
      </React.StrictMode>,
    );

    expect(
      await screen.findByText("OpenSubtitles Primary"),
    ).toBeInTheDocument();
  });

  it("展示 post-create 引导、未保存变更提示并可保存策略", async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <ProviderDetailClient providerId="provider_001" postCreate />,
    );

    expect(
      await screen.findByText("OpenSubtitles Primary"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("post-create-guide")).toHaveTextContent(
      "Provider 已创建",
    );

    const weightInputs = screen.getAllByLabelText("权重");
    await user.clear(weightInputs[0]!);
    await user.type(weightInputs[0]!, "75");

    expect(screen.getByTestId("dirty-state-alert")).toHaveTextContent(
      "存在未保存变更",
    );
    await user.click(screen.getByRole("button", { name: "保存配置" }));

    await waitFor(() =>
      expect(vi.mocked(api.updateProvider)).toHaveBeenCalledWith(
        "provider_001",
        expect.objectContaining({ weight: 75 }),
      ),
    );
    expect(
      await screen.findByTestId("provider-save-success"),
    ).toHaveTextContent("保存成功");
  });

  it("覆盖详情页移动端策略 Accordion 与凭据风险提示结构", async () => {
    renderWithTheme(<ProviderDetailClient providerId="provider_001" />);

    expect(
      await screen.findByTestId("provider-policy-form"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("provider-policy-mobile-accordion"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("provider-credential-table")).toHaveTextContent(
      "Token 池",
    );
    expect(screen.getByTestId("provider-activity-list")).toBeInTheDocument();
    expect(
      screen.queryByTestId("no-active-credential-alert"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId("provider-name-helper")).toSatisfy(
      allElementsReserveHelperHeight,
    );
    expect(screen.getAllByTestId("provider-priority-helper")).toSatisfy(
      allElementsReserveHelperHeight,
    );
    expect(screen.getAllByTestId("provider-weight-helper")).toSatisfy(
      allElementsReserveHelperHeight,
    );
    expect(screen.getAllByTestId("provider-concurrency-helper")).toSatisfy(
      allElementsReserveHelperHeight,
    );
  });

  it("Desktop 双栏容器允许子区块收缩，避免详情页出现横向滚动", async () => {
    renderWithTheme(<ProviderDetailClient providerId="provider_001" />);

    expect(await screen.findByTestId("provider-detail-page")).toHaveClass(
      "min-w-0",
    );
    expect(screen.getByTestId("provider-detail-layout-grid")).toHaveClass(
      "min-w-0",
      "desktop:items-start",
      "desktop:grid-cols-[minmax(0,1fr)_22rem]",
    );

    expect(
      await screen.findByTestId("provider-detail-primary-column"),
    ).toHaveClass("min-w-0");
    expect(screen.getByTestId("provider-detail-secondary-column")).toHaveClass(
      "min-w-0",
    );
  });

  it("隔离与恢复凭据后会同步 provider 级摘要，并将配置说明保持为只读说明", async () => {
    const user = userEvent.setup();
    vi.mocked(api.isolateProviderCredential).mockResolvedValue({
      credential: {
        ...provider.credentials[0]!,
        status: "isolated",
        lastErrorSummary: "429 限流",
      },
      provider: {
        ...provider,
        status: "degraded",
        availableCredentialCount: 0,
        activeCredentialCount: 0,
        credentials: [
          {
            ...provider.credentials[0]!,
            status: "isolated",
            lastErrorSummary: "429 限流",
          },
        ],
      },
    });
    vi.mocked(api.restoreProviderCredential).mockResolvedValue({
      credential: provider.credentials[0]!,
      provider: {
        ...provider,
        status: "enabled",
        availableCredentialCount: 1,
        activeCredentialCount: 1,
        credentials: provider.credentials,
      },
    });

    renderWithTheme(<ProviderDetailClient providerId="provider_001" />);

    expect(
      await screen.findByText("OpenSubtitles Primary"),
    ).toBeInTheDocument();

    const notes = screen.getByLabelText("Provider 配置说明");
    expect(notes).toHaveAttribute("readonly");

    await user.click(screen.getAllByRole("button", { name: "隔离" })[0]!);
    await user.click(screen.getByRole("button", { name: "确认隔离" }));

    await waitFor(() =>
      expect(vi.mocked(api.isolateProviderCredential)).toHaveBeenCalledWith(
        "provider_001",
        "cred_001",
        expect.any(Object),
      ),
    );

    expect(await screen.findByText("已降级")).toBeInTheDocument();
    expect(
      screen.getByText("可用凭据 0 个。", { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "恢复隔离" })[0],
    ).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "恢复隔离" })[0]!);

    await waitFor(() =>
      expect(vi.mocked(api.restoreProviderCredential)).toHaveBeenCalledWith(
        "provider_001",
        "cred_001",
      ),
    );

    expect(await screen.findByText("已启用")).toBeInTheDocument();
    expect(
      screen.getByText("可用凭据 1 个。", { exact: false }),
    ).toBeInTheDocument();
  });

  describe("Enable/Disable 交互", () => {
    it("点击启用/禁用按钮时显示确认对话框", async () => {
      const user = userEvent.setup();
      vi.mocked(api.fetchProviderDetail).mockResolvedValue({
        ...provider,
        status: "enabled",
      });

      renderWithTheme(<ProviderDetailClient providerId="provider_001" />);

      await screen.findByText("OpenSubtitles Primary");

      // Click disable button
      await user.click(screen.getByRole("button", { name: "禁用" }));

      // Should show confirmation dialog
      expect(await screen.findByText("确认禁用 Provider")).toBeInTheDocument();
      expect(
        screen.getByText(/将停止参与负载均衡/, { exact: false }),
      ).toBeInTheDocument();
    });

    it("启用/禁用操作后不进入 dirty 状态", async () => {
      const user = userEvent.setup();
      const enabledProvider = {
        ...provider,
        status: "enabled" as const,
      };
      vi.mocked(api.fetchProviderDetail)
        .mockResolvedValueOnce(enabledProvider)
        .mockResolvedValueOnce({
          ...enabledProvider,
          status: "disabled" as const,
        });
      vi.mocked(api.disableProvider).mockResolvedValue({
        ...enabledProvider,
        status: "disabled" as const,
      });

      renderWithTheme(<ProviderDetailClient providerId="provider_001" />);

      await screen.findByText("OpenSubtitles Primary");

      // Should not show dirty state alert initially
      expect(screen.queryByTestId("dirty-state-alert")).not.toBeInTheDocument();

      // Click disable button
      await user.click(screen.getByRole("button", { name: "禁用" }));

      // Confirm
      await user.click(screen.getByRole("button", { name: "确认" }));

      // Wait for operation to complete
      await waitFor(() =>
        expect(vi.mocked(api.disableProvider)).toHaveBeenCalledWith(
          "provider_001",
        ),
      );

      // Should not show dirty state alert after enable/disable
      expect(screen.queryByTestId("dirty-state-alert")).not.toBeInTheDocument();

      // Success toast should be shown
      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith("Provider 已禁用"),
      );
    });
  });

  describe("Provider 健康摘要 (US3)", () => {
    it("默认 fixture 下 HealthSummaryBlock 显示未知/未检查/无最近错误", async () => {
      renderWithTheme(<ProviderDetailClient providerId="provider_001" />);

      const summary = await screen.findByTestId(
        "provider-detail-health-summary",
      );
      expect(summary).toHaveAttribute("aria-label", "Provider 健康摘要");
      expect(summary).toHaveTextContent("未知");
      expect(summary).toHaveTextContent("尚未检查");
      expect(summary).toHaveTextContent("最近错误：无");
      // a11y: Last Error p 在空态下应有 data-state="empty"
      const errorNode = summary.querySelector("[data-state='empty']");
      expect(errorNode).toBeInTheDocument();
    });

    it("有 lastErrorSummary 时 HealthSummaryBlock 展示错误摘要（脱敏截断 80 字）", async () => {
      // 长度 > 80，触发 truncateSummary 的 truncated=true 分支
      const longError =
        "upstream 5xx rate exceeded threshold: 80% failures in 600s window (480+ of 600 requests failed). auto-fallback engaged per policy.";
      vi.mocked(api.fetchProviderDetail).mockResolvedValueOnce({
        ...provider,
        status: "degraded" as const,
        lastHealthStatus: "degraded" as const,
        lastErrorSummary: longError,
        lastHealthCheckedAt: new Date(nowMs - 5 * 60 * 1000).toISOString(),
      });

      renderWithTheme(<ProviderDetailClient providerId="provider_001" />);

      const summary = await screen.findByTestId(
        "provider-detail-health-summary",
      );
      expect(summary).toHaveTextContent("降级");
      // 摘要区只展示前 80 字符并加省略号
      expect(summary).toHaveTextContent(
        /最近错误：upstream 5xx rate exceeded threshold/,
      );
      const errorNode = summary.querySelector("[data-state='truncated']")!;
      expect(errorNode).toBeInTheDocument();
      expect(errorNode.textContent ?? "").toMatch(/…$/);
      // 完整文本进入 title 属性，便于 hover 查看
      expect(errorNode.getAttribute("title")).toBe(longError);
    });

    it("ProviderActivity 在有 lastHealthCheckedAt 时渲染健康检查事件", async () => {
      const recentCheckedAt = new Date(nowMs - 5 * 60 * 1000).toISOString();
      vi.mocked(api.fetchProviderDetail).mockResolvedValueOnce({
        ...provider,
        lastHealthStatus: "healthy" as const,
        lastErrorSummary: null,
        lastHealthCheckedAt: recentCheckedAt,
      });

      renderWithTheme(<ProviderDetailClient providerId="provider_001" />);

      const list = await screen.findByTestId("provider-activity-list");
      expect(list).toBeInTheDocument();
      // EventBadge 健康检查分支（secondary tone + Activity 图标 + "健康检查" 文案）
      expect(within(list).getByText("健康检查")).toBeInTheDocument();
      // health 事件消息：`健康 · {label}`（来自 buildEvents），US3 后去掉 "Health " 英文前缀
      expect(within(list).getByText(/^健康 · 健康$/)).toBeInTheDocument();
    });
  });
});
