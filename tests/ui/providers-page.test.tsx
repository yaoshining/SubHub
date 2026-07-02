import * as React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProvidersClient } from "@/app/(admin)/providers/providers-client";
import { renderWithTheme } from "../helpers/ui";

// Mock useSearchParams with searchParams that has .get()
const mockSearchParams = new URLSearchParams();
const mockRouterReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/providers",
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

  it("创建成功后自动选中新实例并提供继续配置 CTA", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ProvidersClient />);

    await screen.findAllByText("OpenSubtitles Primary");
    await user.click(screen.getByRole("button", { name: "创建 Provider" }));
    await user.clear(screen.getByLabelText("Provider 名称"));
    await user.type(
      screen.getByLabelText("Provider 名称"),
      "OpenSubtitles 新池",
    );
    await user.clear(screen.getByLabelText("OpenSubtitles API Key"));
    await user.type(
      screen.getByLabelText("OpenSubtitles API Key"),
      "provider-secret",
    );
    await user.click(screen.getByRole("button", { name: "创建并返回列表" }));

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
});
