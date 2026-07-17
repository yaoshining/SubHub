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
  vi.mocked(api.validateSubtitleValidatorDownload).mockResolvedValue(
    createDownloadValidationResult({
      subtitleRef: "opensubtitles:provider-os:item-1",
    }),
  );
});

describe("Subtitle API Validator 搜索交互", () => {
  it("提交 provider-aware 搜索参数，并展示结果列表", async () => {
    const user = userEvent.setup();
    vi.mocked(api.runSubtitleValidatorSearch).mockResolvedValue(
      createSearchResultData({
        results: [
          {
            id: "opensubtitles:provider-os:item-1",
            provider: "opensubtitles",
            language: "zh-CN",
            releaseName: "The Matrix.zh-CN",
            format: "srt",
            subtitleRef: "opensubtitles:provider-os:item-1",
            providerDownloadUrl: null,
            raw: {},
            score: 98,
          },
        ],
        diagnostic: null,
      }),
    );

    renderWithTheme(<SubtitleApiValidatorClient />);

    await screen.findByRole("button", { name: /OpenSubtitles/ });
    await user.type(screen.getByLabelText("关键词 / 标题"), "The Matrix");
    await user.type(screen.getByLabelText("IMDb ID"), "tt0133093");
    await user.type(screen.getByLabelText("Season"), "1");
    await user.type(screen.getByLabelText("Episode"), "2");
    await user.click(screen.getByRole("button", { name: "搜索验证" }));

    await waitFor(() =>
      expect(vi.mocked(api.runSubtitleValidatorSearch)).toHaveBeenCalledWith({
        providerId: "provider-os",
        baseParams: { keyword: "The Matrix" },
        providerParams: {
          imdbId: "tt0133093",
          season: 1,
          episode: 2,
        },
      }),
    );

    expect(screen.getByText("The Matrix.zh-CN")).toBeInTheDocument();
    expect(screen.getByText("结果 1")).toBeInTheDocument();
  });

  it("搜索失败时保留输入并展示错误反馈", async () => {
    const user = userEvent.setup();
    vi.mocked(api.runSubtitleValidatorSearch).mockRejectedValue(
      new AppError("UPSTREAM_FAILED", "Provider 搜索超时。", "provider"),
    );

    renderWithTheme(<SubtitleApiValidatorClient />);

    await screen.findByRole("button", { name: /OpenSubtitles/ });
    await user.type(screen.getByLabelText("关键词 / 标题"), "Friends");
    await user.click(screen.getByRole("button", { name: "搜索验证" }));

    expect(await screen.findByText("搜索校验失败")).toBeInTheDocument();
    expect(screen.getAllByText("Provider 搜索超时。")).toHaveLength(2);
    expect(screen.getByLabelText("关键词 / 标题")).toHaveValue("Friends");
  });
});
