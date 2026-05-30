import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderDetailClient } from "@/app/(admin)/providers/[providerId]/provider-detail-client";
import { ProvidersClient } from "@/app/(admin)/providers/providers-client";
import { renderWithTheme } from "../helpers/ui";

const activeCredential = {
  id: "cred_active",
  providerId: "provider_001",
  label: "primary token",
  displayPrefix: "os",
  displaySuffix: "9f3a",
  status: "active" as const,
  remainingQuota: 47,
  lastUsedAt: "2026-05-28T00:20:00.000Z",
  lastErrorAt: null,
  lastErrorSummary: null,
  cooldownUntil: null,
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:20:00.000Z",
};

const isolatedCredential = {
  ...activeCredential,
  id: "cred_isolated",
  label: "isolated token",
  status: "isolated" as const,
  lastErrorAt: "2026-05-28T00:25:00.000Z",
  lastErrorSummary: "429 限流",
};

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
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:53:00.000Z",
  credentialCount: 2,
  activeCredentialCount: 1,
  availableCredentialCount: 1,
};

const providerDetail = {
  ...provider,
  credentials: [activeCredential, isolatedCredential],
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
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
  createProviderCredential: vi.fn(),
  isolateProviderCredential: vi.fn(),
  restoreProviderCredential: vi.fn(),
}));

const api = await import("@/lib/api/providers");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchProviders).mockResolvedValue({
    items: [provider],
    total: 1,
  });
  vi.mocked(api.fetchProviderDetail).mockResolvedValue(providerDetail);
  vi.mocked(api.createProvider).mockResolvedValue({
    ...providerDetail,
    id: "provider_new",
    name: "OpenSubtitles 新池",
  });
  vi.mocked(api.updateProvider).mockResolvedValue(providerDetail);
  vi.mocked(api.isolateProviderCredential).mockResolvedValue({
    credential: { ...activeCredential, status: "isolated" },
    provider: { ...providerDetail, availableCredentialCount: 0 },
  });
  vi.mocked(api.restoreProviderCredential).mockResolvedValue({
    credential: { ...isolatedCredential, status: "active" },
    provider: providerDetail,
  });
});

describe("Provider 响应式行为", () => {
  it("创建成功后以内联 Banner 呈现 Mobile 流程，并保持次主动作顺序", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ProvidersClient />);

    await screen.findAllByText("OpenSubtitles Primary");
    await user.click(
      screen.getByRole("button", { name: "新增 OpenSubtitles" }),
    );
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

    const banner = await screen.findByTestId("provider-create-success");
    expect(banner).toHaveTextContent("已成功创建，策略待补充");
    expect(
      Array.from(banner.querySelectorAll("button,a")).map((element) =>
        element.textContent?.trim(),
      ),
    ).toEqual(["留在列表", "继续配置"]);
    expect(banner.querySelector("a")).toHaveAttribute(
      "href",
      "/providers/provider_new?created=1",
    );
  });

  it("Provider Detail 在 Tablet 下不保留桌面双栏，次级栏仅到 Desktop 才固定", async () => {
    renderWithTheme(<ProviderDetailClient providerId="provider_001" />);

    expect(
      await screen.findByTestId("provider-detail-page"),
    ).toBeInTheDocument();
    const layout = screen.getByTestId("provider-detail-layout-grid");
    const secondaryColumn = screen.getByTestId(
      "provider-detail-secondary-column",
    );

    expect(layout).toHaveClass(
      "grid",
      "min-w-0",
      "gap-6",
      "desktop:grid-cols-[minmax(0,1fr)_22rem]",
    );
    expect(layout.className).not.toContain("tablet:grid-cols");
    expect(secondaryColumn).toHaveClass("desktop:sticky", "desktop:top-20");
    expect(secondaryColumn.className).not.toContain("tablet:sticky");
  });

  it("Mobile 下保留策略 Accordion，并让隔离与恢复高风险动作可达", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ProviderDetailClient providerId="provider_001" />);

    expect(
      await screen.findByTestId("provider-policy-mobile-accordion"),
    ).toHaveClass("mobile:block");
    expect(screen.getByTestId("provider-credential-table")).toHaveTextContent(
      "Token 池",
    );

    const mobileCredentialActions = Array.from(
      document.querySelectorAll('[class*="desktop:hidden"] button'),
    ).map((element) => element.textContent?.trim());
    expect(mobileCredentialActions).toEqual(
      expect.arrayContaining(["隔离", "恢复隔离"]),
    );

    await user.click(screen.getAllByRole("button", { name: "隔离" })[0]!);
    expect(
      await screen.findByText(/该凭据将立即从活跃池中移出/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认隔离" }));

    await waitFor(() =>
      expect(vi.mocked(api.isolateProviderCredential)).toHaveBeenCalledWith(
        "provider_001",
        "cred_active",
        expect.objectContaining({
          reason: "管理员从 Provider Detail 隔离异常凭据",
        }),
      ),
    );
  });
});
