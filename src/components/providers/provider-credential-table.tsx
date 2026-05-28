"use client";

import * as React from "react";
import { AlertTriangle, KeyRound, Plus } from "lucide-react";

import type { ProviderCredential } from "@/lib/api/providers";
import {
  createProviderCredential,
  isolateProviderCredential,
  restoreProviderCredential,
} from "@/lib/api/providers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppError } from "@/lib/errors";
import {
  CredentialStatusBadge,
  formatDateTime,
  formatTokenFragment,
} from "@/components/providers/provider-utils";

export type ProviderCredentialTableProps = {
  providerId: string;
  credentials: ProviderCredential[];
  readOnly?: boolean;
  onProviderChange?: (dirtyLabel: string, provider: import("@/lib/api/providers").ProviderDetail) => void;
  onCredentialsChange: (
    credentials: ProviderCredential[],
    dirtyLabel: string,
  ) => void;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof AppError || error instanceof Error) {
    return error.message;
  }
  return "凭据操作失败，请稍后重试。";
};

export function ProviderCredentialTable({
  providerId,
  credentials,
  readOnly,
  onProviderChange,
  onCredentialsChange,
}: ProviderCredentialTableProps) {
  const [label, setLabel] = React.useState("secondary token");
  const [secret, setSecret] = React.useState("");
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const activeCount = credentials.filter(
    (item) => item.status === "active",
  ).length;

  async function addCredential(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!label.trim() || !secret.trim()) {
      setError("新增凭据需要填写标签与 API Key。");
      return;
    }

    setCreating(true);
    try {
      const credential = await createProviderCredential(providerId, {
        label: label.trim(),
        secret: secret.trim(),
      });
      onCredentialsChange([...credentials, credential], "新增凭据");
      setSecret("");
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setCreating(false);
    }
  }

  async function isolateCredential(credential: ProviderCredential) {
    setPendingId(credential.id);
    setError(null);
    try {
      const result = await isolateProviderCredential(
        providerId,
        credential.id,
        {
          reason: "管理员从 Provider Detail 隔离异常凭据",
        },
      );
      if (onProviderChange) {
        onProviderChange(`隔离凭据 ${credential.label}`, result.provider);
      } else {
        onCredentialsChange(
          credentials.map((item) =>
            item.id === credential.id ? result.credential : item,
          ),
          `隔离凭据 ${credential.label}`,
        );
      }
    } catch (isolateError) {
      setError(getErrorMessage(isolateError));
    } finally {
      setPendingId(null);
    }
  }

  async function restoreCredential(credential: ProviderCredential) {
    setPendingId(credential.id);
    setError(null);
    try {
      const result = await restoreProviderCredential(providerId, credential.id);
      if (onProviderChange) {
        onProviderChange(`恢复隔离凭据 ${credential.label}`, result.provider);
      } else {
        onCredentialsChange(
          credentials.map((item) =>
            item.id === credential.id ? result.credential : item,
          ),
          `恢复隔离凭据 ${credential.label}`,
        );
      }
    } catch (restoreError) {
      setError(getErrorMessage(restoreError));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card
      className="border-border bg-surface shadow-none"
      data-testid="provider-credential-table"
    >
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Token 池</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            上游 Provider API Key 与下游调用方 Key 必须保持分离。
          </p>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="grid gap-5 pt-6">
        {activeCount === 0 ? (
          <Alert variant="destructive" data-testid="no-active-credential-alert">
            <AlertTriangle aria-hidden="true" className="size-4" />
            <AlertTitle>当前无活跃凭据，对外服务已中断</AlertTitle>
            <AlertDescription>
              请新增或恢复至少一个 active API Key，再启用该 Provider。
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>凭据操作失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!readOnly ? (
          <form
            className="grid gap-3 rounded-lg border bg-muted/30 p-4 desktop:grid-cols-[1fr_1fr_auto] desktop:items-end"
            onSubmit={addCredential}
          >
            <div className="grid gap-2">
              <label
                className="text-sm font-medium"
                htmlFor="new-credential-label"
              >
                新凭据标签
              </label>
              <Input
                id="new-credential-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                disabled={creating}
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm font-medium"
                htmlFor="new-credential-secret"
              >
                API Key
              </label>
              <Input
                id="new-credential-secret"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                disabled={creating}
                placeholder="只在写入时处理"
              />
            </div>
            <Button type="submit" disabled={creating}>
              <Plus aria-hidden="true" className="size-4" />
              {creating ? "新增中" : "新增凭据"}
            </Button>
          </form>
        ) : null}

        <div className="hidden overflow-x-auto rounded-lg border desktop:block">
          <Table className="min-w-[48rem]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-xs">Token 片段</TableHead>
                <TableHead className="text-xs">状态</TableHead>
                <TableHead className="text-xs">剩余额度</TableHead>
                <TableHead className="text-xs">最近异常摘要</TableHead>
                <TableHead className="text-right text-xs">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.map((credential) => (
                <TableRow key={credential.id}>
                  <TableCell>
                    <div>
                      <p className="font-mono text-xs">
                        {formatTokenFragment(credential)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {credential.label}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <CredentialStatusBadge status={credential.status} />
                  </TableCell>
                  <TableCell>
                    {credential.remainingQuota == null
                      ? "未知"
                      : `${credential.remainingQuota} 次`}
                  </TableCell>
                  <TableCell className="max-w-[18rem] text-muted-foreground">
                    {credential.lastErrorSummary ??
                      `最近使用：${formatDateTime(credential.lastUsedAt)}`}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    {credential.status === "isolated" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={readOnly || pendingId === credential.id}
                        onClick={() => void restoreCredential(credential)}
                      >
                        恢复隔离
                      </Button>
                    ) : credential.status === "disabled" ? (
                      <span className="text-xs text-muted-foreground">
                        已手动停用
                      </span>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={readOnly || pendingId === credential.id}
                          >
                            隔离
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              确认隔离异常凭据？
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              该凭据将立即从活跃池中移出，不影响同 Provider
                              下其他 active 凭据继续服务。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => void isolateCredential(credential)}
                            >
                              确认隔离
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 desktop:hidden">
          {credentials.map((credential) => (
            <div
              className="rounded-lg border bg-muted/20 p-4"
              key={credential.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs">
                    {formatTokenFragment(credential)}
                  </p>
                  <p className="mt-1 text-sm font-medium">{credential.label}</p>
                </div>
                <CredentialStatusBadge status={credential.status} />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                剩余额度：
                {credential.remainingQuota == null
                  ? "未知"
                  : `${credential.remainingQuota} 次`}
                ；最近异常：{credential.lastErrorSummary ?? "无"}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                {credential.status === "isolated" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={readOnly || pendingId === credential.id}
                    onClick={() => void restoreCredential(credential)}
                  >
                    恢复隔离
                  </Button>
                ) : credential.status === "disabled" ? (
                  <span className="self-center text-xs text-muted-foreground">
                    已手动停用
                  </span>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={readOnly || pendingId === credential.id}
                      >
                        隔离
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认隔离异常凭据？</AlertDialogTitle>
                        <AlertDialogDescription>
                          该凭据将立即从活跃池中移出，不影响同 Provider 下其他
                          active 凭据继续服务。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => void isolateCredential(credential)}
                        >
                          确认隔离
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
          {credentials.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/20 p-8 text-center">
              <KeyRound
                aria-hidden="true"
                className="size-6 text-muted-foreground"
              />
              <p className="text-sm font-medium">尚无 Provider API Key</p>
              <p className="text-xs leading-5 text-muted-foreground">
                新增凭据后才可恢复服务能力。
              </p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
