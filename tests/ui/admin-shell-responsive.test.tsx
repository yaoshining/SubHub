import { renderWithTheme, setMockPathname } from "../helpers/ui";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeader } from "@/components/admin/page-header";
import { ResponsiveDrawer } from "@/components/admin/responsive-drawer";

describe("Admin Shell 响应式骨架", () => {
  it("Desktop 保留常驻 Sidebar，并约束页面根不横向滚动", () => {
    setMockPathname("/dashboard");

    renderWithTheme(
      <AdminShell title="仪表盘" description="系统健康与下一步入口">
        <section>主体内容</section>
      </AdminShell>,
    );

    expect(screen.getByTestId("admin-shell")).toHaveClass("overflow-x-hidden");
    expect(screen.getByTestId("admin-sidebar")).toHaveClass(
      "hidden",
      "desktop:flex",
      "desktop:fixed",
    );
    expect(screen.getByTestId("admin-shell")).toHaveClass(
      "desktop:h-screen",
      "desktop:overflow-hidden",
    );
    expect(screen.getByTestId("admin-content-region")).toHaveClass(
      "desktop:pl-[var(--sidebar-width)]",
      "desktop:h-screen",
      "desktop:overflow-y-auto",
    );
    expect(screen.getByRole("link", { name: "仪表盘" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("page-header")).toHaveTextContent("仪表盘");
  });

  it("客户端路由切换后，Page Header 会按 pathname 更新而不是停留在首屏标题", () => {
    setMockPathname("/dashboard");

    const { rerender } = renderWithTheme(
      <AdminShell
        title="仪表盘"
        description="查看 SubHub 当前运营状态与下一步配置入口。"
      >
        <section>主体内容</section>
      </AdminShell>,
    );

    expect(screen.getByTestId("page-header")).toHaveTextContent("仪表盘");

    setMockPathname("/providers");
    rerender(
      <AdminShell
        title="仪表盘"
        description="查看 SubHub 当前运营状态与下一步配置入口。"
      >
        <section>主体内容</section>
      </AdminShell>,
    );

    expect(screen.getByTestId("page-header")).toHaveTextContent("服务商");
    expect(screen.getByTestId("page-header")).toHaveTextContent(
      "比较 Provider 状态、创建 OpenSubtitles 实例并检查凭据池。",
    );
  });

  it("Tablet/Mobile 使用菜单按钮打开 Drawer，导航后自动关闭", async () => {
    const user = userEvent.setup();
    setMockPathname("/providers");

    renderWithTheme(<ResponsiveDrawer />);

    await user.click(screen.getByRole("button", { name: "打开后台导航" }));
    const dialog = screen.getByRole("dialog", { name: "后台导航" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("data-vaul-drawer-direction", "left");
    expect(screen.getByTestId("admin-sidebar")).toHaveClass("w-sidebar");
    expect(screen.getByRole("link", { name: "服务商" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const apiKeysLink = screen.getByRole("link", { name: "API 密钥" });
    apiKeysLink.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    await user.click(apiKeysLink);
    expect(screen.getByRole("dialog", { name: "后台导航" })).toHaveAttribute(
      "data-state",
      "closed",
    );
  });

  it("Drawer 支持 Esc 关闭路径", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ResponsiveDrawer />);

    await user.click(screen.getByRole("button", { name: "打开后台导航" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "后台导航" })).toHaveAttribute(
      "data-state",
      "closed",
    );
  });

  it("Drawer 支持遮罩关闭路径", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ResponsiveDrawer />);

    await user.click(screen.getByRole("button", { name: "打开后台导航" }));
    const overlay = document.querySelector("[data-vaul-overlay]");
    expect(overlay).toBeTruthy();
    await user.click(overlay as Element);
    expect(screen.getByRole("dialog", { name: "后台导航" })).toHaveAttribute(
      "data-state",
      "closed",
    );
  });

  it("Page Header 在小屏保持单列，在桌面允许标题与操作并排", () => {
    renderWithTheme(
      <PageHeader
        title="服务商"
        description="配置 OpenSubtitles 与凭据池。"
        actions={<button type="button">新增 OpenSubtitles</button>}
      />,
    );

    const header = screen.getByTestId("page-header");
    expect(header).toHaveClass("flex-col", "desktop:flex-row");
    expect(
      screen.getByRole("button", { name: "新增 OpenSubtitles" }),
    ).toBeVisible();
  });
});
