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
import { AppError } from "@/lib/errors";
import { renderWithTheme } from "../helpers/ui";

const navigation = vi.hoisted(
  (): { pathname: string | null; searchParams: URLSearchParams | null } => ({
    pathname: "/admin/subtitle-api-validator",
    searchParams: new URLSearchParams(),
  }),
);

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
}));

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
  availabilityLabel: "已降级",
  restrictionNote:
    "当前 Provider 已降级；验证结果仅用于排障，不代表正式服务健康。",
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
  navigation.pathname = "/admin/subtitle-api-validator";
  navigation.searchParams = new URLSearchParams();
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

  it("认证失效时提供保留当前查询参数的重新登录入口", async () => {
    navigation.searchParams = new URLSearchParams(
      "provider=opensubtitles&status=degraded",
    );
    vi.mocked(api.fetchSubtitleValidatorProviders).mockRejectedValue(
      new AppError(
        "AUTHENTICATION_REQUIRED",
        "管理员会话已失效。",
        "admin_session",
      ),
    );

    renderWithTheme(<SubtitleApiValidatorClient />);

    expect(await screen.findByText("管理员会话已失效")).toBeInTheDocument();
    const login = screen.getByRole("link", { name: "重新登录" });
    expect(login).toHaveAttribute(
      "href",
      "/login?next=%2Fadmin%2Fsubtitle-api-validator%3Fprovider%3Dopensubtitles%26status%3Ddegraded&auth=session-expired",
    );
    expect(screen.queryByText("重试读取")).not.toBeInTheDocument();
  });

  it("路由上下文不可用时仍提供 Validator 返回路径的重新登录入口", async () => {
    navigation.pathname = null;
    navigation.searchParams = null;
    vi.mocked(api.fetchSubtitleValidatorProviders).mockRejectedValue(
      new AppError(
        "AUTHENTICATION_REQUIRED",
        "管理员会话已失效。",
        "admin_session",
      ),
    );

    renderWithTheme(<SubtitleApiValidatorClient />);

    expect(await screen.findByText("管理员会话已失效")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "重新登录" })).toHaveAttribute(
      "href",
      "/login?next=%2Fadmin%2Fsubtitle-api-validator&auth=session-expired",
    );
  });

  it("加载、读取失败和空列表时不渲染窄屏 Provider Drawer 入口", async () => {
    vi.mocked(api.fetchSubtitleValidatorProviders).mockReturnValue(
      new Promise(() => {}),
    );
    const { unmount } = renderWithTheme(<SubtitleApiValidatorClient />);

    expect(
      await screen.findAllByText(/正在加载 provider capabilities/),
    ).not.toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: "选择 Provider" }),
    ).not.toBeInTheDocument();
    unmount();

    vi.mocked(api.fetchSubtitleValidatorProviders).mockRejectedValue(
      new Error("Provider service unavailable"),
    );
    const errorView = renderWithTheme(<SubtitleApiValidatorClient />);
    expect(await screen.findAllByText("读取失败")).not.toHaveLength(0);
    expect(
      screen.getAllByRole("button", { name: "重试读取" }),
    ).not.toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: "选择 Provider" }),
    ).not.toBeInTheDocument();
    errorView.unmount();

    vi.mocked(api.fetchSubtitleValidatorProviders).mockResolvedValue({
      items: [],
      total: 0,
    });
    renderWithTheme(<SubtitleApiValidatorClient />);
    expect(
      await screen.findAllByText(/当前没有可用 provider/),
    ).not.toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: "选择 Provider" }),
    ).not.toBeInTheDocument();
  });

  it("切换 provider 后重置结果上下文，并切换扩展参数说明", async () => {
    const user = userEvent.setup();
    renderWithTheme(<SubtitleApiValidatorClient />);

    await screen.findByRole("button", { name: /OpenSubtitles Degraded/ });
    await user.type(screen.getByLabelText("关键词 / 标题"), "The Matrix");
    await user.click(screen.getByRole("button", { name: "搜索验证" }));

    await waitFor(() =>
      expect(vi.mocked(api.runSubtitleValidatorSearch)).toHaveBeenCalledWith({
        providerId: "provider-degraded",
        baseParams: { keyword: "The Matrix" },
        providerParams: {},
      }),
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
