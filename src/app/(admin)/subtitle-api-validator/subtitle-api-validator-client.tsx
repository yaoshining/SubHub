"use client";

import Link from "next/link";
import * as React from "react";
import { AlertTriangle, ArrowLeft, RefreshCw, Shield } from "lucide-react";

import {
  type SubtitleValidatorProviderCapability,
  type SubtitleValidatorSearchRequest,
  type SubtitleValidatorSearchResultData,
  fetchSubtitleValidatorProviders,
  runSubtitleValidatorSearch,
  validateSubtitleValidatorDownload,
} from "@/lib/api/subtitle-validator";
import { AppError } from "@/lib/errors";
import { SubtitleValidatorDiagnosticSummary } from "@/components/providers/subtitle-validator-diagnostic-summary";
import { SubtitleValidatorDownloadStatus } from "@/components/providers/subtitle-validator-download-status";
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
  title: "",
  provider: undefined,
  query: undefined,
  language: undefined,
  type: undefined,
  year: undefined,
  season: undefined,
  episode: undefined,
  imdbId: undefined,
  tmdbId: undefined,
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
  const [form, setForm] = React.useState(initialFormState);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [searchResult, setSearchResult] =
    React.useState<SubtitleValidatorSearchResultData | null>(null);
  const [downloadMessage, setDownloadMessage] = React.useState<string | null>(
    null,
  );
  const [downloadTone, setDownloadTone] = React.useState<"success" | "error">(
    "success",
  );
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const loadProviders = React.useCallback(async () => {
    try {
      const data = await fetchSubtitleValidatorProviders();
      setProviders(data.items);
      setSelectedProviderId((current) =>
        current && data.items.some((item) => item.providerId === current)
          ? current
          : getDefaultProviderId(data.items),
      );
    } catch (error) {
      if (error instanceof AppError && error.code === "FORBIDDEN") {
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
        if (error instanceof AppError && error.code === "FORBIDDEN") {
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

  const handleSelectProvider = React.useCallback(
    (providerId: string) => {
      const nextProvider =
        providers.find((provider) => provider.providerId === providerId) ??
        null;
      setSelectedProviderId(providerId);
      setForm((current) => ({
        ...initialFormState,
        title: current.title,
        query: current.query,
        language: current.language,
        type: current.type,
        provider: nextProvider?.providerKey,
      }));
      setSearchResult(null);
      setSearchError(null);
      setDownloadMessage(null);
    },
    [providers],
  );

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProvider) {
      return;
    }

    setSearching(true);
    setSearchError(null);
    setDownloadMessage(null);
    try {
      const result = await runSubtitleValidatorSearch({
        ...form,
        provider: selectedProvider.providerKey,
      });
      setSearchResult(result);
    } catch (error) {
      setSearchError(getErrorMessage(error));
      setSearchResult(null);
    } finally {
      setSearching(false);
    }
  };

  const handleDownloadValidation = async (subtitleRef: string) => {
    setDownloadingId(subtitleRef);
    setDownloadMessage(null);
    try {
      const result = await validateSubtitleValidatorDownload({ subtitleRef });
      setSearchResult((current) =>
        current
          ? {
              ...current,
              diagnostic: result.diagnostic,
            }
          : current,
      );
      setDownloadTone("success");
      setDownloadMessage(
        `已验证 ${result.fileName}（${result.contentType}，${result.contentLength} bytes）`,
      );
    } catch (error) {
      setDownloadTone("error");
      setDownloadMessage(getErrorMessage(error));
    } finally {
      setDownloadingId(null);
    }
  };

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

  const diagnostic = searchResult?.diagnostic ?? null;
  const effectiveDiagnosticStatus = searchError
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
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <Card className="border-border bg-surface shadow-none">
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
              errorCategory={diagnostic?.errorCategory}
              lastMessage={
                searchError ?? downloadMessage ?? diagnostic?.summary ?? null
              }
              nextActionHint={diagnostic?.nextActionHint}
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
                    ...initialFormState,
                    provider: selectedProvider?.providerKey,
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
                message={downloadMessage}
                tone={downloadTone}
              />

              <SubtitleValidatorResultsConsole
                downloadingId={downloadingId}
                failures={searchResult?.providerFailures ?? []}
                nextActionHint={diagnostic?.nextActionHint}
                onValidateDownload={handleDownloadValidation}
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
