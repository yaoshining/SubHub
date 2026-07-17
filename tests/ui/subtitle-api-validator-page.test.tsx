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

const degradedProvider = createProviderCapability({
  providerId: "provider-degraded",
  providerKey: "opensubtitles",
  providerName: "OpenSubtitles Degraded",
  status: "degraded",
  healthStatus: "degraded",
  credentialCount: 2,
  availableCredentialCount: 1,
  supportsDownloadValidation: true,
  notes: ["可执行搜索与统一下载校验。"],
  lastHealthCheckAt: "2026-07-14T12:00:00.000Z",
  lastHealthErrorSummary: "最近一次超时",
});

const xunleiProvider = createProviderCapability({
  providerId: "provider-xunlei",
  providerKey: "xunlei",
  providerName: "Xunlei",
  requiresCredentials: false,
  credentialCount: 0,
  availableCredentialCount: 1,
  supportsDownloadValidation: false,
  supportsDirectDownloadUrl: true,
  extendedFields: [],
  extendedFieldNotice:
    "当前 Provider 没有额外的结构化扩展参数；推荐先用关键词验证基础搜索链路。",
  notes: ["支持搜索结果验证，但统一下载校验会返回不支持。"],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchSubtitleValidatorProviders).mockResolvedValue({
    items: [degradedProvider, xunleiProvider],
    total: 2,
  });
  vi.mocked(api.runSubtitleValidatorSearch).mockResolvedValue(
    createSearchResultData({}),
  );
  vi.mocked(api.validateSubtitleValidatorDownload).mockResolvedValue(
    createDownloadValidationResult({
      subtitleRef: "opensubtitles:provider-degraded:item-1",
    }),
  );
});

describe("Subtitle API Validator 页面", () => {
  it("默认选中 degraded provider，并展示 rail + overview + diagnostic snapshot", async () => {
    renderWithTheme(<SubtitleApiValidatorClient />);

    await screen.findByText("Subtitle API Validator");
    await waitFor(() =>
      expect(
        vi.mocked(api.fetchSubtitleValidatorProviders),
      ).toHaveBeenCalledTimes(1),
    );

    const selected = screen.getByRole("option", { selected: true });
    expect(selected).toHaveTextContent("OpenSubtitles Degraded");
    expect(screen.getByText("Provider Overview")).toBeInTheDocument();
    expect(screen.getByText("此 Provider 已降级")).toBeInTheDocument();
    expect(screen.getByText("Diagnostic Snapshot")).toBeInTheDocument();
    expect(screen.getByText(/最近错误摘要: 最近一次超时/)).toBeInTheDocument();
  });

  it("切换 provider 后重置结果上下文，并切换扩展参数说明", async () => {
    const user = userEvent.setup();
    renderWithTheme(<SubtitleApiValidatorClient />);

    await screen.findByRole("button", { name: /OpenSubtitles Degraded/ });
    await user.type(screen.getByLabelText("关键词 / 标题"), "The Matrix");
    await user.click(screen.getByRole("button", { name: "搜索验证" }));

    await waitFor(() =>
      expect(vi.mocked(api.runSubtitleValidatorSearch)).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "opensubtitles",
          title: "The Matrix",
        }),
      ),
    );

    expect(
      screen.getByText(
        "当前没有结果。若请求已成功返回，这表示空结果而不是失败；可调整参数后继续验证。",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /选择 Xunlei/ }));

    await waitFor(() =>
      expect(screen.getByLabelText("关键词 / 标题")).toHaveValue("The Matrix"),
    );
    expect(screen.queryByLabelText("Season")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Episode")).not.toBeInTheDocument();
    expect(
      screen.getAllByText(
        "当前 Provider 没有额外的结构化扩展参数；推荐先用关键词验证基础搜索链路。",
      ),
    ).toHaveLength(2);
  });
});
