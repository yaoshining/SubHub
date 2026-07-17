import * as React from "react";
import { RotateCcw, Search } from "lucide-react";

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
import { Separator } from "@/components/ui/separator";
import type {
  SubtitleValidatorProviderCapability,
  SubtitleValidatorSearchField,
  SubtitleValidatorSearchRequest,
} from "@/server/subtitles/admin-subtitle-validator-schema";

type SubtitleValidatorSearchComposerProps = {
  provider: SubtitleValidatorProviderCapability | null;
  form: SubtitleValidatorSearchRequest;
  searching: boolean;
  onChange: (next: SubtitleValidatorSearchRequest) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
};

function supportsField(
  provider: SubtitleValidatorProviderCapability | null,
  field: SubtitleValidatorSearchField,
) {
  return provider?.extendedFields.includes(field) ?? false;
}

export function SubtitleValidatorSearchComposer({
  provider,
  form,
  searching,
  onChange,
  onSubmit,
  onReset,
}: SubtitleValidatorSearchComposerProps) {
  const [requiredFieldErrors, setRequiredFieldErrors] = React.useState<{
    providerId: string | null;
    fields: SubtitleValidatorSearchField[];
  }>({ providerId: null, fields: [] });
  const activeRequiredFieldErrors =
    requiredFieldErrors.providerId === provider?.providerId
      ? requiredFieldErrors.fields
      : [];
  const showEpisodeFields =
    supportsField(provider, "season") || supportsField(provider, "episode");
  const showIdentifierFields =
    supportsField(provider, "imdbId") || supportsField(provider, "tmdbId");
  const isRequiredField = (field: SubtitleValidatorSearchField) =>
    provider?.requiredSearchFields.includes(field) ?? false;
  const hasRequiredFieldError = (field: SubtitleValidatorSearchField) =>
    activeRequiredFieldErrors.includes(field);
  const clearRequiredFieldError = (field: SubtitleValidatorSearchField) => {
    setRequiredFieldErrors({
      providerId: provider?.providerId ?? null,
      fields: activeRequiredFieldErrors.filter((item) => item !== field),
    });
  };
  const setKeyword = (keyword: string) => {
    onChange({ ...form, baseParams: { ...form.baseParams, keyword } });
    clearRequiredFieldError("title");
  };
  const setProviderParam = (
    key: string,
    value: string | number | boolean | null,
  ) => {
    const providerParams = { ...form.providerParams };
    if (value === null || value === "") {
      delete providerParams[key];
    } else {
      providerParams[key] = value;
    }
    onChange({ ...form, providerParams });
  };
  const getStringParam = (key: string) =>
    typeof form.providerParams[key] === "string"
      ? form.providerParams[key]
      : "";
  const getNumberParam = (key: string) =>
    typeof form.providerParams[key] === "number"
      ? String(form.providerParams[key])
      : "";
  const getFieldLabel = (field: SubtitleValidatorSearchField) => {
    const labels: Partial<Record<SubtitleValidatorSearchField, string>> = {
      query: "附加查询",
      language: "语言",
      title: "关键词 / 标题",
    };
    return labels[field] ?? field;
  };
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const missingFields = (provider?.requiredSearchFields ?? []).filter(
      (field) => {
        if (field === "title") {
          return !form.baseParams.keyword.trim();
        }
        const value = form.providerParams[field];
        return typeof value !== "string" || !value.trim();
      },
    );

    setRequiredFieldErrors({
      providerId: provider?.providerId ?? null,
      fields: missingFields,
    });
    if (missingFields.length > 0) {
      return;
    }

    onSubmit(event);
  };

  return (
    <Card className="border-border bg-surface shadow-none">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">Search Composer</CardTitle>
          <p className="text-sm text-muted-foreground">
            保留稳定的通用参数区，把 provider
            特有输入收敛到扩展区，避免切换时整页跳变。
          </p>
        </div>
        <Badge variant="secondary">
          {provider ? provider.providerName : "未选择 Provider"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <form className="grid gap-5" noValidate onSubmit={handleSubmit}>
          {activeRequiredFieldErrors.length > 0 ? (
            <div
              aria-live="polite"
              className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              请填写必填参数：
              {activeRequiredFieldErrors.map(getFieldLabel).join("、")}。
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <label className="text-sm font-medium" htmlFor="validator-title">
                关键词 / 标题
              </label>
              <Input
                id="validator-title"
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="例如 The Matrix / Friends S01E01"
                required
                value={form.baseParams.keyword}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="validator-query">
                附加查询{isRequiredField("query") ? "（必填）" : ""}
              </label>
              <Input
                aria-describedby={
                  hasRequiredFieldError("query")
                    ? "validator-query-error"
                    : undefined
                }
                aria-invalid={hasRequiredFieldError("query")}
                id="validator-query"
                onChange={(event) => {
                  setProviderParam("query", event.target.value);
                  clearRequiredFieldError("query");
                }}
                placeholder={
                  isRequiredField("query") ? "请输入附加查询" : "可选关键词补充"
                }
                required={isRequiredField("query")}
                value={getStringParam("query")}
              />
              {hasRequiredFieldError("query") ? (
                <p
                  className="text-xs text-destructive"
                  id="validator-query-error"
                >
                  请填写附加查询。
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm font-medium"
                htmlFor="validator-language"
              >
                语言{isRequiredField("language") ? "（必填）" : ""}
              </label>
              <Input
                aria-describedby={
                  hasRequiredFieldError("language")
                    ? "validator-language-error"
                    : undefined
                }
                aria-invalid={hasRequiredFieldError("language")}
                id="validator-language"
                onChange={(event) => {
                  setProviderParam("language", event.target.value);
                  clearRequiredFieldError("language");
                }}
                placeholder={
                  isRequiredField("language") ? "请输入语言" : "如 zh-CN / en"
                }
                required={isRequiredField("language")}
                value={getStringParam("language")}
              />
              {hasRequiredFieldError("language") ? (
                <p
                  className="text-xs text-destructive"
                  id="validator-language-error"
                >
                  请填写语言。
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="validator-type">
                媒体类型
              </label>
              <Select
                onValueChange={(value) =>
                  setProviderParam("type", value === "all" ? null : value)
                }
                value={getStringParam("type") || "all"}
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
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="validator-year">
                年份
              </label>
              <Input
                id="validator-year"
                inputMode="numeric"
                onChange={(event) =>
                  setProviderParam(
                    "year",
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
                placeholder="如 1999"
                value={getNumberParam("year")}
              />
            </div>
          </div>
          <Separator />
          <div className="rounded-2xl border border-dashed border-border/70 px-4 py-3 text-xs text-muted-foreground">
            {provider?.baseFieldNotice ??
              "基础通用参数覆盖关键词、语言、媒体类型与年份；切换 provider 时这部分保持稳定。"}
          </div>
          <div className="grid gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Provider 扩展参数
              </p>
              <p className="text-xs text-muted-foreground">
                {provider?.extendedFieldNotice ??
                  "当前仅在 Provider 支持时展示额外字段；未出现的字段表示当前验证场景不需要。"}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {showEpisodeFields ? (
                <>
                  <div className="grid gap-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor="validator-season"
                    >
                      Season
                    </label>
                    <Input
                      id="validator-season"
                      inputMode="numeric"
                      onChange={(event) =>
                        setProviderParam(
                          "season",
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                      placeholder="1"
                      value={getNumberParam("season")}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor="validator-episode"
                    >
                      Episode
                    </label>
                    <Input
                      id="validator-episode"
                      inputMode="numeric"
                      onChange={(event) =>
                        setProviderParam(
                          "episode",
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                      placeholder="1"
                      value={getNumberParam("episode")}
                    />
                  </div>
                </>
              ) : null}
              {showIdentifierFields ? (
                <>
                  <div className="grid gap-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor="validator-imdb-id"
                    >
                      IMDb ID
                    </label>
                    <Input
                      id="validator-imdb-id"
                      onChange={(event) =>
                        setProviderParam("imdbId", event.target.value)
                      }
                      placeholder="tt0133093"
                      value={getStringParam("imdbId")}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor="validator-tmdb-id"
                    >
                      TMDb ID
                    </label>
                    <Input
                      id="validator-tmdb-id"
                      inputMode="numeric"
                      onChange={(event) =>
                        setProviderParam(
                          "tmdbId",
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                      placeholder="603"
                      value={getNumberParam("tmdbId")}
                    />
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 px-4 py-4 text-sm text-muted-foreground md:col-span-2">
                  当前 Provider
                  没有额外的结构化扩展参数；推荐先用关键词验证基础搜索链路。
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={!provider || searching} type="submit">
              <Search className="mr-2 size-4" />
              {searching ? "正在验证" : "搜索验证"}
            </Button>
            <Button onClick={onReset} type="button" variant="outline">
              <RotateCcw className="mr-2 size-4" />
              重置参数
            </Button>
            <span className="text-xs text-muted-foreground">
              这是内部诊断请求，不替代正式字幕搜索用户路径。
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
