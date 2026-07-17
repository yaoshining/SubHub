import * as React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SubtitleApiValidatorClient } from "@/app/(admin)/subtitle-api-validator/subtitle-api-validator-client";
import { AppError } from "@/lib/errors";
import {
  createProviderCapability,
  createSearchResultData,
} from "./subtitle-validator-test-data";
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

  it("将搜索空结果的错误类别、下一步建议与动作摘要展示在 Diagnostic Snapshot", async () => {
    const user = userEvent.setup();
    const provider = createProviderCapability({
      providerId: "provider-os",
      providerName: "OpenSubtitles",
    });
    vi.mocked(api.fetchSubtitleValidatorProviders).mockResolvedValue({
      items: [provider],
      total: 1,
    });
    vi.mocked(api.runSubtitleValidatorSearch).mockResolvedValue(
      createSearchResultData({
        diagnostic: {
          action: "search",
          provider: "opensubtitles",
          providerName: "OpenSubtitles",
          providerStatus: "enabled",
          status: "empty",
          resultCount: 0,
          elapsedMs: 120,
          summary: "没有匹配的字幕结果。",
          errorCategory: "empty_results",
          nextActionHint: "调整关键词或语言后重试。",
          fileName: null,
          downloadMode: null,
        },
      }),
    );

    renderWithTheme(<SubtitleApiValidatorClient />);

    await screen.findByRole("button", { name: /OpenSubtitles/ });
    await user.type(screen.getByLabelText("关键词 / 标题"), "Matrix");
    await user.click(screen.getByRole("button", { name: "搜索验证" }));

    expect(await screen.findAllByText("空结果")).not.toHaveLength(0);
    expect(screen.getByText("动作：搜索验证")).toBeInTheDocument();
    expect(screen.getByText("错误类别：empty_results")).toBeInTheDocument();
    expect(
      screen.getAllByText("下一步建议：调整关键词或语言后重试。"),
    ).not.toHaveLength(0);
  });
  it("搜索失败时在 Diagnostic Snapshot 展示服务端结构化类别与建议", async () => {
    const user = userEvent.setup();
    const provider = createProviderCapability({ providerId: "provider-os" });
    vi.mocked(api.fetchSubtitleValidatorProviders).mockResolvedValue({
      items: [provider],
      total: 1,
    });
    vi.mocked(api.runSubtitleValidatorSearch).mockRejectedValue(
      new AppError("TIMEOUT", "OpenSubtitles 搜索超时。", "provider", {
        diagnostic: {
          action: "search",
          provider: "opensubtitles",
          providerName: "OpenSubtitles",
          providerStatus: "enabled",
          status: "error",
          resultCount: 0,
          elapsedMs: 1200,
          summary: "OpenSubtitles 搜索超时。",
          errorCategory: "timeout",
          nextActionHint: "稍后重试。",
          fileName: null,
          downloadMode: null,
        },
      }),
    );

    renderWithTheme(<SubtitleApiValidatorClient />);
    await screen.findByRole("button", { name: /OpenSubtitles/ });
    await user.type(screen.getByLabelText("关键词 / 标题"), "Matrix");
    await user.click(screen.getByRole("button", { name: "搜索验证" }));

    expect(await screen.findByText("错误类别：timeout")).toBeInTheDocument();
    expect(screen.getByText("下一步建议：稍后重试。")).toBeInTheDocument();
    expect(screen.getByText("动作：搜索验证")).toBeInTheDocument();
  });
});
