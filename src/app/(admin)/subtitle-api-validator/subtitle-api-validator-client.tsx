"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  LogIn,
  RefreshCw,
  Shield,
} from "lucide-react";

import {
  type SubtitleValidatorDiagnosticSummary as SubtitleValidatorDiagnosticSummaryData,
  type SubtitleValidatorDownloadMode,
  type SubtitleValidatorProviderCapability,
  type SubtitleValidatorSearchRequest,
  type SubtitleValidatorSearchResult,
  type SubtitleValidatorSearchResultData,
  fetchSubtitleValidatorProviders,
  runSubtitleValidatorSearch,
  validateSubtitleValidatorDownload,
} from "@/lib/api/subtitle-validator";
import { AppError } from "@/lib/errors";
import { SubtitleValidatorDiagnosticSummary } from "@/components/providers/subtitle-validator-diagnostic-summary";
import {
  SubtitleValidatorDownloadStatus,
  type SubtitleValidatorRecentDownloadValidation,
} from "@/components/providers/subtitle-validator-download-status";
import { SubtitleValidatorProviderOverview } from "@/components/providers/subtitle-validator-provider-overview";
import { SubtitleValidatorProviderRail } from "@/components/providers/subtitle-validator-provider-rail";
import { SubtitleValidatorResultsConsole } from "@/components/providers/subtitle-validator-results-console";
import { SubtitleValidatorSearchComposer } from "@/components/providers/subtitle-validator-search-composer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const initialFormState: SubtitleValidatorSearchRequest = {
  providerId: "",
  baseParams: { keyword: "" },
  providerParams: {},
};

function getErrorMessage(error: unknown) {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Validator 请求失败，请稍后重试。";
}

function getErrorDiagnostic(
  error: unknown,
): SubtitleValidatorDiagnosticSummaryData | null {
  if (!(error instanceof AppError)) return null;
  const diagnostic = error.details?.diagnostic;
  return diagnostic &&
    typeof diagnostic === "object" &&
    !Array.isArray(diagnostic)
    ? (diagnostic as SubtitleValidatorDiagnosticSummaryData)
    : null;
}

function getDefaultProviderId(
  providers: SubtitleValidatorProviderCapability[],
) {
  return (
    providers.find((item) => item.status === "degraded")?.providerId ??
    providers.find((item) => item.status === "needs_config")?.providerId ??
    providers[0]?.providerId ??
    null
  );
}

export function SubtitleApiValidatorClient() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [providers, setProviders] = React.useState<
    SubtitleValidatorProviderCapability[]
  >([]);
  const [selectedProviderId, setSelectedProviderId] = React.useState<
    string | null
  >(null);
  const [loadingProviders, setLoadingProviders] = React.useState(true);
  const [providerError, setProviderError] = React.useState<string | null>(null);
  const [permissionError, setPermissionError] = React.useState<string | null>(
    null,
  );
  const [authenticationError, setAuthenticationError] = React.useState<
    string | null
  >(null);
  const [form, setForm] = React.useState(initialFormState);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [searchResult, setSearchResult] =
    React.useState<SubtitleValidatorSearchResultData | null>(null);
  const [searchDiagnostic, setSearchDiagnostic] =
    React.useState<SubtitleValidatorDiagnosticSummaryData | null>(null);
  const [recentDownloadValidation, setRecentDownloadValidation] =
    React.useState<SubtitleValidatorRecentDownloadValidation | null>(null);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const [downloadingIds, setDownloadingIds] = React.useState<string[]>([]);
  const selectedProviderIdRef = React.useRef<string | null>(null);
  const loginHref = React.useMemo(() => {
    const search = searchParams?.toString() ?? "";
    const loginParams = new URLSearchParams({
      next: `${pathname ?? "/admin/subtitle-api-validator"}${
        search ? `?${search}` : ""
      }`,
      auth: "session-expired",
    });

    return `/login?${loginParams.toString()}`;
  }, [pathname, searchParams]);

  const loadProviders = React.useCallback(async () => {
    setAuthenticationError(null);
    setPermissionError(null);
    try {
      const data = await fetchSubtitleValidatorProviders();
      setProviders(data.items);
      setSelectedProviderId((current) =>
        current && data.items.some((item) => item.providerId === current)
          ? current
          : getDefaultProviderId(data.items),
      );
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code === "AUTHENTICATION_REQUIRED"
      ) {
        setAuthenticationError(error.message);
      } else if (error instanceof AppError && error.code === "FORBIDDEN") {
        setPermissionError(error.message);
      } else {
        setProviderError(getErrorMessage(error));
      }
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const data = await fetchSubtitleValidatorProviders();
        if (!mounted) return;
        setProviders(data.items);
        setSelectedProviderId((current) =>
          current && data.items.some((item) => item.providerId === current)
            ? current
            : getDefaultProviderId(data.items),
        );
      } catch (error) {
        if (!mounted) return;
        if (
          error instanceof AppError &&
          error.code === "AUTHENTICATION_REQUIRED"
        ) {
          setAuthenticationError(error.message);
        } else if (error instanceof AppError && error.code === "FORBIDDEN") {
          setPermissionError(error.message);
        } else {
          setProviderError(getErrorMessage(error));
        }
      } finally {
        if (mounted) {
          setLoadingProviders(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedProvider = React.useMemo(
    () =>
      providers.find(
        (provider) => provider.providerId === selectedProviderId,
      ) ?? null,
    [providers, selectedProviderId],
  );

  React.useEffect(() => {
    selectedProviderIdRef.current = selectedProviderId;
  }, [selectedProviderId]);

  const handleSelectProvider = React.useCallback(
    (providerId: string) => {
      const nextProvider =
        providers.find((provider) => provider.providerId === providerId) ??
        null;
      setSelectedProviderId(providerId);
      setForm((current) => ({
        providerId: nextProvider?.providerId ?? "",
        baseParams: current.baseParams,
        providerParams: {},
      }));
      setSearchResult(null);
      setSearchDiagnostic(null);
      setSearchError(null);
      setRecentDownloadValidation(null);
      setDownloadError(null);
      setDownloadingIds([]);
    },
    [providers],
  );

  const handleAuthenticationRequired = React.useCallback((error: AppError) => {
    setAuthenticationError(error.message);
    setSearchError(null);
    setSearchDiagnostic(null);
    setDownloadError(null);
  }, []);

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProvider) {
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSearchDiagnostic(null);
    setDownloadError(null);
    try {
      const result = await runSubtitleValidatorSearch({
        ...form,
        providerId: selectedProvider.providerId,
      });
      setSearchResult(result);
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code === "AUTHENTICATION_REQUIRED"
      ) {
        handleAuthenticationRequired(error);
      } else {
        setSearchError(getErrorMessage(error));
        setSearchDiagnostic(getErrorDiagnostic(error));
      }
      setSearchResult(null);
    } finally {
      setSearching(false);
    }
  };

  const handleDownloadValidation = async (
    resultItem: SubtitleValidatorSearchResult,
    mode: SubtitleValidatorDownloadMode,
  ) => {
    if (!selectedProvider) {
      return;
    }

    setDownloadingIds((current) =>
      current.includes(resultItem.id) ? current : [...current, resultItem.id],
    );
    setDownloadError(null);
    try {
      const result = await validateSubtitleValidatorDownload({
        providerId: selectedProvider.providerId,
        resultId: resultItem.id,
        mode,
        ...(mode === "url_check" && resultItem.providerDownloadUrl
          ? { downloadReference: resultItem.providerDownloadUrl }
          : {}),
      });
      if (selectedProviderIdRef.current !== selectedProvider.providerId) {
        return;
      }
      setRecentDownloadValidation({
        status: result.status,
        message: result.message,
        downloadMode: result.downloadMode,
        httpStatus: result.httpStatus,
        fileName: result.fileName,
        diagnostic: result.diagnostic,
        resultId: result.resultId,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code === "AUTHENTICATION_REQUIRED"
      ) {
        handleAuthenticationRequired(error);
      } else if (
        selectedProviderIdRef.current === selectedProvider.providerId
      ) {
        setDownloadError(getErrorMessage(error));
      }
    } finally {
      setDownloadingIds((current) =>
        current.filter((itemId) => itemId !== resultItem.id),
      );
    }
  };

  if (authenticationError) {
    return (
      <Card className="border-border bg-surface shadow-none">
        <CardContent className="space-y-4 px-6 py-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>管理员会话已失效</AlertTitle>
            <AlertDescription>
              {authenticationError} 请重新登录后继续使用验证工具。
            </AlertDescription>
          </Alert>
          <Button asChild>
            <Link href={loginHref}>
              <LogIn />
              重新登录
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (permissionError) {
    return (
      <Card className="border-border bg-surface shadow-none">
        <CardContent className="space-y-4 px-6 py-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>无权限访问</AlertTitle>
            <AlertDescription>{permissionError}</AlertDescription>
          </Alert>
          <Button asChild variant="outline">
            <Link href="/providers">
              <ArrowLeft />
              返回 Provider 管理
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const diagnostic: SubtitleValidatorDiagnosticSummaryData | null =
    recentDownloadValidation?.diagnostic ??
    searchDiagnostic ??
    searchResult?.diagnostic ??
    null;
  const effectiveDiagnosticStatus =
    searchError || downloadError
      ? "error"
      : (diagnostic?.status ??
        (searchResult
          ? searchResult.results.length > 0
            ? "success"
            : "empty"
          : "idle"));

  return (
    <div className="grid gap-6" data-testid="subtitle-api-validator-page">
      <Card className="border-border bg-surface shadow-none">
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-elevated px-3 py-1 text-xs text-muted-foreground">
              <Shield className="size-3.5" />
              内部工具 · Admin Only
            </div>
            <CardTitle className="text-xl">Subtitle API Validator</CardTitle>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              用于快速判断 provider
              配置、搜索链路与下载链路是否可用。这里是内部诊断工作台，不替代正式字幕搜索或正式下载产品流。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <div className="grid gap-1 text-sm text-muted-foreground md:text-right">
              <span>Provider 摘要：{providers.length}</span>
              <span>
                支持浏览器下载校验：
                {
                  providers.filter((item) => item.supportsDownloadValidation)
                    .length
                }
              </span>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/providers">
                <ArrowLeft />
                返回 Providers
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:hidden">
        {loadingProviders ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            正在加载 provider capabilities...
          </div>
        ) : null}
        {providerError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>读取失败</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{providerError}</p>
              <Button
                onClick={() => {
                  setLoadingProviders(true);
                  setProviderError(null);
                  void loadProviders();
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCw />
                重试读取
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {!loadingProviders && !providerError && providers.length === 0 ? (
          <div className="space-y-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <p>当前没有可用 provider；请先到服务商页完成基础配置。</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/providers">前往 Provider 管理</Link>
            </Button>
          </div>
        ) : null}
        {!loadingProviders && !providerError && providers.length > 0 ? (
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                className="w-full justify-between"
                type="button"
                variant="outline"
              >
                <span>{selectedProvider?.providerName ?? "选择 Provider"}</span>
                <Badge variant="secondary">{providers.length}</Badge>
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>选择 Provider</DrawerTitle>
                <DrawerDescription>
                  Tablet / mobile 下 Provider Rail
                  收敛为顶部抽屉，右侧工作区语义保持不变。
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-6">
                <SubtitleValidatorProviderRail
                  onSelectProvider={handleSelectProvider}
                  providers={providers}
                  selectedProviderId={selectedProviderId}
                />
              </div>
            </DrawerContent>
          </Drawer>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden min-w-0 xl:block">
          <Card className="min-w-0 border-border bg-surface shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Provider Rail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingProviders ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  正在加载 provider capabilities...
                </div>
              ) : null}
              {providerError ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>读取失败</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>{providerError}</p>
                    <Button
                      onClick={() => {
                        setLoadingProviders(true);
                        setProviderError(null);
                        void loadProviders();
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <RefreshCw />
                      重试读取
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}
              {!loadingProviders && !providerError && providers.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  当前没有可用 provider；请先到服务商页完成基础配置。
                </div>
              ) : null}
              {!loadingProviders && !providerError && providers.length > 0 ? (
                <SubtitleValidatorProviderRail
                  onSelectProvider={handleSelectProvider}
                  providers={providers}
                  selectedProviderId={selectedProviderId}
                />
              ) : null}
            </CardContent>
          </Card>
        </aside>

        <section className="grid gap-6">
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
            <SubtitleValidatorProviderOverview provider={selectedProvider} />
            <SubtitleValidatorDiagnosticSummary
              lastMessage={
                downloadError ??
                recentDownloadValidation?.message ??
                searchError ??
                diagnostic?.summary ??
                null
              }
              diagnostic={diagnostic}
              actionAt={
                recentDownloadValidation
                  ? new Intl.DateTimeFormat("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    }).format(new Date(recentDownloadValidation.completedAt))
                  : null
              }
              resultCount={searchResult?.results.length ?? 0}
              searching={searching}
              selectedProviderName={selectedProvider?.providerName ?? null}
              status={effectiveDiagnosticStatus}
            />
          </div>

          {providerError && !loadingProviders && providers.length === 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Provider 列表不可用</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{providerError}</p>
                <Button
                  onClick={() => {
                    setLoadingProviders(true);
                    setProviderError(null);
                    void loadProviders();
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw />
                  重试读取
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {!providerError && !loadingProviders && providers.length === 0 ? (
            <Card className="border-border bg-surface shadow-none">
              <CardContent className="px-6 py-8 text-sm text-muted-foreground">
                当前没有可验证对象。请先回到 Provider
                管理页完成基础配置，再回到此页发起搜索或下载验证。
              </CardContent>
            </Card>
          ) : null}

          {providers.length > 0 ? (
            <>
              <SubtitleValidatorSearchComposer
                form={form}
                onChange={setForm}
                onReset={() =>
                  setForm({
                    providerId: selectedProvider?.providerId ?? "",
                    baseParams: { keyword: "" },
                    providerParams: {},
                  })
                }
                onSubmit={handleSearch}
                provider={selectedProvider}
                searching={searching}
              />

              {searchError ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>搜索校验失败</AlertTitle>
                  <AlertDescription>{searchError}</AlertDescription>
                </Alert>
              ) : null}

              <SubtitleValidatorDownloadStatus
                validation={recentDownloadValidation}
              />

              {downloadError ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>下载验证请求失败</AlertTitle>
                  <AlertDescription>
                    {downloadError} 请检查当前 provider 状态或稍后重试。
                  </AlertDescription>
                </Alert>
              ) : null}

              <SubtitleValidatorResultsConsole
                downloadingIds={downloadingIds}
                failures={searchResult?.providerFailures ?? []}
                nextActionHint={searchResult?.diagnostic?.nextActionHint}
                onValidateDownload={handleDownloadValidation}
                recentValidation={recentDownloadValidation}
                results={searchResult?.results ?? []}
                searching={searching}
              />
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
