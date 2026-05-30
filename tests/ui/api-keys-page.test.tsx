import * as React from "react";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiKeysClient } from "@/app/(admin)/api-keys/api-keys-client";
import { CallerKeyDetail } from "@/components/api-keys/caller-key-detail";
import { RevealSecret } from "@/components/api-keys/reveal-secret";
import { renderWithTheme } from "../helpers/ui";

const callerKeyA = {
  id: "ck_001",
  callerName: "Jellyfin Living Room",
  environment: "production" as const,
  scope: "subtitles:read" as const,
  quotaPolicy: "default",
  keyPrefix: "subhub_live_",
  keySuffix: "a8f42c",
  status: "active" as const,
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
  lastUsedAt: "2026-05-28T00:20:00.000Z",
  lastRotatedAt: null,
  revealUntil: null,
};

const callerKeyB = {
  ...callerKeyA,
  id: "ck_002",
  callerName: "Infuse Theater",
  environment: "staging" as const,
  quotaPolicy: "limited",
  keySuffix: "b7129d",
  status: "suspended" as const,
};

const usage = {
  callerKeyId: "ck_001",
  lastUsedAt: "2026-05-28T00:20:00.000Z",
  searchCount: 3,
  downloadCount: 1,
  recentSearches: [],
  recentDownloads: [],
  recentRotations: [],
};

vi.mock("@/lib/api/caller-keys", () => ({
  fetchCallerKeys: vi.fn(),
  createCallerKey: vi.fn(),
  rotateCallerKey: vi.fn(),
  suspendCallerKey: vi.fn(),
  fetchCallerKeyUsage: vi.fn(),
}));

const api = await import("@/lib/api/caller-keys");
let clipboardWriteText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  clipboardWriteText = vi.fn().mockResolvedValue(undefined);
  vi.mocked(api.fetchCallerKeys).mockResolvedValue({
    items: [callerKeyA, callerKeyB],
    total: 2,
    summary: {
      activeCount: 1,
      suspendedCount: 1,
      quotaAlertCount: 1,
      rotationCount30d: 4,
    },
  });
  vi.mocked(api.fetchCallerKeyUsage).mockResolvedValue(usage);
  vi.mocked(api.createCallerKey).mockResolvedValue({
    callerKey: {
      ...callerKeyA,
      id: "ck_new",
      callerName: "Plex Study",
      keySuffix: "c9d831",
      revealUntil: "2099-05-28T00:10:00.000Z",
    },
    key: "subhub_live_created_secret_once",
  });
  vi.mocked(api.rotateCallerKey).mockResolvedValue({
    callerKey: {
      ...callerKeyA,
      id: "ck_rotated_new",
      keySuffix: "d41a65",
      revealUntil: "2099-05-28T00:10:00.000Z",
    },
    rotation: {
      id: "ckr_001",
      callerKeyId: "ck_001",
      oldKeySuffix: "a8f42c",
      newKeySuffix: "d41a65",
      result: "success",
      reason: "rotated",
      createdAt: "2026-05-28T00:01:00.000Z",
      performedByAdminUserId: "admin_001",
    },
    key: "subhub_live_rotated_secret_once",
  });
  vi.mocked(api.suspendCallerKey).mockResolvedValue({
    ...callerKeyA,
    id: "ck_rotated_new",
    status: "suspended",
    updatedAt: "2026-05-28T00:02:00.000Z",
  });

  vi.stubGlobal("navigator", {
    ...window.navigator,
    clipboard: {
      writeText: clipboardWriteText,
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("API Keys 页面", () => {
  it("空态突出首个 Key 创建入口并提示对外服务不可用", async () => {
    vi.mocked(api.fetchCallerKeys).mockResolvedValueOnce({
      items: [],
      total: 0,
      summary: {
        activeCount: 0,
        suspendedCount: 0,
        quotaAlertCount: 0,
        rotationCount30d: 0,
      },
    });

    renderWithTheme(<ApiKeysClient />);

    expect(await screen.findByText("还没有调用方 Key")).toBeInTheDocument();
    expect(
      screen.getByTestId("api-keys-service-unavailable"),
    ).toHaveTextContent("对外服务不可用");
    expect(screen.getByTestId("caller-key-form")).toHaveTextContent(
      "生成与授权",
    );
    expect(screen.getByTestId("caller-key-no-selection")).toHaveTextContent(
      "未选择 Key",
    );
  });

  it("展示摘要、inventory、表单、详情与最近使用，并默认选中首个活跃 Key", async () => {
    renderWithTheme(
      <React.StrictMode>
        <ApiKeysClient />
      </React.StrictMode>,
    );

    expect(await screen.findByTestId("api-keys-page")).toBeInTheDocument();
    expect(
      (await screen.findAllByText("Jellyfin Living Room")).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("region", { name: "Caller Key 摘要" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Rotations / 30d")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByTestId("caller-key-inventory")).toHaveTextContent(
      "Jellyfin Living Room",
    );
    expect(screen.getByTestId("caller-key-form")).toHaveTextContent(
      "生成与授权",
    );
    expect(screen.getByTestId("caller-key-detail")).toHaveTextContent(
      "Jellyfin Living Room",
    );
    expect(await screen.findByText("默认态不展示完整明文")).toBeInTheDocument();
    await waitFor(() =>
      expect(vi.mocked(api.fetchCallerKeys)).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(vi.mocked(api.fetchCallerKeyUsage)).toHaveBeenCalledWith(
        "ck_001",
        expect.any(Object),
      ),
    );
    expect(
      screen.queryByText("当前契约以已轮换版本数近似展示。"),
    ).not.toBeInTheDocument();
  });

  it("创建后进入受控 reveal window，copy 反馈不复述密钥", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ApiKeysClient />);

    expect(
      (await screen.findAllByText("Jellyfin Living Room")).length,
    ).toBeGreaterThan(0);
    await user.clear(screen.getByLabelText("调用方名称"));
    await user.type(screen.getByLabelText("调用方名称"), "Plex Study");
    await user.click(
      within(screen.getByTestId("caller-key-form")).getByRole("button", {
        name: "生成新 Key",
      }),
    );

    const success = await screen.findByTestId("caller-key-success");
    expect(success).toHaveTextContent("Plex Study 已创建");
    expect(success).not.toHaveTextContent("subhub_live_created_secret_once");
    const reveal = await screen.findByTestId("reveal-secret");

    await user.click(
      within(reveal).getByRole("button", { name: "显示完整 Caller Key" }),
    );
    expect(screen.getByLabelText("完整 Caller Key 明文")).toHaveValue(
      "subhub_live_created_secret_once",
    );
    expect(
      within(reveal).getByRole("button", { name: "复制" }),
    ).toBeInTheDocument();
  });

  it("轮换与停用使用不同高风险确认并保留成功反馈", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ApiKeysClient />);

    expect(
      (await screen.findAllByText("Jellyfin Living Room")).length,
    ).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "轮换当前 Key" }));
    expect(
      await screen.findByText("确认轮换当前 Caller Key"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认轮换" }));

    expect(await screen.findByTestId("caller-key-success")).toHaveTextContent(
      "已轮换",
    );
    expect(vi.mocked(api.rotateCallerKey)).toHaveBeenCalledWith("ck_001");
    expect(await screen.findByTestId("reveal-secret")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "停用" }));
    expect(
      await screen.findByText("确认停用当前 Caller Key"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认停用" }));

    expect(await screen.findByTestId("caller-key-success")).toHaveTextContent(
      "已停用",
    );
    expect(vi.mocked(api.suspendCallerKey)).toHaveBeenCalledWith(
      "ck_rotated_new",
    );
  });

  it("筛选隐藏选中项时详情不清空，并提示当前对象不在筛选结果中", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ApiKeysClient />);

    expect(
      (await screen.findAllByText("Jellyfin Living Room")).length,
    ).toBeGreaterThan(0);
    await user.click(screen.getByRole("tab", { name: "预发" }));

    expect(screen.getByTestId("caller-key-detail")).toHaveTextContent(
      "Jellyfin Living Room",
    );
    expect(screen.getByTestId("caller-key-hidden-by-filter")).toHaveTextContent(
      "当前对象不在筛选结果中",
    );
  });

  it("no-selection 状态不残留旧 Key 信息或 reveal/copy 动作", () => {
    renderWithTheme(
      <CallerKeyDetail
        onRevealExpired={vi.fn()}
        onRotated={vi.fn()}
        onSuspended={vi.fn()}
      />,
    );

    const noSelection = screen.getByTestId("caller-key-no-selection");
    expect(noSelection).toHaveTextContent("未选择 Key");
    expect(noSelection).toHaveTextContent("不会残留上一条 Key 的旧数据");
    expect(screen.queryByText("Jellyfin Living Room")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "复制" }),
    ).not.toBeInTheDocument();
  });
});

describe("RevealSecret", () => {
  it("受控窗口结束后隐藏明文并移除 copy 能力", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T00:00:00.000Z"));
    const onExpired = vi.fn();

    renderWithTheme(
      <RevealSecret
        secret="subhub_live_window_secret_once"
        revealUntil="2026-05-28T00:00:02.000Z"
        onExpired={onExpired}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "显示完整 Caller Key" }),
    );
    expect(screen.getByLabelText("完整 Caller Key 明文")).toHaveValue(
      "subhub_live_window_secret_once",
    );
    fireEvent.click(screen.getByRole("button", { name: "复制" }));
    expect(clipboardWriteText).toHaveBeenCalledWith(
      "subhub_live_window_secret_once",
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "已复制" })).toBeInTheDocument();

    act(() => {
      vi.setSystemTime(new Date("2026-05-28T00:00:03.000Z"));
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId("reveal-secret-expired")).toBeInTheDocument();
    expect(
      screen.queryByText("subhub_live_window_secret_once"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "复制" }),
    ).not.toBeInTheDocument();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});
