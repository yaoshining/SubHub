"use client";

import * as React from "react";
import { KeyRound, Plus } from "lucide-react";

import type {
  CallerKeyReveal,
  CreateCallerKeyRequest,
} from "@/lib/api/caller-keys";
import { createCallerKey } from "@/lib/api/caller-keys";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { AppError } from "@/lib/errors";

export type CallerKeyFormProps = {
  disabled?: boolean;
  callerNameInputRef?: React.RefObject<HTMLInputElement>;
  onCreated: (result: CallerKeyReveal) => void;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof AppError || error instanceof Error) {
    return error.message;
  }
  return "创建 Caller Key 失败，请稍后重试。";
};

export function CallerKeyForm({
  disabled,
  callerNameInputRef,
  onCreated,
}: CallerKeyFormProps) {
  const [callerName, setCallerName] = React.useState("Jellyfin Living Room");
  const [environment, setEnvironment] =
    React.useState<CreateCallerKeyRequest["environment"]>("production");
  const [scope, setScope] =
    React.useState<CreateCallerKeyRequest["scope"]>("subtitles:read");
  const [quotaPolicy, setQuotaPolicy] = React.useState("default");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!callerName.trim()) {
      setError("调用方名称不能为空。");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createCallerKey({
        callerName: callerName.trim(),
        environment,
        scope,
        quotaPolicy,
      });
      onCreated(result);
      setCallerName("");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card
      className="border-border bg-surface shadow-none"
      data-testid="caller-key-form"
    >
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/30 text-primary">
            <KeyRound aria-hidden="true" className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">生成与授权</CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              为下游应用创建首轮访问凭据。完整明文只会在创建后的受控窗口内显示一次。
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <form className="grid gap-4" onSubmit={submit}>
          {error ? (
            <Alert variant="destructive" data-testid="caller-key-form-error">
              <AlertTitle>创建失败</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="caller-name">
              调用方名称
            </label>
            <Input
              id="caller-name"
              ref={callerNameInputRef}
              value={callerName}
              onChange={(event) => setCallerName(event.target.value)}
              placeholder="例如 Jellyfin Living Room"
              disabled={disabled || submitting}
            />
            <p className="text-xs text-muted-foreground">
              用于在 inventory 与详情中识别外部应用，不会作为密钥片段展示。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <label
                className="text-sm font-medium"
                htmlFor="caller-environment"
              >
                环境
              </label>
              <Select
                value={environment}
                onValueChange={(value) =>
                  setEnvironment(value as CreateCallerKeyRequest["environment"])
                }
                disabled={disabled || submitting}
              >
                <SelectTrigger id="caller-environment" aria-label="环境">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">生产</SelectItem>
                  <SelectItem value="staging">预发</SelectItem>
                  <SelectItem value="development">开发</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="caller-quota">
                配额
              </label>
              <Select
                value={quotaPolicy}
                onValueChange={setQuotaPolicy}
                disabled={disabled || submitting}
              >
                <SelectTrigger id="caller-quota" aria-label="配额">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">默认配额</SelectItem>
                  <SelectItem value="trusted">可信调用方</SelectItem>
                  <SelectItem value="limited">低频调用方</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="caller-scope">
                Scope
              </label>
              <Select
                value={scope}
                onValueChange={(value) =>
                  setScope(value as CreateCallerKeyRequest["scope"])
                }
                disabled={disabled || submitting}
              >
                <SelectTrigger id="caller-scope" aria-label="Scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subtitles:read">subtitles:read</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Alert variant="warning">
            <KeyRound aria-hidden="true" className="size-4" />
            <AlertTitle>一次性明文提醒</AlertTitle>
            <AlertDescription>
              创建成功后请在受控窗口内复制给下游系统；页面不会在默认态或
              inventory 中暴露完整 Key。
            </AlertDescription>
          </Alert>

          <Button type="submit" disabled={disabled || submitting}>
            <Plus aria-hidden="true" className="size-4" />
            {submitting ? "生成中" : "生成新 Key"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
