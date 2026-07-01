import * as React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProvidersClient } from "@/app/(admin)/providers/providers-client";
import { renderWithTheme } from "../helpers/ui";

const providerA = {
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
  lastHealthCheckedAt: null,
  createdAt: "2026-05-26T00:00:00.000Z",
  updatedAt: "2026-05-26T00:00:00.000Z",
  credentialCount: 2,
  activeCredentialCount: 2,
  availableCredentialCount: 2,
};

const providerNeedsConfig = {
  ...providerA,
  id: "provider_002",
  name: "OpenSubtitles Backup",
  status: "needs_config" as const,
  priority: 2,
  weight: 10,
  credentialCount: 1,
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
    items: [providerA, providerNeedsConfig],
    total: 2,
  });
  vi.mocked(api.fetchProviderDetail).mockResolvedValue({
    ...providerA,
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

  it("展示列表、Token 池摘要与选中 Provider 池检查", async () => {
    renderWithTheme(<ProvidersClient />);

    expect(
      (await screen.findAllByText("OpenSubtitles Primary")).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("region", { name: "Token 池摘要" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("provider-pool-inspector"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(vi.mocked(api.fetchProviderDetail)).toHaveBeenCalledTimes(1),
    );
    expect(screen.getAllByText("继续配置").length).toBeGreaterThan(0);
  });

  it("创建成功后自动选中新实例并提供继续配置 CTA", async () => {
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
});
