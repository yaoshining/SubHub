import { readFileSync } from "node:fs";
import path from "node:path";

import { renderWithTheme } from "../helpers/ui";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyStateCard } from "@/components/admin/empty-state-card";
import { navigationItems } from "@/components/admin/sidebar";
import { lucideIcons } from "@/components/icons/lucide";

type PencilNode = {
  name?: string;
  content?: string;
  iconFontName?: string;
  icon?: string;
  library?: string;
  children?: PencilNode[];
};

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

const requiredDesignIconNames = [
  "cloud-off",
  "key-round",
  "users",
  "layout-dashboard",
  "server",
  "settings",
  "menu",
  "panel-left",
  "moon",
  "sun",
] as const;

function findNodeByName(
  node: PencilNode,
  name: string,
): PencilNode | undefined {
  if (node.name === name) {
    return node;
  }

  for (const child of node.children ?? []) {
    const matchedNode = findNodeByName(child, name);
    if (matchedNode) {
      return matchedNode;
    }
  }

  return undefined;
}

describe("Lucide 图标基线", () => {
  it("集中导出约定 Lucide 命名", () => {
    for (const iconName of requiredIconNames) {
      expect(lucideIcons[iconName]).toBeDefined();
    }
  });

  it("设计稿 Assets / Icons / Lucide 约定图标与实现侧命名保持一致", () => {
    const designSource = readFileSync(
      path.resolve(process.cwd(), "design/main.pen"),
      "utf8",
    );
    const designDocument = JSON.parse(designSource) as PencilNode;
    const lucideAssetsNode = findNodeByName(
      designDocument,
      "Assets / Icons / Lucide",
    );

    expect(lucideAssetsNode?.name).toBe("Assets / Icons / Lucide");

    for (const iconName of requiredDesignIconNames) {
      const iconFrameNode = findNodeByName(lucideAssetsNode ?? {}, iconName);
      const iconNode = iconFrameNode?.children?.find((child) =>
        child.name?.endsWith("-icon"),
      );
      const labelNode = iconFrameNode?.children?.find(
        (child) => child.content === iconName,
      );

      expect(iconFrameNode?.name).toBe(iconName);
      expect(labelNode?.content).toBe(iconName);
      expect(
        iconNode?.iconFontName === iconName ||
          (iconNode?.icon === iconName && iconNode.library === "lucide"),
      ).toBe(true);
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
