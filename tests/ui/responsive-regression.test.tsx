import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminShell } from "@/components/admin/admin-shell";
import { EmptyStateActionButton, EmptyStateCard } from "@/components/admin/empty-state-card";
import { renderWithTheme } from "../helpers/ui";

describe("后台共享布局响应式回归", () => {
  it("页面根与主内容容器禁止非预期横向滚动", () => {
    renderWithTheme(
      <AdminShell
        title="API 密钥"
        description="管理下游调用方 Key。"
        secondaryPanel={<aside>侧栏摘要</aside>}
      >
        <div>密钥列表</div>
      </AdminShell>,
    );

    expect(screen.getByTestId("admin-shell")).toHaveClass("overflow-x-hidden");
    expect(screen.getByRole("main")).toHaveClass("max-w-[1400px]", "desktop:grid-cols-[minmax(0,1fr)_20rem]");
  });

  it("空状态 CTA 在移动端保持可达且不依赖横向布局", () => {
    renderWithTheme(
      <EmptyStateCard
        icon="users"
        title="还没有可管理成员"
        description="邀请维护成员后，可在这里查看邀请、暂停和基础会话状态。"
        action={<EmptyStateActionButton>邀请成员</EmptyStateActionButton>}
      />,
    );

    expect(screen.getByTestId("empty-state-card")).toHaveClass("border-border");
    expect(screen.getByRole("button", { name: "邀请成员" })).toBeVisible();
  });
});
