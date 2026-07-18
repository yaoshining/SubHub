import { CheckCircle2, Download, Link2, Loader2, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  SubtitleValidatorDownloadMode,
  SubtitleValidatorProviderFailure,
  SubtitleValidatorSearchResult,
} from "@/lib/api/subtitle-validator";

import type { SubtitleValidatorRecentDownloadValidation } from "./subtitle-validator-download-status";

type SubtitleValidatorResultsConsoleProps = {
  results: SubtitleValidatorSearchResult[];
  failures: SubtitleValidatorProviderFailure[];
  searching: boolean;
  downloadingIds: string[];
  onValidateDownload: (
    result: SubtitleValidatorSearchResult,
    mode: SubtitleValidatorDownloadMode,
  ) => void;
  recentValidation: SubtitleValidatorRecentDownloadValidation | null;
  nextActionHint?: string | null;
};

const modeLabel: Record<SubtitleValidatorDownloadMode, string> = {
  browser_download: "浏览器下载验证",
  url_check: "URL 检查",
};

const statusLabel = {
  success: "成功",
  failed: "失败",
  missing_download: "无下载地址",
  unsupported: "不支持",
} as const;

function formatCompletedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "刚刚"
    : new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date);
}

export function SubtitleValidatorResultsConsole({
  results,
  failures,
  searching,
  downloadingIds,
  onValidateDownload,
  recentValidation,
  nextActionHint,
}: SubtitleValidatorResultsConsoleProps) {
  return (
    <Card className="border-border bg-surface shadow-none">
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Search Results Console</CardTitle>
          <p className="text-sm text-muted-foreground">
            紧凑结果行仅显示安全的验证上下文；下载与 URL 检查均通过后台受控 API
            发起。
          </p>
        </div>
        <Badge variant="secondary">结果 {results.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {searching ? (
          <div
            className="rounded-lg border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground"
            role="status"
          >
            正在执行搜索验证，保留上一轮上下文并等待新结果返回...
          </div>
        ) : null}

        {!searching && results.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
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
            className="grid divide-y divide-border overflow-hidden rounded-lg border border-border/70"
            data-testid="subtitle-validator-results-console"
          >
            {results.map((item) => {
              const isOpenSubtitles = item.provider === "opensubtitles";
              const isXunlei = item.provider === "xunlei";
              const isLoading = downloadingIds.includes(item.id);
              const rowValidation =
                recentValidation?.resultId === item.id
                  ? recentValidation
                  : null;
              const canCheckUrl = isXunlei && Boolean(item.providerDownloadUrl);

              return (
                <div
                  className="grid gap-3 bg-surface-elevated px-3 py-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                  key={item.id}
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {item.releaseName ?? item.id}
                      </span>
                      <Badge variant="outline">{item.provider}</Badge>
                      <Badge
                        variant={isOpenSubtitles ? "secondary" : "outline"}
                      >
                        {isOpenSubtitles
                          ? "可浏览器下载"
                          : isXunlei
                            ? "可 URL 检查"
                            : "无下载能力"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.language ?? "unknown"} · {item.format}
                      {item.score !== null && item.score !== undefined
                        ? ` · 评分 ${item.score}`
                        : ""}
                    </p>
                    {rowValidation ? (
                      <p
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
                        data-testid={`download-result-${item.id}`}
                      >
                        {rowValidation.status === "success" ? (
                          <CheckCircle2 className="size-3.5 text-success" />
                        ) : (
                          <XCircle className="size-3.5 text-destructive" />
                        )}
                        <span>
                          最近验证：{modeLabel[rowValidation.downloadMode]} ·{" "}
                          {statusLabel[rowValidation.status]} ·{" "}
                          {formatCompletedAt(rowValidation.completedAt)}
                        </span>
                      </p>
                    ) : null}
                    {isXunlei && !item.providerDownloadUrl ? (
                      <p className="text-xs text-muted-foreground">
                        无下载地址可验证。
                      </p>
                    ) : null}
                    {isXunlei ? (
                      <p className="text-xs text-muted-foreground">
                        Xunlei 不支持浏览器下载验证，请使用 URL 检查。
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      aria-label={`验证 ${item.releaseName ?? item.id} 浏览器下载`}
                      disabled={!isOpenSubtitles || isLoading}
                      onClick={() =>
                        onValidateDownload(item, "browser_download")
                      }
                      size="sm"
                      type="button"
                    >
                      {isLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Download className="size-4" />
                      )}
                      浏览器下载
                    </Button>
                    <Button
                      aria-label={`检查 ${item.releaseName ?? item.id} 下载 URL`}
                      disabled={!canCheckUrl || isLoading}
                      onClick={() => onValidateDownload(item, "url_check")}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {isLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Link2 className="size-4" />
                      )}
                      验证下载 URL
                    </Button>
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
