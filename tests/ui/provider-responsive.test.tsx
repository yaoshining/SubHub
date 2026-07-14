import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderDetailClient } from "@/app/(admin)/providers/[providerId]/provider-detail-client";
import { ProvidersClient } from "@/app/(admin)/providers/providers-client";
import { mockViewport, renderWithTheme } from "../helpers/ui";

// 模拟 useRouter 和 useSearchParams（Vitest 不会从 ui.tsx 导入 vi.mock 的提升）
const mockRouterReplace = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/providers",
}));

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
  lastHealthCheckedAt: null,
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

const xunleiProvider = {
  id: "xunlei-default",
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

const xunleiProviderDetail = {
  ...xunleiProvider,
  credentials: [],
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
  it("创建成功后以内联 Banner 呈现 Mobile 流程，并保持次主动作顺序（two-step flow）", async () => {
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

  it("Mobile 断点下 create-provider drawer two-step flow 仍可用", async () => {
    mockViewport(375, 812);

    const user = userEvent.setup();
    renderWithTheme(<ProvidersClient />);

    await screen.findAllByText("OpenSubtitles Primary");
    await user.click(screen.getByRole("button", { name: "创建 Provider" }));

    // Step 1 selector 卡片堆叠（sm:grid-cols-2 在 <640px 退回单列）
    const selector = await screen.findByTestId("provider-type-selector");
    expect(selector).toBeInTheDocument();
    expect(
      screen.getByTestId("provider-type-option-opensubtitles"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("provider-type-option-xunlei")).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    // 进入 Step 2，表单存在且 Footer 主次按钮可达
    await user.click(screen.getByTestId("provider-type-option-opensubtitles"));
    const form = await screen.findByTestId("create-provider-form");
    expect(form).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Provider Name"),
      "OpenSubtitles 新池",
    );
    await user.type(
      screen.getByLabelText("Initial API Key"),
      "provider-secret",
    );

    const createButton = screen.getByRole("button", {
      name: "Create Provider",
    });
    const backButton = screen.getByRole("button", { name: /^Back/ });
    expect(createButton).not.toBeDisabled();
    expect(backButton).not.toBeDisabled();
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

  it("多断点下 Xunlei 详情页凭据池区整段替换为受限说明，OS 保留凭据表", async () => {
    // Desktop 断点：Xunlei 详情页渲染受限模块，不渲染凭据表
    vi.mocked(api.fetchProviderDetail).mockResolvedValue(xunleiProviderDetail);
    vi.mocked(api.fetchProviders).mockResolvedValue({
      items: [xunleiProvider],
      total: 1,
    });

    const { unmount } = renderWithTheme(
      <ProviderDetailClient providerId="xunlei-default" />,
    );

    await screen.findByTestId("provider-detail-page");
    expect(
      await screen.findByTestId("provider-restricted-capability"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("provider-credential-table"),
    ).not.toBeInTheDocument();
    unmount();

    // Mobile 断点（375px）：Xunlei 受限模块仍可见，凭据表仍不渲染
    mockViewport(375, 812);
    vi.mocked(api.fetchProviderDetail).mockResolvedValue(xunleiProviderDetail);
    renderWithTheme(<ProviderDetailClient providerId="xunlei-default" />);

    await screen.findByTestId("provider-detail-page");
    expect(
      await screen.findByTestId("provider-restricted-capability"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("provider-credential-table"),
    ).not.toBeInTheDocument();
  });

  it("Mobile 断点下 OS 详情页凭据表与隔离/恢复动作仍可达", async () => {
    mockViewport(375, 812);

    renderWithTheme(<ProviderDetailClient providerId="provider_001" />);

    await screen.findByTestId("provider-credential-table");
    expect(screen.getByText("Token 池")).toBeInTheDocument();
    // Mobile 下凭据动作仍可操作
    expect(
      screen.getAllByRole("button", { name: "隔离" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByTestId("provider-restricted-capability"),
    ).not.toBeInTheDocument();
  });

  it("Mobile 断点下 create-provider drawer Xunlei locked 卡片可达且提示受限", async () => {
    mockViewport(375, 812);

    const user = userEvent.setup();
    renderWithTheme(<ProvidersClient />);

    await screen.findAllByText("OpenSubtitles Primary");
    await user.click(screen.getByRole("button", { name: "创建 Provider" }));

    const xunleiCard = await screen.findByTestId("provider-type-option-xunlei");
    expect(xunleiCard).toHaveAttribute("aria-disabled", "true");
    // 点击 locked 卡片不进入 Step 2，而是展示已预置提示
    await user.click(xunleiCard);
    expect(
      await screen.findByTestId("xunlei-provisioned-notice"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("create-provider-form"),
    ).not.toBeInTheDocument();
  });
});
