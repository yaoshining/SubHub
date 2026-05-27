import { renderWithTheme, setMockRouter } from "../helpers/ui";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginClient } from "@/app/login/login-client";
import {
  bootstrapInitialAdmin,
  fetchBootstrapStatus,
  fetchCurrentAdmin,
  loginAdminUser,
} from "@/lib/api/admin-auth";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/api/admin-auth", () => ({
  bootstrapInitialAdmin: vi.fn(),
  fetchBootstrapStatus: vi.fn(),
  fetchCurrentAdmin: vi.fn(),
  loginAdminUser: vi.fn(),
}));

const mockedFetchCurrentAdmin = vi.mocked(fetchCurrentAdmin);
const mockedFetchBootstrapStatus = vi.mocked(fetchBootstrapStatus);
const mockedLoginAdminUser = vi.mocked(loginAdminUser);
const mockedBootstrapInitialAdmin = vi.mocked(bootstrapInitialAdmin);

describe("Login 页面体验", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockRouter();
    mockedFetchCurrentAdmin.mockRejectedValue(
      new AppError("AUTHENTICATION_REQUIRED", "未登录。"),
    );
    mockedFetchBootstrapStatus.mockResolvedValue({ initialized: true });
  });

  it("默认登录态不显示后台 Shell，并展示 SSO / 2FA 未启用提示", async () => {
    renderWithTheme(<LoginClient returnTo="/dashboard" />);

    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-sidebar")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "登录" })).toBeEnabled();
    expect(screen.getByText(/SSO 与 2FA 当前未启用/)).toBeInTheDocument();
  });

  it("登录失败保留非敏感字段并清空密码", async () => {
    const user = userEvent.setup();
    mockedLoginAdminUser.mockRejectedValue(
      new AppError("AUTHENTICATION_REQUIRED", "管理员标识或密码不正确。"),
    );

    renderWithTheme(<LoginClient returnTo="/providers" />);

    const identifierInput = await screen.findByLabelText("邮箱或用户名");
    const passwordInput = screen.getByLabelText("密码");
    await user.type(identifierInput, "admin@subhub.local");
    await user.type(passwordInput, "wrong-password");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByText("登录失败")).toBeInTheDocument();
    expect(identifierInput).toHaveValue("admin@subhub.local");
    expect(passwordInput).toHaveValue("");
  });

  it("未初始化时在同一路由切换为首个管理员创建表单", async () => {
    const user = userEvent.setup();
    mockedFetchBootstrapStatus.mockResolvedValue({ initialized: false });
    mockedBootstrapInitialAdmin.mockResolvedValue({
      adminUserId: "admin_1",
      status: "active",
    });

    renderWithTheme(<LoginClient returnTo="/dashboard" />);

    expect(
      await screen.findByRole("button", { name: "创建首个管理员" }),
    ).toBeEnabled();

    await user.type(screen.getByLabelText("管理员标识"), "owner@subhub.local");
    await user.type(screen.getByLabelText("显示名称"), "Owner");
    const passwordInputs = screen.getAllByLabelText(/密码/);
    await user.type(passwordInputs[0]!, "safe-password");
    await user.type(passwordInputs[1]!, "safe-password");
    await user.click(screen.getByRole("button", { name: "创建首个管理员" }));

    expect(await screen.findByText("首个管理员已创建")).toBeInTheDocument();
    expect(screen.getByLabelText("邮箱或用户名")).toHaveValue(
      "owner@subhub.local",
    );
  });

  it("已登录访问时返回原目标页", async () => {
    const router = setMockRouter();
    mockedFetchCurrentAdmin.mockResolvedValue({
      id: "admin_1",
      identifier: "admin@subhub.local",
      displayName: "Admin",
      role: "admin",
    });

    renderWithTheme(<LoginClient returnTo="/api-keys" />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/api-keys");
    });
  });
});
