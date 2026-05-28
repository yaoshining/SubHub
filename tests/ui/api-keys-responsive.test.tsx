import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiKeysClient } from "@/app/(admin)/api-keys/api-keys-client";
import { renderWithTheme, mockViewport } from "../helpers/ui";

const callerKey = {
  id: "ck_001",
  callerName: "Jellyfin Living Room",
  environment: "production" as const,
  scope: "subtitles:read" as const,
  quotaPolicy: "default",
  keyPrefix: "subhub_live_",
  keySuffix: "a8f42c",
  status: "active" as const,
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
  lastUsedAt: null,
  lastRotatedAt: null,
  revealUntil: null,
};

vi.mock("@/lib/api/caller-keys", () => ({
  fetchCallerKeys: vi.fn(),
  createCallerKey: vi.fn(),
  rotateCallerKey: vi.fn(),
  suspendCallerKey: vi.fn(),
  fetchCallerKeyUsage: vi.fn(),
}));

const api = await import("@/lib/api/caller-keys");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchCallerKeys).mockResolvedValue({
    items: [callerKey],
    total: 1,
  });
  vi.mocked(api.fetchCallerKeyUsage).mockResolvedValue({
    callerKeyId: callerKey.id,
    lastUsedAt: null,
    searchCount: 0,
    downloadCount: 0,
    recentSearches: [],
    recentDownloads: [],
    recentRotations: [],
  });
});

describe("API Keys 响应式行为", () => {
  it("Tablet 下 inventory 与详情不使用桌面双栏断点", async () => {
    mockViewport(834);
    renderWithTheme(<ApiKeysClient />);

    expect(await screen.findByTestId("api-keys-responsive-grid")).toHaveClass(
      "grid",
      "gap-6",
      "desktop:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]",
    );
    expect(
      (await screen.findAllByText("Jellyfin Living Room")).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByTestId("api-keys-responsive-grid").className,
    ).not.toContain("tablet:grid-cols");
    expect(screen.getByTestId("caller-key-inventory")).toBeInTheDocument();
    expect(screen.getByTestId("caller-key-detail")).toBeInTheDocument();
  });

  it("Mobile 下提供卡片化 inventory、详情与主操作可达", async () => {
    mockViewport(390);
    renderWithTheme(<ApiKeysClient />);

    expect(
      (await screen.findAllByText("Jellyfin Living Room")).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "生成新 Key" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByTestId("caller-key-inventory")).toHaveTextContent(
      "subhub_live_…a8f42c",
    );
    expect(screen.getByTestId("caller-key-detail")).toHaveTextContent(
      "默认态不展示完整明文",
    );
  });
});
