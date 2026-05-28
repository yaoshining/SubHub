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

beforeEach(() => {
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
  });

  it("Desktop 双栏容器允许子区块收缩，避免详情页出现横向滚动", async () => {
    renderWithTheme(<ProviderDetailClient providerId="provider_001" />);

    expect(
      await screen.findByTestId("provider-detail-page"),
    ).toHaveClass("min-w-0");
    expect(screen.getByTestId("provider-detail-layout-grid")).toHaveClass(
      "min-w-0",
      "desktop:items-start",
      "desktop:grid-cols-[minmax(0,1fr)_22rem]",
    );

    expect(
      await screen.findByTestId("provider-detail-primary-column"),
    ).toHaveClass("min-w-0");
    expect(
      screen.getByTestId("provider-detail-secondary-column"),
    ).toHaveClass("min-w-0");
  });
});
