import { renderWithTheme, setMockPathname } from "../helpers/ui";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminShell } from "@/components/admin/admin-shell";
import { Sidebar } from "@/components/admin/sidebar";
import { StatusBadge } from "@/components/admin/status-badge";

describe("后台共享组件可访问性", () => {
  it("图标按钮提供 aria-label，导航提供当前页语义", () => {
    setMockPathname("/settings");
    renderWithTheme(<Sidebar />);

    expect(
      screen.getByRole("navigation", { name: "后台主导航" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "设置" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("button", { name: "切换到浅色主题" }),
    ).toBeInTheDocument();
  });

  it("Admin Shell 保持 main landmark 与状态 Badge 文案可读", () => {
    renderWithTheme(
      <AdminShell title="用户" description="管理后台成员。">
        <StatusBadge tone="success">已启用</StatusBadge>
        <StatusBadge tone="destructive">已停用</StatusBadge>
      </AdminShell>,
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByText("已启用")).toHaveAttribute(
      "data-status-tone",
      "success",
    );
  });
});
