import * as React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SubtitleApiValidatorClient } from "@/app/(admin)/subtitle-api-validator/subtitle-api-validator-client";
import { AppError } from "@/lib/errors";
import { renderWithTheme } from "../helpers/ui";

vi.mock("@/lib/api/subtitle-validator", () => ({
  fetchSubtitleValidatorProviders: vi.fn(),
  runSubtitleValidatorSearch: vi.fn(),
  validateSubtitleValidatorDownload: vi.fn(),
}));

const api = await import("@/lib/api/subtitle-validator");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Subtitle API Validator 诊断状态", () => {
  it("无权限时显示明确拒绝态", async () => {
    vi.mocked(api.fetchSubtitleValidatorProviders).mockRejectedValue(
      new AppError("FORBIDDEN", "仅管理员可访问该页面。", "admin_session"),
    );

    renderWithTheme(<SubtitleApiValidatorClient />);

    expect(await screen.findByText("无权限访问")).toBeInTheDocument();
    expect(screen.getByText("仅管理员可访问该页面。")).toBeInTheDocument();
  });

  it("provider 列表为空时显示结构化空态", async () => {
    vi.mocked(api.fetchSubtitleValidatorProviders).mockResolvedValue({
      items: [],
      total: 0,
    });

    renderWithTheme(<SubtitleApiValidatorClient />);

    expect(
      await screen.findByText(
        "当前没有可验证对象。请先回到 Provider 管理页完成基础配置，再回到此页发起搜索或下载验证。",
      ),
    ).toBeInTheDocument();
  });

  it("provider 列表读取失败时提供可用的重试入口", async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchSubtitleValidatorProviders)
      .mockRejectedValueOnce(new Error("网络暂时不可用"))
      .mockResolvedValueOnce({ items: [], total: 0 });

    renderWithTheme(<SubtitleApiValidatorClient />);

    expect(await screen.findByText("Provider 列表不可用")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "重试读取" })[0]);

    await waitFor(() =>
      expect(
        vi.mocked(api.fetchSubtitleValidatorProviders),
      ).toHaveBeenCalledTimes(2),
    );
    expect(
      await screen.findByText(
        "当前没有可验证对象。请先回到 Provider 管理页完成基础配置，再回到此页发起搜索或下载验证。",
      ),
    ).toBeInTheDocument();
  });
});
