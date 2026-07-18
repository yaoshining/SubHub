import * as React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SubtitleApiValidatorClient } from "@/app/(admin)/subtitle-api-validator/subtitle-api-validator-client";
import {
  createDownloadValidationResult,
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

const openSubtitlesProvider = createProviderCapability({
  providerId: "provider-os",
  providerKey: "opensubtitles",
  providerName: "OpenSubtitles",
  credentialCount: 2,
  availableCredentialCount: 2,
  notes: ["依赖有效凭据池。"],
});

const xunleiProvider = createProviderCapability({
  providerId: "provider-xl",
  providerKey: "xunlei",
  providerName: "Xunlei",
  requiresCredentials: false,
  credentialCount: 0,
  availableCredentialCount: 0,
  supportsDownloadValidation: false,
  supportsDirectDownloadUrl: true,
  notes: ["仅支持不携带凭据的受控 URL 检查。"],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Subtitle API Validator 下载验证", () => {
  it("使用新版契约执行 OpenSubtitles 浏览器下载验证，并在结果行和最近验证同步回显", async () => {
    const user = userEvent.setup();
    let resolvePendingResult!: (
      value: ReturnType<typeof createDownloadValidationResult>,
    ) => void;
    const pendingResult = new Promise<
      ReturnType<typeof createDownloadValidationResult>
    >((resolve) => {
      resolvePendingResult = resolve;
    });
    vi.mocked(api.fetchSubtitleValidatorProviders).mockResolvedValue({
      items: [openSubtitlesProvider, xunleiProvider],
      total: 2,
    });
    vi.mocked(api.runSubtitleValidatorSearch).mockResolvedValue(
      createSearchResultData({
        results: [
          {
            id: "opensubtitles:provider-os:item-1",
            provider: "opensubtitles",
            language: "zh-CN",
            releaseName: "Result One",
            format: "srt",
            subtitleRef: "opensubtitles:provider-os:item-1",
            providerDownloadUrl: null,
            raw: {},
            score: 92,
          },
        ],
      }),
    );
    vi.mocked(api.validateSubtitleValidatorDownload).mockReturnValue(
      pendingResult,
    );

    renderWithTheme(<SubtitleApiValidatorClient />);

    await screen.findByRole("button", { name: /OpenSubtitles/ });
    await user.type(screen.getByLabelText("关键词 / 标题"), "Matrix");
    await user.click(screen.getByRole("button", { name: "搜索验证" }));
    await screen.findByText("Result One");

    const browserDownload = screen.getByRole("button", {
      name: "验证 Result One 浏览器下载",
    });
    await user.click(browserDownload);

    await waitFor(() =>
      expect(
        vi.mocked(api.validateSubtitleValidatorDownload),
      ).toHaveBeenCalledWith({
        providerId: "provider-os",
        resultId: "opensubtitles:provider-os:item-1",
        mode: "browser_download",
      }),
    );
    expect(browserDownload).toBeDisabled();

    resolvePendingResult(
      createDownloadValidationResult({
        resultId: "opensubtitles:provider-os:item-1",
        subtitleRef: "opensubtitles:provider-os:item-1",
        fileName: "matrix.srt",
      }),
    );

    expect(await screen.findByText("最近一次下载验证")).toBeInTheDocument();
    expect(screen.getAllByText(/浏览器下载验证 ·/)).not.toHaveLength(0);
    expect(
      screen.getByText(/最近验证：浏览器下载验证 · 成功/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /选择 Xunlei/ }));
    await waitFor(() =>
      expect(screen.queryByText("最近一次下载验证")).not.toBeInTheDocument(),
    );
  });

  it("通过 admin API 进行 Xunlei URL 检查，禁用浏览器下载且不渲染上游 URL", async () => {
    const user = userEvent.setup();
    const providerUrl = "https://downloads.example.com/subtitle.srt";
    vi.mocked(api.fetchSubtitleValidatorProviders).mockResolvedValue({
      items: [xunleiProvider],
      total: 1,
    });
    vi.mocked(api.runSubtitleValidatorSearch).mockResolvedValue(
      createSearchResultData({
        results: [
          {
            id: "xunlei:provider-xl:item-2",
            provider: "xunlei",
            language: "zh-CN",
            releaseName: "Xunlei Result",
            format: "srt",
            subtitleRef: "xunlei:provider-xl:item-2",
            providerDownloadUrl: providerUrl,
            raw: {},
            score: 75,
          },
        ],
      }),
    );
    vi.mocked(api.validateSubtitleValidatorDownload).mockResolvedValue(
      createDownloadValidationResult({
        provider: "xunlei",
        resultId: "xunlei:provider-xl:item-2",
        subtitleRef: "xunlei:provider-xl:item-2",
        status: "failed",
        httpStatus: 502,
        message: "下载 URL 不可访问。",
        fileName: null,
        contentType: null,
        contentLength: null,
        downloadMode: "url_check",
        diagnostic: {
          action: "download_validation",
          provider: "xunlei",
          providerName: "Xunlei",
          providerStatus: "enabled",
          status: "error",
          resultCount: 0,
          elapsedMs: 20,
          summary: "Xunlei URL check failed",
          errorCategory: "download_failed",
          nextActionHint: "检查下载地址或稍后重试。",
          fileName: null,
          downloadMode: "url_check",
        },
      }),
    );
    const openSpy = vi.spyOn(window, "open");

    renderWithTheme(<SubtitleApiValidatorClient />);

    await screen.findByRole("button", { name: /Xunlei/ });
    await user.type(screen.getByLabelText("关键词 / 标题"), "Matrix");
    await user.click(screen.getByRole("button", { name: "搜索验证" }));
    await screen.findByText("Xunlei Result");

    expect(
      screen.getByRole("button", {
        name: "验证 Xunlei Result 浏览器下载",
      }),
    ).toBeDisabled();
    expect(
      screen.getByText("Xunlei 不支持浏览器下载验证，请使用 URL 检查。"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "检查 Xunlei Result 下载 URL" }),
    );

    await waitFor(() =>
      expect(
        vi.mocked(api.validateSubtitleValidatorDownload),
      ).toHaveBeenCalledWith({
        providerId: "provider-xl",
        resultId: "xunlei:provider-xl:item-2",
        mode: "url_check",
        downloadReference: providerUrl,
      }),
    );
    expect(openSpy).not.toHaveBeenCalled();
    expect(screen.queryByText(providerUrl)).not.toBeInTheDocument();
    expect(
      await screen.findAllByText("错误类别：download_failed"),
    ).not.toHaveLength(0);
    expect(
      screen.getAllByText("下一步建议：检查下载地址或稍后重试。"),
    ).not.toHaveLength(0);
  });
});
