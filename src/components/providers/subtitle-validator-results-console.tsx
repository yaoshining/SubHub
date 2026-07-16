import { ExternalLink, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  SubtitleValidatorProviderFailure,
  SubtitleValidatorSearchResult,
} from "@/server/subtitles/admin-subtitle-validator-schema";

type SubtitleValidatorResultsConsoleProps = {
  results: SubtitleValidatorSearchResult[];
  failures: SubtitleValidatorProviderFailure[];
  searching: boolean;
  downloadingId: string | null;
  onValidateDownload: (subtitleRef: string) => void;
  nextActionHint?: string | null;
};

export function SubtitleValidatorResultsConsole({
  results,
  failures,
  searching,
  downloadingId,
  onValidateDownload,
  nextActionHint,
}: SubtitleValidatorResultsConsoleProps) {
  return (
    <Card className="border-border bg-surface shadow-none">
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Search Results Console</CardTitle>
          <p className="text-sm text-muted-foreground">
            结果保留 provider 来源与下载动作上下文，用于区分浏览器下载与 URL
            检查。
          </p>
        </div>
        <Badge variant="secondary">结果 {results.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        {searching ? (
          <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
            正在执行搜索验证，保留上一轮上下文并等待新结果返回...
          </div>
        ) : null}

        {!searching && results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
            当前没有结果。若请求已成功返回，这表示空结果而不是失败；可调整参数后继续验证。
            {nextActionHint ? (
              <p className="mt-2 text-xs text-foreground/80">
                下一步建议：{nextActionHint}
              </p>
            ) : null}
          </div>
        ) : null}

        {results.length > 0 ? (
          <div
            className="grid gap-3"
            data-testid="subtitle-validator-results-console"
          >
            {results.map((item) => {
              const supportsBrowserDownload = item.provider === "opensubtitles";
              const supportsUrlCheck = Boolean(item.providerDownloadUrl);
              return (
                <div
                  className="rounded-2xl border border-border/70 bg-surface-elevated px-4 py-4"
                  key={item.id}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{item.provider}</Badge>
                        <span className="text-sm font-medium text-foreground">
                          {item.releaseName ?? item.id}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.language ?? "unknown"} · {item.format} · ref{" "}
                        {item.subtitleRef}
                      </p>
                      {item.providerDownloadUrl ? (
                        <a
                          className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                          href={item.providerDownloadUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          查看 provider 下载 URL
                          <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          当前结果没有独立 provider
                          直链，需走服务端受控下载验证。
                        </p>
                      )}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        aria-label={`验证 ${item.releaseName ?? item.id} 浏览器下载`}
                        disabled={
                          !supportsBrowserDownload ||
                          downloadingId === item.subtitleRef
                        }
                        onClick={() => onValidateDownload(item.subtitleRef)}
                        size="sm"
                        type="button"
                      >
                        {downloadingId === item.subtitleRef ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : null}
                        浏览器下载
                      </Button>
                      <Button
                        aria-label={`检查 ${item.releaseName ?? item.id} 下载 URL`}
                        disabled={!supportsUrlCheck}
                        onClick={() => {
                          if (item.providerDownloadUrl) {
                            window.open(
                              item.providerDownloadUrl,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        验证下载 URL
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {failures.length > 0 ? (
          <div className="grid gap-3">
            {failures.map((item) => (
              <Alert
                key={`${item.provider}-${item.reason}`}
                variant="destructive"
              >
                <AlertTitle>
                  {item.provider} · {item.reason} · {item.errorCategory}
                </AlertTitle>
                <AlertDescription>
                  {item.message}
                  {item.nextActionHint ? (
                    <p className="mt-2 text-xs text-destructive/90">
                      下一步建议：{item.nextActionHint}
                    </p>
                  ) : null}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
