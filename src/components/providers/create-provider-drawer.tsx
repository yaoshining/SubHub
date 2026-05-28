"use client";

import * as React from "react";
import { KeyRound, Plus, Server } from "lucide-react";

import type { ProviderDetail } from "@/lib/api/providers";
import { createProvider } from "@/lib/api/providers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { AppError } from "@/lib/errors";

export type CreateProviderDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (provider: ProviderDetail) => void;
  disabled?: boolean;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof AppError || error instanceof Error) {
    return error.message;
  }
  return "创建 Provider 失败，请稍后重试。";
};

export function CreateProviderDrawer({
  open,
  onOpenChange,
  onCreated,
  disabled,
}: CreateProviderDrawerProps) {
  const [name, setName] = React.useState("OpenSubtitles Primary");
  const [credentialLabel, setCredentialLabel] = React.useState("primary token");
  const [secret, setSecret] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSecret("");
      setError(null);
      setSubmitting(false);
    }
    onOpenChange(nextOpen);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Provider 名称不能为空。");
      return;
    }
    if (!credentialLabel.trim() || !secret.trim()) {
      setError("首个 API Key 的标签与密钥均为必填项。");
      return;
    }

    setSubmitting(true);
    try {
      const provider = await createProvider({
        name: name.trim(),
        type: "opensubtitles",
        initialCredential: {
          label: credentialLabel.trim(),
          secret: secret.trim(),
        },
      });
      onCreated(provider);
      setSecret("");
      onOpenChange(false);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer direction="right" open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button disabled={disabled}>
          <Plus aria-hidden="true" className="size-4" />
          新增 OpenSubtitles
        </Button>
      </DrawerTrigger>
      <DrawerContent className="w-full max-w-xl overflow-y-auto sm:w-[34rem]">
        <form className="flex min-h-[100dvh] flex-col" onSubmit={submit}>
          <DrawerHeader className="border-b text-left">
            <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/40 text-primary">
              <Server aria-hidden="true" className="size-5" />
            </div>
            <DrawerTitle>新增 OpenSubtitles Provider</DrawerTitle>
            <DrawerDescription>
              本抽屉只完成首轮建档与首个上游 API Key
              录入；权重、并发、冷却和回退策略请在详情页继续配置。
            </DrawerDescription>
          </DrawerHeader>

          <div className="grid flex-1 gap-6 p-4 sm:p-6">
            {error ? (
              <Alert variant="destructive" data-testid="create-provider-error">
                <AlertTitle>创建失败</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <section className="grid gap-3">
              <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
                <KeyRound
                  aria-hidden="true"
                  className="mt-0.5 size-4 text-primary"
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium">OpenSubtitles 模板</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    当前 MVP 不开放 Custom Adapter、Base URL
                    或认证方式切换，避免创建流程漂移。
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="provider-name">
                  Provider 名称
                </label>
                <Input
                  id="provider-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="OpenSubtitles Primary"
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  用于在列表和详情页区分多个 OpenSubtitles 实例。
                </p>
              </div>

              <Separator />

              <div className="grid gap-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="credential-label"
                >
                  首个 API Key 标签
                </label>
                <Input
                  id="credential-label"
                  value={credentialLabel}
                  onChange={(event) => setCredentialLabel(event.target.value)}
                  placeholder="primary token"
                  disabled={submitting}
                />
              </div>

              <div className="grid gap-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="credential-secret"
                >
                  OpenSubtitles API Key
                </label>
                <Input
                  id="credential-secret"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder="仅在写入时处理，不会在列表展示明文"
                  type="password"
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  明文凭据只用于本次提交；响应与列表仅展示受控片段。
                </p>
              </div>
            </section>
          </div>

          <DrawerFooter className="border-t sm:flex-row sm:justify-between">
            <DrawerClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                取消
              </Button>
            </DrawerClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? "创建中" : "创建并返回列表"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
