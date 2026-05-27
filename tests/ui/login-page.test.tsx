import { renderWithTheme, setMockRouter } from "../helpers/ui";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginClient } from "@/app/login/login-client";
import {
  bootstrapInitialAdmin,
  fetchBootstrapStatus,
  loginAdminUser,
} from "@/lib/api/admin-auth";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/api/admin-auth", () => ({
  bootstrapInitialAdmin: vi.fn(),
  fetchBootstrapStatus: vi.fn(),
  loginAdminUser: vi.fn(),
}));

const mockedFetchBootstrapStatus = vi.mocked(fetchBootstrapStatus);
const mockedLoginAdminUser = vi.mocked(loginAdminUser);
const mockedBootstrapInitialAdmin = vi.mocked(bootstrapInitialAdmin);
const LoginClientWithSessionNotice = LoginClient as React.ComponentType<{
  returnTo: string;
  sessionNotice?: string | null;
}>;

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

describe("Login 页面体验", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockRouter();
    mockedFetchBootstrapStatus.mockResolvedValue({ initialized: true });
  });

  it("默认登录态不显示后台 Shell，并展示 SSO / 2FA 未启用提示", async () => {
    renderWithTheme(<LoginClient returnTo="/dashboard" />);

    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-sidebar")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "登录" })).toBeEnabled();
    expect(screen.getByText(/SSO 与 2FA 当前未启用/)).toBeInTheDocument();
    expect(mockedFetchBootstrapStatus).toHaveBeenCalledTimes(1);
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

  it("从失效会话返回登录页时展示明确提示", async () => {
    renderWithTheme(
      <LoginClientWithSessionNotice
        returnTo="/dashboard"
        sessionNotice="管理员会话已失效，请重新登录。"
      />,
    );

    expect(await screen.findByText("会话需要重新登录")).toBeInTheDocument();
    expect(
      screen.getByText("管理员会话已失效，请重新登录。"),
    ).toBeInTheDocument();
  });

  it("登录提交中禁用重复提交，成功后返回原受保护目标", async () => {
    const user = userEvent.setup();
    const router = setMockRouter();
    const deferred = createDeferred<{
      id: string;
      identifier: string;
      displayName: string;
      role: "admin";
    }>();
    mockedLoginAdminUser.mockReturnValue(deferred.promise);

    renderWithTheme(<LoginClient returnTo="/providers" />);

    await user.type(
      await screen.findByLabelText("邮箱或用户名"),
      "admin@subhub.local",
    );
    await user.type(screen.getByLabelText("密码"), "CorrectHorse42!");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(
      await screen.findByRole("button", { name: "正在登录..." }),
    ).toBeDisabled();
    expect(mockedLoginAdminUser).toHaveBeenCalledWith({
      identifier: "admin@subhub.local",
      password: "CorrectHorse42!",
      deviceLabel: "SubHub Admin Console",
    });

    deferred.resolve({
      id: "admin_1",
      identifier: "admin@subhub.local",
      displayName: "Admin",
      role: "admin",
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/providers");
    });
  });

  it("未初始化时在同一路由切换为首个管理员创建表单", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<{
      adminUserId: string;
      status: "active";
    }>();
    mockedFetchBootstrapStatus.mockResolvedValue({ initialized: false });
    mockedBootstrapInitialAdmin.mockReturnValue(deferred.promise);

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

    expect(
      await screen.findByRole("button", { name: "正在创建..." }),
    ).toBeDisabled();
    deferred.resolve({
      adminUserId: "admin_1",
      status: "active",
    });

    expect(await screen.findByText("首个管理员已创建")).toBeInTheDocument();
    expect(screen.getByLabelText("邮箱或用户名")).toHaveValue(
      "owner@subhub.local",
    );
  });

  it("初始化状态请求失败时展示错误提示", async () => {
    mockedFetchBootstrapStatus.mockRejectedValue(
      new AppError("UPSTREAM_FAILED", "请求处理失败。"),
    );

    renderWithTheme(<LoginClient returnTo="/dashboard" />);

    await waitFor(() => {
      expect(screen.getByText("无法确认初始化状态")).toBeInTheDocument();
    });
  });
});
