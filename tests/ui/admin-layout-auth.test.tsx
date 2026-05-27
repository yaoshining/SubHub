import * as React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminLayout from "@/app/(admin)/layout";
import { AppError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
  requireActiveAdminSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
  headers: mocks.headers,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth/session", () => ({
  adminRequestPathHeader: "x-subhub-admin-pathname",
  adminSessionCookieName: "subhub_admin_session",
  requireActiveAdminSession: mocks.requireActiveAdminSession,
}));

vi.mock("@/components/admin/protected-layout", () => ({
  ProtectedLayout: ({
    children,
    user,
  }: {
    children: React.ReactNode;
    user?: { displayName: string; identifier: string };
  }) => (
    <section
      data-testid="protected-layout"
      data-user-display-name={user?.displayName ?? ""}
      data-user-identifier={user?.identifier ?? ""}
    >
      {children}
    </section>
  ),
}));

describe("AdminLayout 认证上下文注入", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue({
      get: vi.fn(() => null),
    });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  it("读取有效管理员会话并将当前用户摘要传入受保护后台布局", async () => {
    const cookieStore = {
      get: vi.fn(() => ({ value: "valid-admin-session-token" })),
    };
    mocks.cookies.mockResolvedValue(cookieStore);
    mocks.requireActiveAdminSession.mockResolvedValue({
      adminUser: {
        displayName: "SubHub Admin",
        identifier: "admin@subhub.local",
      },
    });

    const element = await AdminLayout({
      children: <div>受保护内容</div>,
    });

    render(element);

    expect(cookieStore.get).toHaveBeenCalledWith("subhub_admin_session");
    expect(mocks.requireActiveAdminSession).toHaveBeenCalledWith(
      "valid-admin-session-token",
      { touchLastSeen: true },
    );
    expect(screen.getByTestId("protected-layout")).toHaveAttribute(
      "data-user-display-name",
      "SubHub Admin",
    );
    expect(screen.getByTestId("protected-layout")).toHaveAttribute(
      "data-user-identifier",
      "admin@subhub.local",
    );
    expect(screen.getByText("受保护内容")).toBeInTheDocument();
  });

  it("失效管理员会话会回到登录页并保留原后台路径", async () => {
    const cookieStore = {
      get: vi.fn(() => ({ value: "expired-admin-session-token" })),
    };
    mocks.cookies.mockResolvedValue(cookieStore);
    mocks.headers.mockResolvedValue({
      get: vi.fn((name: string) =>
        name === "x-subhub-admin-pathname" ? "/dashboard" : null,
      ),
    });
    mocks.requireActiveAdminSession.mockRejectedValue(
      new AppError(
        "AUTHENTICATION_REQUIRED",
        "管理员会话已过期。",
        "admin_session",
      ),
    );

    await expect(
      AdminLayout({
        children: <div>受保护内容</div>,
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/login?next=%2Fdashboard");

    expect(mocks.redirect).toHaveBeenCalledWith("/login?next=%2Fdashboard");
  });
});
