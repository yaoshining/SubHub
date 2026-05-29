import * as React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UsersClient } from "@/app/(admin)/users/users-client";
import { AppError } from "@/lib/errors";
import { renderWithTheme } from "../helpers/ui";

const memberActive = {
  id: "admin_001",
  identifier: "admin@example.com",
  displayName: "Alice Admin",
  status: "active" as const,
  rolePreset: "admin" as const,
  lastActiveAt: "2026-05-28T09:00:00.000Z",
};

const memberSuspended = {
  ...memberActive,
  id: "admin_002",
  identifier: "operator@example.com",
  displayName: "Olivia Operator",
  status: "suspended" as const,
  rolePreset: "operator" as const,
  lastActiveAt: "2026-05-27T08:00:00.000Z",
};

const invitation = {
  id: "invite_001",
  identifier: "new-operator@example.com",
  status: "pending" as const,
  rolePreset: "operator" as const,
  accessPreset: "admin_console" as const,
  expiresAt: "2026-05-30T09:00:00.000Z",
  createdAt: "2026-05-28T09:00:00.000Z",
  updatedAt: "2026-05-28T09:00:00.000Z",
};

const session = {
  id: "session_001",
  memberId: "admin_001",
  status: "needs_attention" as const,
  reason: "unusual_location",
  lastSeenAt: "2026-05-28T09:10:00.000Z",
  deviceLabel: "MacBook Pro",
};

vi.mock("@/lib/api/users", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/users")>("@/lib/api/users");

  return {
    ...actual,
    fetchAdminUsersOverview: vi.fn(),
    createAdminInvitation: vi.fn(),
    suspendAdminUser: vi.fn(),
    restoreAdminUser: vi.fn(),
    remediateAdminSession: vi.fn(),
  };
});

const api = await import("@/lib/api/users");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchAdminUsersOverview).mockResolvedValue({
    members: [memberActive, memberSuspended],
    invitations: [invitation],
    sessionsNeedingAttention: [session],
  });
  vi.mocked(api.createAdminInvitation).mockResolvedValue({
    ...invitation,
    id: "invite_002",
    identifier: "fresh@example.com",
  });
  vi.mocked(api.suspendAdminUser).mockResolvedValue({
    ...memberActive,
    status: "suspended",
    updatedAt: "2026-05-28T09:30:00.000Z",
  });
  vi.mocked(api.restoreAdminUser).mockResolvedValue({
    ...memberSuspended,
    status: "active",
    updatedAt: "2026-05-28T09:30:00.000Z",
  });
  vi.mocked(api.remediateAdminSession).mockResolvedValue({
    sessionId: session.id,
    status: "remediated",
    action: "revoke",
  });
});

describe("Users 页面", () => {
  it("默认展示成员摘要、成员列表、邀请表单、详情与风险会话", async () => {
    renderWithTheme(
      <React.StrictMode>
        <UsersClient />
      </React.StrictMode>,
    );

    expect(await screen.findByTestId("users-page")).toBeInTheDocument();
    expect((await screen.findAllByText("Alice Admin")).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole("region", { name: "成员摘要" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("users-member-list")).toHaveTextContent(
      "活跃成员",
    );
    expect(screen.getByTestId("invitation-form")).toHaveTextContent(
      "策略编辑不在当前范围",
    );
    expect(screen.getByTestId("member-detail")).toHaveTextContent(
      "Alice Admin",
    );
    expect(screen.getByTestId("session-remediation")).toHaveTextContent(
      "MacBook Pro",
    );
    await waitFor(() =>
      expect(vi.mocked(api.fetchAdminUsersOverview)).toHaveBeenCalledTimes(1),
    );
  });

  it("loading 状态先展示骨架", () => {
    vi.mocked(api.fetchAdminUsersOverview).mockImplementation(
      () => new Promise(() => undefined),
    );

    renderWithTheme(<UsersClient />);

    expect(
      screen.getByRole("status", { name: "正在加载 Users 页面" }),
    ).toBeInTheDocument();
  });

  it("空态保留 Users 骨架与邀请入口", async () => {
    vi.mocked(api.fetchAdminUsersOverview).mockResolvedValueOnce({
      members: [],
      invitations: [],
      sessionsNeedingAttention: [],
    });

    renderWithTheme(<UsersClient />);

    expect(await screen.findByText("Users 当前为空")).toBeInTheDocument();
    expect(screen.getByTestId("invitation-form")).toHaveTextContent(
      "邀请新成员",
    );
    expect(screen.getByTestId("member-detail-no-selection")).toHaveTextContent(
      "未选择成员",
    );
    expect(screen.getByTestId("users-session-safe")).toHaveTextContent(
      "当前无异常会话 / 当前安全",
    );
  });

  it("区分错误态与权限态", async () => {
    vi.mocked(api.fetchAdminUsersOverview).mockRejectedValueOnce(
      new Error("读取成员失败"),
    );

    const { unmount } = renderWithTheme(<UsersClient />);

    expect(await screen.findByTestId("users-error")).toHaveTextContent(
      "读取成员失败",
    );

    unmount();

    vi.mocked(api.fetchAdminUsersOverview).mockRejectedValueOnce(
      new AppError("FORBIDDEN", "只有管理员可管理成员"),
    );

    renderWithTheme(<UsersClient />);

    expect(await screen.findByTestId("users-permission")).toHaveTextContent(
      "只有管理员可管理成员",
    );
  });

  it("可发送邀请并切换到待接受邀请筛选", async () => {
    const user = userEvent.setup();
    renderWithTheme(<UsersClient />);

    await screen.findAllByText("Alice Admin");
    await user.clear(screen.getByLabelText("邀请对象"));
    await user.type(screen.getByLabelText("邀请对象"), "fresh@example.com");
    await user.click(
      within(screen.getByTestId("invitation-form")).getByRole("button", {
        name: "发送邀请",
      }),
    );

    expect(await screen.findByTestId("users-success")).toHaveTextContent(
      "fresh@example.com 已加入待接受邀请列表",
    );
    expect(
      screen
        .getByRole("tab", { name: "待接受邀请" })
        .getAttribute("data-state"),
    ).toBe("active");
    expect(screen.getByTestId("users-member-list")).toHaveTextContent(
      "fresh@example.com",
    );
    expect(vi.mocked(api.createAdminInvitation)).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: "fresh@example.com",
        rolePreset: "operator",
        accessPreset: "admin_console",
      }),
    );
  });

  it("后续操作失败时会清除旧成功提示并保留失败上下文", async () => {
    const user = userEvent.setup();
    renderWithTheme(<UsersClient />);

    await screen.findAllByText("Alice Admin");
    await user.clear(screen.getByLabelText("邀请对象"));
    await user.type(screen.getByLabelText("邀请对象"), "fresh@example.com");
    await user.click(
      within(screen.getByTestId("invitation-form")).getByRole("button", {
        name: "发送邀请",
      }),
    );

    expect(await screen.findByTestId("users-success")).toHaveTextContent(
      "fresh@example.com 已加入待接受邀请列表",
    );

    vi.mocked(api.createAdminInvitation).mockRejectedValueOnce(
      new Error("重复待接受邀请"),
    );

    await user.clear(screen.getByLabelText("邀请对象"));
    await user.type(screen.getByLabelText("邀请对象"), "fresh@example.com");
    await user.click(
      within(screen.getByTestId("invitation-form")).getByRole("button", {
        name: "发送邀请",
      }),
    );

    expect(await screen.findByText("重复待接受邀请")).toBeInTheDocument();
    expect(screen.queryByTestId("users-success")).not.toBeInTheDocument();
  });

  it("完成会话处置后移除风险对象并显示成功反馈", async () => {
    const user = userEvent.setup();
    renderWithTheme(<UsersClient />);

    expect(await screen.findByText("MacBook Pro")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "撤销会话" }));
    await user.clear(screen.getByLabelText("处置原因"));
    await user.type(screen.getByLabelText("处置原因"), "管理员复核后确认风险");
    await user.click(screen.getByRole("button", { name: "确认撤销" }));

    expect(await screen.findByTestId("users-success")).toHaveTextContent(
      "风险会话已撤销",
    );
    expect(vi.mocked(api.remediateAdminSession)).toHaveBeenCalledWith(
      "session_001",
      {
        action: "revoke",
        reason: "管理员复核后确认风险",
      },
    );
    expect(await screen.findByTestId("users-session-safe")).toBeInTheDocument();
  });

  it("筛选隐藏当前选中成员时仍保留详情上下文", async () => {
    const user = userEvent.setup();
    renderWithTheme(<UsersClient />);

    await screen.findAllByText("Alice Admin");
    await user.click(screen.getByRole("tab", { name: "待接受邀请" }));

    expect(screen.getByTestId("member-detail")).toHaveTextContent(
      "Alice Admin",
    );
    expect(screen.getByTestId("member-hidden-by-filter")).toHaveTextContent(
      "当前成员不在筛选结果中",
    );
    expect(
      within(screen.getByTestId("users-member-list")).getAllByText(
        "new-operator@example.com",
      ).length,
    ).toBeGreaterThan(0);
  });
});
