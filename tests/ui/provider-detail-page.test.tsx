import * as React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderDetailClient } from "@/app/(admin)/providers/[providerId]/provider-detail-client";
import { renderWithTheme } from "../helpers/ui";

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
      lastUsedAt: "2026-05-28T00:20:00.000Z",
      lastErrorAt: null,
      lastErrorSummary: null,
      cooldownUntil: null,
      createdAt: "2026-05-28T00:00:00.000Z",
      updatedAt: "2026-05-28T00:20:00.000Z",
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
});
