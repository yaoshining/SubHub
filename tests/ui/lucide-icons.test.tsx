import { renderWithTheme } from "../helpers/ui";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyStateCard } from "@/components/admin/empty-state-card";
import { navigationItems } from "@/components/admin/sidebar";
import { lucideIcons } from "@/components/icons/lucide";

const requiredIconNames = [
  "menu",
  "panel-left",
  "settings",
  "users",
  "shield",
  "key-round",
  "layout-dashboard",
  "server",
  "cloud-off",
  "moon",
  "sun",
] as const;

describe("Lucide 图标基线", () => {
  it("集中导出约定 Lucide 命名", () => {
    for (const iconName of requiredIconNames) {
      expect(lucideIcons[iconName]).toBeDefined();
    }
  });

  it("后台导航使用 page spec 约定的 Lucide 语义", () => {
    expect(navigationItems.map((item) => item.iconName)).toEqual([
      "layout-dashboard",
      "server",
      "key-round",
      "users",
      "settings",
    ]);
  });

  it("共享空状态仅允许设计稿沉淀的 Lucide 图标", () => {
    const { rerender } = renderWithTheme(
      <EmptyStateCard
        icon="cloud-off"
        title="还没有服务商"
        description="新增 OpenSubtitles 后才能对外提供字幕服务。"
      />,
    );
    expect(screen.getByTestId("empty-state-card")).toHaveAttribute(
      "data-empty-icon",
      "cloud-off",
    );

    rerender(
      <EmptyStateCard
        icon="key-round"
        title="还没有 API 密钥"
        description="创建调用方 Key 后，外部应用才能访问统一字幕出口。"
      />,
    );
    expect(screen.getByTestId("empty-state-card")).toHaveAttribute(
      "data-empty-icon",
      "key-round",
    );

    rerender(
      <EmptyStateCard
        icon="users"
        title="还没有成员邀请"
        description="邀请维护成员后，可在这里查看访问状态。"
      />,
    );
    expect(screen.getByTestId("empty-state-card")).toHaveAttribute(
      "data-empty-icon",
      "users",
    );
  });
});
