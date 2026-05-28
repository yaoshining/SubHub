import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  vi.mocked(api.rotateCallerKey).mockResolvedValue({
    callerKey: {
      ...callerKey,
      id: "ck_rotated",
      keySuffix: "d41a65",
      revealUntil: "2099-05-28T00:10:00.000Z",
    },
    rotation: {
      id: "ckr_001",
      callerKeyId: callerKey.id,
      oldKeySuffix: callerKey.keySuffix,
      newKeySuffix: "d41a65",
      result: "success",
      reason: "rotated",
      createdAt: "2026-05-28T00:01:00.000Z",
      performedByAdminUserId: "admin_001",
    },
    key: "subhub_live_rotated_secret_once",
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

  it("Desktop 双栏容器允许 inventory 列收缩，避免详情区被表格最小宽度挤乱", async () => {
    mockViewport(1440);
    renderWithTheme(<ApiKeysClient />);

    expect(await screen.findByTestId("api-keys-responsive-grid")).toHaveClass(
      "min-w-0",
      "desktop:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]",
    );
    expect(screen.getByTestId("api-keys-primary-column")).toHaveClass(
      "min-w-0",
    );
    expect(screen.getByTestId("api-keys-detail-column")).toHaveClass("min-w-0");
    expect(await screen.findByTestId("caller-key-inventory")).toHaveClass(
      "min-w-0",
      "overflow-hidden",
    );
    expect(screen.getByTestId("caller-key-inventory-content")).toHaveClass(
      "min-w-0",
    );
    expect(screen.getByTestId("caller-key-inventory-table-shell")).toHaveClass(
      "min-w-0",
      "max-w-full",
      "overflow-x-auto",
    );
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

  it("Mobile 下 reveal 明文可读，且高风险轮换仍需二次确认", async () => {
    const user = userEvent.setup();
    mockViewport(390);
    renderWithTheme(<ApiKeysClient />);

    expect(await screen.findByTestId("caller-key-detail")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "轮换当前 Key" }));
    expect(
      await screen.findByText("确认轮换当前 Caller Key"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认轮换" }));

    const reveal = await screen.findByTestId("reveal-secret");
    await user.click(
      screen.getByRole("button", { name: "显示完整 Caller Key" }),
    );

    expect(screen.getByLabelText("完整 Caller Key 明文")).toHaveClass(
      "mobile:min-h-32",
    );
    expect(screen.getByLabelText("完整 Caller Key 明文")).toHaveValue(
      "subhub_live_rotated_secret_once",
    );
    expect(reveal).toHaveTextContent("复制成功反馈不会复述密钥内容");
  });
});
