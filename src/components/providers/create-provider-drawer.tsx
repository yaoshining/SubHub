"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Info,
  KeyRound,
  Lock,
  Plus,
  Server,
} from "lucide-react";

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
import { cn } from "@/lib/utils";
import { AppError } from "@/lib/errors";

export type CreateProviderDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (provider: ProviderDetail) => void;
  disabled?: boolean;
  /**
   * Xunlei 由 migration 预置为单实例，default true。后端始终 seed xunlei-default，
   * 因此默认恒显示「已接入」locked 态与说明 Alert。
   */
  hasExistingXunlei?: boolean;
};

type Step = "select" | "form";

const NAME_MIN = 2;
const NAME_MAX = 45;

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
  hasExistingXunlei = true,
}: CreateProviderDrawerProps) {
  const [step, setStep] = React.useState<Step>("select");
  const [name, setName] = React.useState("");
  const [secret, setSecret] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setStep("select");
      setName("");
      setSecret("");
      setError(null);
      setSubmitting(false);
    }
    onOpenChange(nextOpen);
  }

  function handleBack() {
    setStep("select");
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();

    if (trimmedName.length < NAME_MIN || trimmedName.length > NAME_MAX) {
      setError(`Provider 名称长度需为 ${NAME_MIN}–${NAME_MAX} 个字符。`);
      return;
    }
    if (!secret.trim()) {
      setError("首个 API Key 为必填项。");
      return;
    }

    setSubmitting(true);
    try {
      const provider = await createProvider({
        name: trimmedName,
        type: "opensubtitles",
        initialCredential: {
          label: "primary",
          secret: secret.trim(),
        },
      });
      onCreated(provider);
      handleOpenChange(false);
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
          创建 Provider
        </Button>
      </DrawerTrigger>
      <DrawerContent className="w-full max-w-xl overflow-y-auto sm:w-[34rem]">
        <DrawerHeader className="border-b text-left">
          <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/40 text-primary">
            <Server aria-hidden="true" className="size-5" />
          </div>
          <DrawerTitle>创建 Provider</DrawerTitle>
          <DrawerDescription>
            选择一个 provider 类型开始配置。不同 provider 类型有不同的配置项，
            本流程仅完成首轮建档，调度策略可在详情页继续深配。
          </DrawerDescription>
        </DrawerHeader>

        {step === "select" ? (
          <ProviderTypeSelector
            hasExistingXunlei={hasExistingXunlei}
            onSelectOpenSubtitles={() => {
              setError(null);
              setStep("form");
            }}
          />
        ) : (
          <form
            className="flex min-h-[100dvh] flex-col"
            onSubmit={submit}
            data-testid="create-provider-form"
          >
            <div className="grid flex-1 gap-6 p-4 sm:p-6">
              {error ? (
                <Alert
                  variant="destructive"
                  data-testid="create-provider-error"
                >
                  <AlertTitle>创建失败</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <section
                className="grid gap-3 duration-200 animate-in fade-in"
                aria-label="当前创建对象摘要"
              >
                <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
                  <KeyRound
                    aria-hidden="true"
                    className="mt-0.5 size-4 text-primary"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">OpenSubtitles</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Full admin capability · credentials supported ·
                      支持凭据池、健康检查与后续轮换策略
                    </p>
                  </div>
                </div>
              </section>

              <Separator />

              <section className="grid gap-4" aria-label="基础信息">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Basic Info
                </h3>
                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="create-provider-name"
                  >
                    Provider Name
                  </label>
                  <Input
                    id="create-provider-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="OpenSubtitles Primary"
                    maxLength={NAME_MAX}
                    disabled={submitting}
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    用于在列表和详情页区分多个 OpenSubtitles 实例（{NAME_MIN}–
                    {NAME_MAX} 字符）。
                  </p>
                </div>

                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="create-provider-secret"
                  >
                    Initial API Key
                  </label>
                  <Input
                    id="create-provider-secret"
                    value={secret}
                    onChange={(event) => setSecret(event.target.value)}
                    placeholder="仅在写入时处理，不会在列表展示明文"
                    type="password"
                    disabled={submitting}
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    明文凭据只用于本次提交；响应与列表仅展示受控片段。
                  </p>
                </div>
              </section>

              <Separator />

              <section
                className="grid gap-3"
                aria-label="调度初始值"
                data-testid="create-provider-scheduling-defaults"
              >
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Scheduling Defaults
                </h3>
                <p className="text-xs text-muted-foreground">
                  下列数值仅为初始示意，本次创建提交不会写入；
                  创建后前往详情页继续配置 Priority / Weight / Concurrency /
                  Cooldown。
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="grid gap-1.5">
                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor="create-provider-priority-placeholder"
                    >
                      Priority
                    </label>
                    <Input
                      id="create-provider-priority-placeholder"
                      type="number"
                      placeholder="10"
                      disabled
                      tabIndex={-1}
                      aria-disabled="true"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor="create-provider-weight-placeholder"
                    >
                      Weight
                    </label>
                    <Input
                      id="create-provider-weight-placeholder"
                      type="number"
                      placeholder="1"
                      disabled
                      tabIndex={-1}
                      aria-disabled="true"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor="create-provider-concurrency-placeholder"
                    >
                      Concurrency
                    </label>
                    <Input
                      id="create-provider-concurrency-placeholder"
                      type="number"
                      placeholder="3"
                      disabled
                      tabIndex={-1}
                      aria-disabled="true"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor="create-provider-cooldown-placeholder"
                    >
                      Cooldown (s)
                    </label>
                    <Input
                      id="create-provider-cooldown-placeholder"
                      type="number"
                      placeholder="30"
                      disabled
                      tabIndex={-1}
                      aria-disabled="true"
                    />
                  </div>
                </div>
              </section>

              <Separator />

              <section className="grid gap-2" aria-label="后续说明">
                <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
                  <Info
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-primary"
                  />
                  <span>
                    Next Steps：创建后前往详情页继续配置 Rotation / Fallback /
                    Credential Pool。
                  </span>
                </div>
              </section>
            </div>

            <DrawerFooter className="border-t sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={submitting}
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Back
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "创建中" : "Create Provider"}
              </Button>
            </DrawerFooter>
          </form>
        )}

        {step === "select" ? (
          <DrawerFooter className="border-t sm:flex-row sm:justify-end">
            <DrawerClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                取消
              </Button>
            </DrawerClose>
          </DrawerFooter>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

type ProviderTypeSelectorProps = {
  hasExistingXunlei: boolean;
  onSelectOpenSubtitles: () => void;
};

function ProviderTypeSelector({
  hasExistingXunlei,
  onSelectOpenSubtitles,
}: ProviderTypeSelectorProps) {
  return (
    <div
      className="grid flex-1 gap-6 p-4 duration-200 animate-in fade-in sm:p-6"
      data-testid="provider-type-selector"
    >
      <header className="grid gap-1">
        <h2 className="text-base font-semibold">选择 Provider 类型</h2>
        <p className="text-xs text-muted-foreground">
          不同 provider 类型的配置项与能力范围不同。OpenSubtitles
          支持完整创建；Xunlei 为预置单实例，不可重复创建。
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onSelectOpenSubtitles}
          data-testid="provider-type-option-opensubtitles"
          aria-label="选择 OpenSubtitles 类型并进入首轮建档"
          className={cn(
            "group flex flex-col gap-3 rounded-lg border bg-card p-4 text-left transition-colors",
            "border-border hover:border-primary hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              OpenSubtitles
            </span>
            <ArrowRight
              aria-hidden="true"
              className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
            />
          </div>
          <p className="text-sm leading-5 text-foreground">
            独立字幕源，支持凭据池、健康检查与后续轮换策略。
          </p>
          <span className="mt-auto text-xs font-medium text-primary">
            下一步 →
          </span>
        </button>

        <div
          data-testid="provider-type-option-xunlei"
          aria-disabled="true"
          aria-label="Xunlei 类型已接入，不可重复创建"
          className={cn(
            "flex cursor-not-allowed flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 opacity-70",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              <Lock aria-hidden="true" className="size-3" />
              Xunlei
            </span>
            <Lock aria-hidden="true" className="size-4 text-muted-foreground" />
          </div>
          <p className="text-sm leading-5 text-muted-foreground">
            系统预置实例，当前不允许通过 UI 重复创建。
          </p>
          <span className="mt-auto text-xs text-muted-foreground">
            已接入 / 不可重复创建
          </span>
        </div>
      </div>

      {hasExistingXunlei ? (
        <Alert data-testid="xunlei-provisioned-notice">
          <Info aria-hidden="true" className="size-4" />
          <AlertTitle>Xunlei 已预置</AlertTitle>
          <AlertDescription>
            已有 Xunlei 实例在运行。Xunlei 为预置
            provider，单实例不可重复创建。如需重新接入请联系运维。
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
