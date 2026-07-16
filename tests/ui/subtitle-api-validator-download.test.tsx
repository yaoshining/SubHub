import * as React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SubtitleApiValidatorClient } from "@/app/(admin)/subtitle-api-validator/subtitle-api-validator-client";
import { AppError } from "@/lib/errors";
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

const provider = createProviderCapability({
  providerId: "provider-os",
  providerKey: "opensubtitles",
  providerName: "OpenSubtitles",
  credentialCount: 2,
  availableCredentialCount: 2,
  notes: ["依赖有效凭据池。"],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchSubtitleValidatorProviders).mockResolvedValue({
    items: [provider],
    total: 1,
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
        {
          id: "xunlei:provider-xl:item-2",
          provider: "xunlei",
          language: "zh-CN",
          releaseName: "Result Two",
          format: "srt",
          subtitleRef: "xunlei:provider-xl:item-2",
          providerDownloadUrl: "https://example.com/subtitle.srt",
          raw: {},
          score: 75,
        },
      ],
      diagnostic: createSearchResultData({
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
          {
            id: "xunlei:provider-xl:item-2",
            provider: "xunlei",
            language: "zh-CN",
            releaseName: "Result Two",
            format: "srt",
            subtitleRef: "xunlei:provider-xl:item-2",
            providerDownloadUrl: "https://example.com/subtitle.srt",
            raw: {},
            score: 75,
          },
        ],
      }).diagnostic,
    }),
  );
});

describe("Subtitle API Validator 下载验证", () => {
  it("支持 OpenSubtitles 浏览器下载校验并显示成功反馈", async () => {
    const user = userEvent.setup();
    vi.mocked(api.validateSubtitleValidatorDownload).mockResolvedValue(
      createDownloadValidationResult({
        subtitleRef: "opensubtitles:provider-os:item-1",
        contentLength: 512,
      }),
    );

    renderWithTheme(<SubtitleApiValidatorClient />);

    await screen.findByRole("button", { name: /OpenSubtitles/ });
    await user.type(screen.getByLabelText("关键词 / 标题"), "Matrix");
    await user.click(screen.getByRole("button", { name: "搜索验证" }));
    await screen.findByText("Result One");

    await user.click(
      screen.getByRole("button", { name: "验证 Result One 浏览器下载" }),
    );

    await waitFor(() =>
      expect(
        vi.mocked(api.validateSubtitleValidatorDownload),
      ).toHaveBeenCalledWith({
        subtitleRef: "opensubtitles:provider-os:item-1",
      }),
    );

    expect(screen.getAllByText(/已验证 sample\.srt/)).toHaveLength(2);
  });

  it("下载失败时展示错误反馈，且 Xunlei 浏览器下载按钮保持禁用", async () => {
    const user = userEvent.setup();
    vi.mocked(api.validateSubtitleValidatorDownload).mockRejectedValue(
      new AppError(
        "VALIDATION_FAILED",
        "Xunlei 当前只支持 URL 检查。",
        "subtitleRef",
      ),
    );

    renderWithTheme(<SubtitleApiValidatorClient />);

    await screen.findByRole("button", { name: /OpenSubtitles/ });
    await user.type(screen.getByLabelText("关键词 / 标题"), "Matrix");
    await user.click(screen.getByRole("button", { name: "搜索验证" }));
    await screen.findByText("Result Two");

    expect(
      screen.getByRole("button", { name: "验证 Result Two 浏览器下载" }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: "验证 Result One 浏览器下载" }),
    );

    expect(await screen.findByText("最近一次下载验证")).toBeInTheDocument();
    expect(screen.getAllByText("Xunlei 当前只支持 URL 检查。")).toHaveLength(2);
  });
});
