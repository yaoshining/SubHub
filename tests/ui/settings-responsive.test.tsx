import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsClient } from "@/app/(admin)/settings/settings-client";
import { renderWithTheme } from "../helpers/ui";

vi.mock("@/lib/api/settings", () => ({
  fetchSettingsStatus: vi.fn(),
}));

const settingsStatus = {
  environment: "production",
  version: "0.1.0",
  adminInitialized: true,
  activeProviderCount: 1,
  activeCallerKeyCount: 1,
  gatewayReady: true,
  missingConditions: [],
  lastCheckedAt: "2026-05-30T12:00:00.000Z",
  partialErrors: [],
};

describe("Settings 响应式行为", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("页面根容器保持单列分组并阻止横向滚动", () => {
    renderWithTheme(<SettingsClient initialStatus={settingsStatus} />);

    expect(screen.getByTestId("settings-page")).toHaveClass(
      "grid",
      "min-w-0",
      "gap-6",
      "overflow-x-hidden",
    );
    expect(screen.getByTestId("settings-content").className).not.toContain(
      "desktop:grid-cols",
    );
  });

  it("配置分流与后续能力在 Tablet 下保持单列，Desktop 再提升为双列", () => {
    renderWithTheme(<SettingsClient initialStatus={settingsStatus} />);

    expect(screen.getByTestId("settings-config-routing-grid")).toHaveClass(
      "grid",
      "gap-4",
      "desktop:grid-cols-2",
    );
    expect(
      screen.getByTestId("settings-config-routing-grid").className,
    ).not.toContain("tablet:grid-cols");
    expect(screen.getByTestId("settings-future-capabilities")).toHaveClass(
      "grid",
      "gap-4",
      "desktop:grid-cols-2",
    );
  });

  it("状态卡在 Desktop/Tablet 可局部分栏，但页头动作保持无保存语义", () => {
    renderWithTheme(<SettingsClient initialStatus={settingsStatus} />);

    expect(screen.getByTestId("settings-readiness-cards")).toHaveClass(
      "grid",
      "gap-4",
      "tablet:grid-cols-2",
      "desktop:grid-cols-4",
    );
    expect(screen.getByTestId("settings-header-panel")).toHaveClass(
      "flex",
      "flex-col",
      "gap-4",
    );
    expect(
      screen.queryByRole("button", { name: /保存|提交|测试连接/ }),
    ).not.toBeInTheDocument();
  });
});
