import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UsersClient } from "@/app/(admin)/users/users-client";
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

vi.mock("@/lib/api/users", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/users")>(
    "@/lib/api/users",
  );

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
    sessionsNeedingAttention: [],
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
});

describe("Users 响应式行为", () => {
  it("Tablet 下保持单列堆叠并保留横向 Tabs 筛选", async () => {
    renderWithTheme(<UsersClient />);

    expect(await screen.findByTestId("users-layout-grid")).toBeInTheDocument();
    const layout = screen.getByTestId("users-layout-grid");
    expect(layout).toHaveClass(
      "grid",
      "min-w-0",
      "gap-6",
      "desktop:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.85fr)]",
    );
    expect(layout.className).not.toContain("tablet:grid-cols");
    expect(screen.getByTestId("member-list-tabs")).toHaveClass(
      "w-full",
      "justify-start",
      "overflow-x-auto",
    );
  });

  it("Mobile 下显示选中成员动作条，保证高风险动作可达", async () => {
    renderWithTheme(<UsersClient />);

    const selectionBar = await screen.findByTestId("users-mobile-selection-bar");
    expect(selectionBar).toHaveTextContent("当前选中：Alice Admin");
    expect(selectionBar.querySelector("a")).toHaveAttribute(
      "href",
      "#member-risk-actions",
    );
    expect(selectionBar).toHaveClass("md:hidden");
  });

  it("暂停 / 恢复在窄屏场景下仍保留二次确认", async () => {
    const user = userEvent.setup();
    renderWithTheme(<UsersClient />);

    await screen.findAllByText("Alice Admin");
    await user.click(screen.getByRole("button", { name: "暂停成员" }));
    expect(await screen.findByText("确认暂停当前成员")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认暂停" }));

    expect(vi.mocked(api.suspendAdminUser)).toHaveBeenCalledWith("admin_001");
    expect(await screen.findByTestId("users-success")).toHaveTextContent(
      "Alice Admin 已暂停",
    );
  });
});
