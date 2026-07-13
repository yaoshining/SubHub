import * as React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProvidersClient } from "@/app/(admin)/providers/providers-client";
import { renderWithTheme } from "../helpers/ui";
import { toast } from "sonner";
import type { ProviderDetail } from "@/lib/api/providers";

// Mock useSearchParams with searchParams that has .get()
const mockSearchParams = new URLSearchParams();
const mockRouterReplace = vi.fn();
const mockRouterPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockRouterReplace, push: mockRouterPush }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/providers",
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const providerOS = {
  id: "provider_001",
  name: "OpenSubtitles Primary",
  type: "opensubtitles" as const,
  status: "enabled" as const,
  priority: 10,
  weight: 80,
  concurrencyLimit: 2,
  rotationEnabled: true,
  cooldownSeconds: 90,
  fallbackProviderId: null,
  lastHealthStatus: "healthy",
  lastErrorSummary: null,
  lastHealthCheckedAt: "2026-07-01T10:00:00.000Z",
  createdAt: "2026-05-26T00:00:00.000Z",
  updatedAt: "2026-05-26T00:00:00.000Z",
  credentialCount: 2,
  activeCredentialCount: 2,
  availableCredentialCount: 2,
};

const providerNeedsConfig = {
  ...providerOS,
  id: "provider_002",
  name: "OpenSubtitles Backup",
  status: "needs_config" as const,
  priority: 2,
  weight: 10,
  credentialCount: 1,
  activeCredentialCount: 1,
  availableCredentialCount: 1,
};

const providerXunlei = {
  id: "provider_xl",
  name: "Xunlei Official",
  type: "xunlei" as const,
  status: "enabled" as const,
  priority: 5,
  weight: 50,
  concurrencyLimit: 1,
  rotationEnabled: false,
  cooldownSeconds: 30,
  fallbackProviderId: null,
  lastHealthStatus: null,
  lastErrorSummary: null,
  lastHealthCheckedAt: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  credentialCount: 0,
  activeCredentialCount: 0,
  availableCredentialCount: 0,
};

const providerDegraded = {
  id: "provider_dg",
  name: "OpenSubtitles Degraded",
  type: "opensubtitles" as const,
  status: "degraded" as const,
  priority: 3,
  weight: 30,
  concurrencyLimit: 1,
  rotationEnabled: true,
  cooldownSeconds: 60,
  fallbackProviderId: null,
  lastHealthStatus: "degraded" as const,
  lastErrorSummary: null,
  lastHealthCheckedAt: "2026-06-15T10:00:00.000Z",
  createdAt: "2026-06-10T00:00:00.000Z",
  updatedAt: "2026-06-15T10:00:00.000Z",
  credentialCount: 2,
  activeCredentialCount: 1,
  availableCredentialCount: 1,
};

const credential = {
  id: "cred_001",
  providerId: "provider_001",
  label: "primary token",
  displayPrefix: "os",
  displaySuffix: "9f3a",
  status: "active" as const,
  remainingQuota: 47,
  lastUsedAt: "2026-05-26T00:20:00.000Z",
  lastErrorAt: null,
  lastErrorSummary: null,
  cooldownUntil: null,
  createdAt: "2026-05-26T00:00:00.000Z",
  updatedAt: "2026-05-26T00:00:00.000Z",
};

vi.mock("@/lib/api/providers", () => ({
  fetchProviders: vi.fn(),
  fetchProviderDetail: vi.fn(),
  createProvider: vi.fn(),
  enableProvider: vi.fn(),
  disableProvider: vi.fn(),
}));

const api = await import("@/lib/api/providers");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchProviders).mockResolvedValue({
    items: [providerOS, providerDegraded, providerNeedsConfig, providerXunlei],
    total: 4,
  });
  vi.mocked(api.fetchProviderDetail).mockResolvedValue({
    ...providerOS,
    credentials: [credential],
  });
  vi.mocked(api.createProvider).mockResolvedValue({
    ...providerNeedsConfig,
    id: "provider_new",
    name: "OpenSubtitles 新池",
    credentials: [credential],
  });
});

describe("Providers 页面", () => {
  it("在 Strict Mode 下通过客户端挂载仍会读取已有 Provider", async () => {
    renderWithTheme(
      <React.StrictMode>
        <ProvidersClient />
      </React.StrictMode>,
    );

    expect(
      (await screen.findAllByText("OpenSubtitles Primary")).length,
    ).toBeGreaterThan(0);
    expect(vi.mocked(api.fetchProviders)).toHaveBeenCalledTimes(1);
  });

  it("展示多 provider 卡片行、inspector 与摘要", async () => {
    renderWithTheme(<ProvidersClient />);

    // Should see all three providers
    await screen.findByText("OpenSubtitles Primary");
    expect(screen.getByText("OpenSubtitles Backup")).toBeInTheDocument();
    expect(screen.getByText("Xunlei Official")).toBeInTheDocument();

    // Should show Operational Pulse summary
    expect(screen.getByText("Providers")).toBeInTheDocument();
    expect(screen.getByText(/4 个实例/)).toBeInTheDocument();

    // Inspector should be visible
    expect(
      await screen.findByTestId("provider-pool-inspector"),
    ).toBeInTheDocument();

    // Should have type tabs
    expect(
      screen.getByRole("tab", { name: "OpenSubtitles" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Xunlei" })).toBeInTheDocument();
  });

  it("默认选中策略：degraded > needs_config > first", async () => {
    renderWithTheme(<ProvidersClient />);

    // Should select degraded provider_002 (degraded) over needs_config provider
    await waitFor(() =>
      expect(vi.mocked(api.fetchProviderDetail)).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent(
      "OpenSubtitles Degraded",
    );
  });

  it("创建入口按钮文案为「创建 Provider」(不预设 type)", async () => {
    renderWithTheme(<ProvidersClient />);

    await screen.findAllByText("OpenSubtitles Primary");
    const trigger = screen.getByRole("button", { name: "创建 Provider" });
    expect(trigger).toBeInTheDocument();
  });

  it("two-step flow：Step 1 选 type → Step 2 建档 → 创建成功回流列表并选中新实例", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ProvidersClient />);

    await screen.findAllByText("OpenSubtitles Primary");
    await user.click(screen.getByRole("button", { name: "创建 Provider" }));

    // Step 1: type selector 出现，含 OS 卡片与 Xunlei locked 卡片
    await screen.findByTestId("provider-type-selector");
    expect(
      screen.getByTestId("provider-type-option-opensubtitles"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("provider-type-option-xunlei")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText("已接入 / 不可重复创建")).toBeInTheDocument();
    expect(
      screen.getByText(/Xunlei 为预置 provider，单实例不可重复创建/),
    ).toBeInTheDocument();

    // Xunlei 卡片点击不应进入 Step 2
    await user.click(screen.getByTestId("provider-type-option-xunlei"));
    expect(
      screen.queryByTestId("create-provider-form"),
    ).not.toBeInTheDocument();

    // 选择 OpenSubtitles → 进入 Step 2
    await user.click(screen.getByTestId("provider-type-option-opensubtitles"));
    const form = await screen.findByTestId("create-provider-form");
    expect(form).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Provider Name"));
    await user.type(
      screen.getByLabelText("Provider Name"),
      "OpenSubtitles 新池",
    );
    await user.clear(screen.getByLabelText("Initial API Key"));
    await user.type(
      screen.getByLabelText("Initial API Key"),
      "provider-secret",
    );
    await user.click(screen.getByRole("button", { name: "Create Provider" }));

    expect(
      await screen.findByTestId("provider-create-success"),
    ).toHaveTextContent("已成功创建，策略待补充");
    const success = await screen.findByTestId("provider-create-success");
    expect(success.querySelector("a")).toHaveAttribute(
      "href",
      "/providers/provider_new?created=1",
    );

    // 列表自动选中新实例：inspector 向新实例拉取 detail
    await waitFor(() =>
      expect(vi.mocked(api.fetchProviderDetail)).toHaveBeenCalledWith(
        "provider_new",
      ),
    );
    // 不强制 router.push 到详情页
    expect(mockRouterPush).not.toHaveBeenCalled();

    // createProvider 调用契约：仅 name/type/initialCredential，不传调度初始值
    await waitFor(() =>
      expect(vi.mocked(api.createProvider)).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "OpenSubtitles 新池",
          type: "opensubtitles",
          initialCredential: {
            label: "primary",
            secret: "provider-secret",
          },
        }),
      ),
    );
    const createCall = vi.mocked(api.createProvider).mock.calls[0]?.[0];
    expect(createCall).not.toHaveProperty("priority");
    expect(createCall).not.toHaveProperty("weight");
    expect(createCall).not.toHaveProperty("concurrencyLimit");
    expect(createCall).not.toHaveProperty("cooldownSeconds");
  });

  it("创建成功后自动选中新实例并提供继续配置 CTA（two-step flow）", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ProvidersClient />);

    await screen.findAllByText("OpenSubtitles Primary");
    await user.click(screen.getByRole("button", { name: "创建 Provider" }));
    await user.click(screen.getByTestId("provider-type-option-opensubtitles"));
    await screen.findByTestId("create-provider-form");
    await user.clear(screen.getByLabelText("Provider Name"));
    await user.type(
      screen.getByLabelText("Provider Name"),
      "OpenSubtitles 新池",
    );
    await user.clear(screen.getByLabelText("Initial API Key"));
    await user.type(
      screen.getByLabelText("Initial API Key"),
      "provider-secret",
    );
    await user.click(screen.getByRole("button", { name: "Create Provider" }));

    expect(
      await screen.findByTestId("provider-create-success"),
    ).toHaveTextContent("已成功创建，策略待补充");
    const success = await screen.findByTestId("provider-create-success");
    expect(success.querySelector("a")).toHaveAttribute(
      "href",
      "/providers/provider_new?created=1",
    );
    await waitFor(() =>
      expect(vi.mocked(api.createProvider)).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "OpenSubtitles 新池",
          type: "opensubtitles",
        }),
      ),
    );
  });

  it("Credential Label 留空时默认提交 primary（two-step flow）", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ProvidersClient />);

    await screen.findAllByText("OpenSubtitles Primary");
    await user.click(screen.getByRole("button", { name: "创建 Provider" }));
    await user.click(screen.getByTestId("provider-type-option-opensubtitles"));
    await screen.findByTestId("create-provider-form");

    await user.clear(screen.getByLabelText("Provider Name"));
    await user.type(
      screen.getByLabelText("Provider Name"),
      "OpenSubtitles 备用",
    );
    await user.clear(screen.getByLabelText("Initial API Key"));
    await user.type(
      screen.getByLabelText("Initial API Key"),
      "provider-secret",
    );

    // Credential Label 留空 -> 提交 primary
    expect(screen.getByLabelText("Credential Label")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Create Provider" }));
    await waitFor(() =>
      expect(vi.mocked(api.createProvider)).toHaveBeenCalledWith(
        expect.objectContaining({
          initialCredential: {
            label: "primary",
            secret: "provider-secret",
          },
        }),
      ),
    );
  });

  it("Credential Label 输入自定义值时提交用户输入（two-step flow）", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ProvidersClient />);

    await screen.findAllByText("OpenSubtitles Primary");
    await user.click(screen.getByRole("button", { name: "创建 Provider" }));
    await user.click(screen.getByTestId("provider-type-option-opensubtitles"));
    await screen.findByTestId("create-provider-form");

    await user.clear(screen.getByLabelText("Provider Name"));
    await user.type(
      screen.getByLabelText("Provider Name"),
      "OpenSubtitles 边缘",
    );
    await user.clear(screen.getByLabelText("Initial API Key"));
    await user.type(
      screen.getByLabelText("Initial API Key"),
      "provider-secret-2",
    );
    await user.clear(screen.getByLabelText("Credential Label"));
    await user.type(screen.getByLabelText("Credential Label"), "edge-us-1");
    await user.click(screen.getByRole("button", { name: "Create Provider" }));
    await waitFor(() =>
      expect(vi.mocked(api.createProvider)).toHaveBeenCalledWith(
        expect.objectContaining({
          initialCredential: {
            label: "edge-us-1",
            secret: "provider-secret-2",
          },
        }),
      ),
    );
  });

  it("筛选 type tabs 之后列表应过滤", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ProvidersClient />);

    await screen.findAllByText("OpenSubtitles Primary");

    // Click Xunlei tab
    await user.click(screen.getByText("Xunlei"));

    // Only Xunlei should be visible
    expect(screen.getByText("Xunlei Official")).toBeInTheDocument();
    expect(screen.queryByText("OpenSubtitles Primary")).not.toBeInTheDocument();
    expect(screen.queryByText("OpenSubtitles Backup")).not.toBeInTheDocument();
  });

  it("单个 provider 时显示 Xunlei 受限 callout", async () => {
    vi.mocked(api.fetchProviders).mockResolvedValue({
      items: [providerXunlei],
      total: 1,
    });

    renderWithTheme(<ProvidersClient />);
    await screen.findByText("Xunlei Official");
    await screen.findByText(/不需要 API Key/);
  });

  it("空态：没有 provider 时展示 EmptyStateCard", async () => {
    vi.mocked(api.fetchProviders).mockResolvedValue({
      items: [],
      total: 0,
    });

    renderWithTheme(<ProvidersClient />);
    expect(await screen.findByTestId("empty-state-card")).toBeInTheDocument();
    expect(screen.getByText("还没有任何 Provider")).toBeInTheDocument();
  });

  it("错误态：加载失败时展示 error alert", async () => {
    vi.mocked(api.fetchProviders).mockRejectedValue(new Error("Network error"));

    renderWithTheme(<ProvidersClient />);
    expect(await screen.findByTestId("providers-error")).toBeInTheDocument();
  });

  it("无结果：筛选后无匹配应显示对应空态", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ProvidersClient />);

    await screen.findAllByText("OpenSubtitles Primary");
    await user.click(screen.getByText("Xunlei"));

    expect(screen.queryByText("OpenSubtitles Primary")).not.toBeInTheDocument();
  });

  describe("Enable/Disable 交互", () => {
    it("点击启用/禁用按钮时显示确认对话框", async () => {
      const user = userEvent.setup();
      renderWithTheme(<ProvidersClient />);

      await screen.findAllByText("OpenSubtitles Primary");

      // Click disable button on enabled provider
      const disableButtons = screen.getAllByRole("button", { name: "禁用" });
      await user.click(disableButtons[0]!);

      // Should show confirmation dialog
      expect(await screen.findByText("确认禁用 Provider")).toBeInTheDocument();
      expect(
        screen.getByText(/将停止参与负载均衡/, { exact: false }),
      ).toBeInTheDocument();
    });

    it('API 调用期间按钮显示"处理中..."且禁用状态', async () => {
      const user = userEvent.setup();
      let resolveDisable: (value: ProviderDetail) => void;
      const disablePromise = new Promise<ProviderDetail>((resolve) => {
        resolveDisable = resolve;
      });
      vi.mocked(api.disableProvider).mockReturnValue(disablePromise);

      renderWithTheme(<ProvidersClient />);

      await screen.findAllByText("OpenSubtitles Primary");

      // Click disable button
      const disableButtons = screen.getAllByRole("button", { name: "禁用" });
      await user.click(disableButtons[0]!);

      // Confirm in dialog
      await user.click(screen.getByRole("button", { name: "确认" }));

      // Button should show "处理中..." and be disabled
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "处理中..." }),
        ).toBeDisabled(),
      );

      // Resolve the promise
      resolveDisable!({ ...providerOS, status: "disabled", credentials: [] });
    });

    it("成功启用/禁用后更新状态", async () => {
      const user = userEvent.setup();
      vi.mocked(api.disableProvider).mockResolvedValue({
        ...providerOS,
        status: "disabled",
        credentials: [],
      });
      vi.mocked(api.fetchProviders).mockResolvedValue({
        items: [
          { ...providerOS, status: "disabled" },
          providerDegraded,
          providerNeedsConfig,
          providerXunlei,
        ],
        total: 4,
      });

      renderWithTheme(<ProvidersClient />);

      await screen.findAllByText("OpenSubtitles Primary");

      // Click disable button
      const disableButtons = screen.getAllByRole("button", { name: "禁用" });
      await user.click(disableButtons[0]!);

      // Confirm
      await user.click(screen.getByRole("button", { name: "确认" }));

      // Should call disableProvider API
      await waitFor(() =>
        expect(vi.mocked(api.disableProvider)).toHaveBeenCalledWith(
          "provider_001",
        ),
      );

      // Should reload providers
      await waitFor(() =>
        expect(vi.mocked(api.fetchProviders)).toHaveBeenCalledTimes(2),
      );
    });

    it("失败时显示错误提示并保持状态", async () => {
      const user = userEvent.setup();
      vi.mocked(api.disableProvider).mockRejectedValue(
        new Error("Network error"),
      );

      renderWithTheme(<ProvidersClient />);

      await screen.findAllByText("OpenSubtitles Primary");

      // Click disable button
      const disableButtons = screen.getAllByRole("button", { name: "禁用" });
      await user.click(disableButtons[0]!);

      // Confirm
      await user.click(screen.getByRole("button", { name: "确认" }));

      // Should show error toast
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Network error"),
      );

      // State should remain - button should still show "禁用" (not "启用")
      expect(
        screen.getAllByRole("button", { name: "禁用" }).length,
      ).toBeGreaterThan(0);
    });
  });

  describe("Provider 健康状态展示", () => {
    it("list 行 compact HealthBlock 渲染 health 状态与时间", async () => {
      renderWithTheme(<ProvidersClient />);

      await screen.findByTestId("provider-pool-inspector");

      // 4 个 provider list 行（每行一个 HealthBlock）
      const rows = screen.getAllByTestId("provider-list-row");
      expect(rows).toHaveLength(4);

      // 默认 fixture：healthy×2（providerOS + providerNeedsConfig）+ degraded×1 + unknown×1
      const rowTexts = rows.map((row) => row.textContent ?? "");
      // "健康" 仅出现在 lastHealthStatus=healthy 的行；不把"尚未检查"纳入
      // 健康数量统计，因为"尚未检查"会跟随任何 lastHealthCheckedAt 为空的
      // provider（包括未知/降级），混在一起会掩盖健康标签渲染错误。
      const healthyRows = rowTexts.filter((t) => /健康/.test(t)).length;
      const degradedRows = rowTexts.filter((t) => /降级/.test(t)).length;
      const unknownRows = rowTexts.filter((t) => /未知/.test(t)).length;
      const notCheckedRows = rowTexts.filter((t) => /尚未检查/.test(t)).length;
      expect(healthyRows).toBe(2);
      expect(degradedRows).toBe(1);
      expect(unknownRows).toBe(1);
      // "尚未检查" 独立断言：仅 lastHealthCheckedAt 为空的行（本 fixture 为 Xunlei）
      expect(notCheckedRows).toBe(1);
    });

    it("OpenSubtitles inspector 展示 HealthBlock 且包含 lastErrorSummary", async () => {
      vi.mocked(api.fetchProviderDetail).mockResolvedValueOnce({
        ...providerDegraded,
        lastHealthStatus: "degraded",
        lastErrorSummary: "429 限流：上游短时间内拒绝请求",
        credentials: [credential],
      });

      renderWithTheme(<ProvidersClient />);

      await screen.findByTestId("provider-pool-inspector");
      // 等 inspector 加载完 detail
      await waitFor(() =>
        expect(vi.mocked(api.fetchProviderDetail)).toHaveBeenCalledWith(
          "provider_dg",
        ),
      );

      // 1 个 list 行 + 1 个 inspector → 至少 2 个 "降级" 健康标签
      expect(screen.getAllByText(/降级/).length).toBeGreaterThanOrEqual(2);
      // list 行 + inspector 同时展示 lastErrorSummary → 至少 2 处匹配
      expect(
        (await screen.findAllByText(/最近错误：429 限流/)).length,
      ).toBeGreaterThanOrEqual(2);
    });

    it("Xunlei inspector 也展示 HealthBlock（含 lastErrorSummary）", async () => {
      // 第一次 fetchProviderDetail（默认选中 provider_dg）→ OpenSubtitles inspector 数据
      vi.mocked(api.fetchProviderDetail).mockResolvedValueOnce({
        ...providerDegraded,
        credentials: [credential],
      });
      // 第二次 fetchProviderDetail（点击 Xunlei row 后）→ Xunlei inspector 数据
      vi.mocked(api.fetchProviderDetail).mockResolvedValueOnce({
        ...providerXunlei,
        lastHealthStatus: "unavailable",
        lastErrorSummary: "上游握手失败，需要人工核对网络连通性",
        credentials: [],
      });

      renderWithTheme(<ProvidersClient />);

      // 等 list 渲染完（4 行）
      const rows = await screen.findAllByTestId("provider-list-row");
      // 默认选中策略下，Xunlei 不会自动被选中，模拟用户点击 Xunlei 行
      const xunleiRow = rows.find((row) =>
        row.textContent?.includes("Xunlei Official"),
      );
      expect(xunleiRow).toBeDefined();
      const user = userEvent.setup();
      await user.click(xunleiRow!);

      await waitFor(() =>
        expect(vi.mocked(api.fetchProviderDetail)).toHaveBeenCalledWith(
          "provider_xl",
        ),
      );

      // inspector 渲染 Xunlei 分支（list 行 + inspector 同时显示 不可用）
      expect(
        (await screen.findAllByText(/不可用/)).length,
      ).toBeGreaterThanOrEqual(2);
      // list 行 + inspector 同时展示 lastErrorSummary → 至少 2 处匹配
      expect(
        (await screen.findAllByText(/最近错误：上游握手失败/)).length,
      ).toBeGreaterThanOrEqual(2);
    });

    it("list row compact HealthBlock 透传 lastErrorSummary 时 data-truncated 与 title 属性正确", async () => {
      // 长度 > 80 字符，触发 truncated=true 路径；并覆盖 row 内联展示能力
      const longError =
        "upstream 5xx rate exceeded threshold: 80% failures in 600s window (480+ of 600 requests failed). auto-fallback engaged per policy.";
      const rowProvider = {
        ...providerOS,
        lastHealthStatus: "degraded" as const,
        lastErrorSummary: longError,
        lastHealthCheckedAt: "2026-07-01T10:00:00.000Z",
      };
      vi.mocked(api.fetchProviders).mockResolvedValueOnce({
        items: [rowProvider, providerXunlei],
        total: 2,
      });
      vi.mocked(api.fetchProviderDetail).mockResolvedValueOnce({
        ...rowProvider,
        credentials: [credential],
      });

      renderWithTheme(<ProvidersClient />);

      const rows = await screen.findAllByTestId("provider-list-row");
      expect(rows.length).toBeGreaterThanOrEqual(1);

      // 找含 rowProvider 名字的行
      const targetRow = rows.find((row) =>
        row.textContent?.includes("OpenSubtitles Primary"),
      );
      expect(targetRow).toBeDefined();

      // compact HealthBlock 透传 lastErrorSummary，应在 row 内联展示 truncated 80 字 + …
      const truncatedNode = targetRow!.querySelector(
        "[data-truncated='true']",
      ) as HTMLElement | null;
      expect(truncatedNode).not.toBeNull();
      expect(truncatedNode!.textContent ?? "").toMatch(/…$/);
      expect(truncatedNode!.getAttribute("title")).toBe(longError);

      // row 内联展示应含"最近错误：…" + 截断后的前缀内容
      expect(targetRow!.textContent ?? "").toMatch(
        /最近错误：upstream 5xx rate exceeded threshold/,
      );
    });

    it("list row compact HealthBlock 在 lastErrorSummary 为空时不渲染错误段", async () => {
      // 默认 fixture：providerOS / providerNeedsConfig lastErrorSummary=null
      // row 不应包含"最近错误："文案（其 lastErrorSummary 为 null）
      renderWithTheme(<ProvidersClient />);

      const rows = await screen.findAllByTestId("provider-list-row");
      const targetRow = rows.find((row) =>
        row.textContent?.includes("OpenSubtitles Primary"),
      );
      expect(targetRow).toBeDefined();
      // 该行 lastErrorSummary=null → 不渲染"<p>最近错误：...</p>"
      expect(targetRow!.querySelector("[data-truncated='true']")).toBeNull();
      expect(targetRow!.querySelector("[data-state='truncated']")).toBeNull();
      expect(targetRow!.querySelector("[data-state='filled']")).toBeNull();
    });
  });
});
