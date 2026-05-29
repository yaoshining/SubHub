"use client";

import * as React from "react";
import { AlertTriangle, LaptopMinimal, Shield } from "lucide-react";

import type {
  AdminMember,
  AdminSessionAttentionSummary,
  AdminSessionRemediationAction,
  AdminSessionRemediationRequest,
} from "@/lib/api/users";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AppError } from "@/lib/errors";
import {
  formatTimestamp,
  getSessionReasonLabel,
} from "@/components/users/users-utils";

const fieldLabelClassName =
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70";

type SessionRemediationProps = {
  sessions: AdminSessionAttentionSummary[];
  selectedMember?: AdminMember;
  onRemediate: (
    sessionId: string,
    input: AdminSessionRemediationRequest,
  ) => Promise<void>;
};

type RemediationDialogState = {
  session: AdminSessionAttentionSummary;
  action: AdminSessionRemediationAction;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof AppError || error instanceof Error) {
    return error.message;
  }

  return "会话处置失败，请稍后重试。";
};

export function SessionRemediation({
  sessions,
  selectedMember,
  onRemediate,
}: SessionRemediationProps) {
  const visibleSessions = selectedMember
    ? sessions.filter((session) => session.memberId === selectedMember.id)
    : sessions;
  const [dialogState, setDialogState] =
    React.useState<RemediationDialogState | null>(null);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const openDialog = (
    session: AdminSessionAttentionSummary,
    action: AdminSessionRemediationAction,
  ) => {
    setDialogState({ session, action });
    setReason(
      action === "revoke"
        ? "管理员复核后撤销风险会话"
        : "管理员复核后标记会话已处理",
    );
    setError(null);
  };

  const handleConfirm = async () => {
    if (!dialogState) {
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError("请填写本次处置原因。");
      return;
    }

    setPending(true);
    setError(null);

    try {
      await onRemediate(dialogState.session.id, {
        action: dialogState.action,
        reason: trimmedReason,
      });
      setDialogState(null);
    } catch (remediationError) {
      setError(getErrorMessage(remediationError));
    } finally {
      setPending(false);
    }
  };

  return (
    <Card
      className="border-border bg-surface shadow-none"
      data-testid="session-remediation"
    >
      <CardHeader className="gap-2 p-4 sm:p-6">
        <CardTitle className="text-base">设备与会话</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          仅支持基础会话处置：撤销会话或标记已处理；不引入高级风险分析或策略系统。
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 p-4 pt-0 sm:p-6 sm:pt-0">
        {visibleSessions.length === 0 ? (
          <Alert variant="success" data-testid="users-session-safe">
            <Shield aria-hidden="true" className="size-4" />
            <AlertTitle>
              {selectedMember
                ? "当前成员无异常会话"
                : "当前无异常会话 / 当前安全"}
            </AlertTitle>
            <AlertDescription>
              会话区不会留白；当没有风险对象时，明确给出安全状态提示。
            </AlertDescription>
          </Alert>
        ) : (
          visibleSessions.map((session) => (
            <div
              className="grid gap-3 rounded-lg border p-4"
              key={session.id}
              data-testid="session-remediation-item"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <LaptopMinimal aria-hidden="true" className="size-4" />
                    {session.deviceLabel ?? "未命名设备"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    最近活动：{formatTimestamp(session.lastSeenAt)}
                  </p>
                </div>
                <AlertTriangle
                  aria-hidden="true"
                  className="size-4 text-warning"
                />
              </div>

              <div className="grid gap-1 text-sm">
                <p>
                  <span className="text-muted-foreground">风险原因：</span>
                  {getSessionReasonLabel(session.reason)}
                </p>
                <p className="text-xs text-muted-foreground">
                  会话 ID：{session.id}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  onClick={() => openDialog(session, "mark_resolved")}
                  type="button"
                  variant="outline"
                >
                  标记已处理
                </Button>
                <Button
                  onClick={() => openDialog(session, "revoke")}
                  type="button"
                  variant="destructive"
                >
                  撤销会话
                </Button>
              </div>
            </div>
          ))
        )}

        <AlertDialog
          onOpenChange={(open) => {
            if (!open && !pending) {
              setDialogState(null);
            }
          }}
          open={Boolean(dialogState)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {dialogState?.action === "revoke"
                  ? "确认撤销风险会话"
                  : "确认标记会话已处理"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {dialogState?.action === "revoke"
                  ? "撤销后该后台会话将立即失效，用于阻止继续访问受保护后台动作。"
                  : "标记已处理会保留当前上下文，但会从需要关注列表中移除。"}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {error ? (
              <Alert variant="destructive">
                <AlertTriangle aria-hidden="true" className="size-4" />
                <AlertTitle>处置未完成</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-2">
              <label
                className={fieldLabelClassName}
                htmlFor="session-remediation-reason"
              >
                处置原因
              </label>
              <Textarea
                disabled={pending}
                id="session-remediation-reason"
                onChange={(event) => setReason(event.target.value)}
                value={reason}
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
              <Button
                disabled={pending}
                onClick={() => void handleConfirm()}
                type="button"
                variant={
                  dialogState?.action === "revoke" ? "destructive" : "default"
                }
              >
                {pending
                  ? "提交中"
                  : dialogState?.action === "revoke"
                    ? "确认撤销"
                    : "确认标记已处理"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
