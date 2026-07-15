"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Loader2, Shield } from "lucide-react";

import {
  type SubtitleValidatorProviderCapability,
  type SubtitleValidatorSearchRequest,
  type SubtitleValidatorSearchResultData,
  fetchSubtitleValidatorProviders,
  runSubtitleValidatorSearch,
  validateSubtitleValidatorDownload,
} from "@/lib/api/subtitle-validator";
import { AppError } from "@/lib/errors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialFormState: SubtitleValidatorSearchRequest = {
  title: "",
  provider: undefined,
  query: undefined,
  language: undefined,
  type: undefined,
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

export function SubtitleApiValidatorClient() {
  const [providers, setProviders] = React.useState<
    SubtitleValidatorProviderCapability[]
  >([]);
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
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const data = await fetchSubtitleValidatorProviders();
        if (!mounted) return;
        setProviders(data.items);
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

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearching(true);
    setSearchError(null);
    setDownloadMessage(null);
    try {
      const result = await runSubtitleValidatorSearch(form);
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
      setDownloadMessage(
        `已验证 ${result.fileName}（${result.contentType}，${result.contentLength} bytes）`,
      );
    } catch (error) {
      setDownloadMessage(getErrorMessage(error));
    } finally {
      setDownloadingId(null);
    }
  };

  if (permissionError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>无权限访问</AlertTitle>
        <AlertDescription>{permissionError}</AlertDescription>
      </Alert>
    );
  }

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
              用于快速检查 provider
              能力摘要、搜索请求形态与统一下载校验链路；本期只交付基础骨架与契约验证，不替代正式字幕业务流程。
            </p>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground md:text-right">
            <span>Provider 摘要：{providers.length}</span>
            <span>
              可下载校验：
              {
                providers.filter((item) => item.supportsDownloadValidation)
                  .length
              }
            </span>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <Card className="border-border bg-surface shadow-none">
          <CardHeader>
            <CardTitle className="text-base">请求验证</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSearch}>
              <div className="grid gap-2 md:col-span-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="validator-title"
                >
                  标题
                </label>
                <Input
                  id="validator-title"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="例如：The Matrix"
                  required
                  value={form.title}
                />
              </div>
              <div className="grid gap-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="validator-query"
                >
                  附加查询
                </label>
                <Input
                  id="validator-query"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      query: event.target.value || undefined,
                    }))
                  }
                  placeholder="可选关键字"
                  value={form.query ?? ""}
                />
              </div>
              <div className="grid gap-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="validator-provider"
                >
                  Provider
                </label>
                <Select
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      provider:
                        value === "all"
                          ? undefined
                          : (value as SubtitleValidatorSearchRequest["provider"]),
                    }))
                  }
                  value={form.provider ?? "all"}
                >
                  <SelectTrigger id="validator-provider">
                    <SelectValue placeholder="全部 provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部 provider</SelectItem>
                    <SelectItem value="opensubtitles">OpenSubtitles</SelectItem>
                    <SelectItem value="xunlei">Xunlei</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="validator-language"
                >
                  语言
                </label>
                <Input
                  id="validator-language"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      language: event.target.value || undefined,
                    }))
                  }
                  placeholder="如 zh-CN / en"
                  value={form.language ?? ""}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="validator-type">
                  类型
                </label>
                <Select
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      type:
                        value === "all"
                          ? undefined
                          : (value as SubtitleValidatorSearchRequest["type"]),
                    }))
                  }
                  value={form.type ?? "all"}
                >
                  <SelectTrigger id="validator-type">
                    <SelectValue placeholder="全部类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectItem value="movie">电影</SelectItem>
                    <SelectItem value="episode">剧集</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                <Button
                  aria-label="运行字幕搜索校验"
                  disabled={searching}
                  type="submit"
                >
                  {searching ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  运行 Search 校验
                </Button>
                <span className="text-xs text-muted-foreground">
                  结果用于校验契约与 provider 反馈，不代表正式前台用户路径。
                </span>
              </div>
            </form>

            {searchError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>搜索校验失败</AlertTitle>
                <AlertDescription>{searchError}</AlertDescription>
              </Alert>
            ) : null}

            {downloadMessage ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>下载校验结果</AlertTitle>
                <AlertDescription>{downloadMessage}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium">搜索结果</h3>
                {searchResult ? (
                  <Badge variant="secondary">{searchResult.status}</Badge>
                ) : null}
              </div>
              {searching ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  正在执行 validator search...
                </div>
              ) : null}
              {!searching && searchResult?.results.length ? (
                <div className="grid gap-3">
                  {searchResult.results.map((item) => (
                    <div
                      className="rounded-lg border bg-surface-elevated p-4"
                      key={item.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{item.provider}</Badge>
                            <span className="text-sm font-medium">
                              {item.releaseName ?? item.id}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.language ?? "unknown"} · {item.format} ·{" "}
                            {item.downloadUrl}
                          </p>
                        </div>
                        <Button
                          aria-label={`校验 ${item.releaseName ?? item.id} 下载链路`}
                          disabled={
                            downloadingId === item.id ||
                            item.provider !== "opensubtitles"
                          }
                          onClick={() => handleDownloadValidation(item.id)}
                          size="sm"
                          variant="outline"
                        >
                          {downloadingId === item.id ? (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                          ) : null}
                          校验下载
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {!searching &&
              searchResult &&
              searchResult.results.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  当前没有返回结果；可继续检查 providerFailures 与 provider
                  配置状态。
                </div>
              ) : null}
              {!searching && searchResult?.providerFailures.length ? (
                <div className="grid gap-3">
                  {searchResult.providerFailures.map((item) => (
                    <Alert
                      key={`${item.provider}-${item.reason}`}
                      variant="destructive"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>
                        {item.provider} · {item.reason}
                      </AlertTitle>
                      <AlertDescription>{item.message}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Provider 能力摘要</CardTitle>
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
                <AlertDescription>{providerError}</AlertDescription>
              </Alert>
            ) : null}
            {!loadingProviders && !providerError && providers.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                当前没有可用 provider；请先到服务商页完成基础配置。
              </div>
            ) : null}
            {providers.map((provider) => (
              <div
                className="rounded-lg border bg-surface-elevated p-4"
                key={provider.providerId}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{provider.providerKey}</Badge>
                      <span className="text-sm font-medium">
                        {provider.providerName}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {provider.status} · health {provider.healthStatus}
                    </p>
                  </div>
                  <Badge
                    variant={
                      provider.supportsDownloadValidation
                        ? "default"
                        : "secondary"
                    }
                  >
                    {provider.supportsDownloadValidation
                      ? "支持统一下载校验"
                      : "仅搜索校验"}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <span>
                    凭据：{provider.availableCredentialCount}/
                    {provider.credentialCount}
                    {provider.requiresCredentials
                      ? " 可用"
                      : "（该 provider 不要求凭据）"}
                  </span>
                  {provider.notes.map((note) => (
                    <span key={note}>{note}</span>
                  ))}
                  {provider.lastHealthErrorSummary ? (
                    <span>最近错误：{provider.lastHealthErrorSummary}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
