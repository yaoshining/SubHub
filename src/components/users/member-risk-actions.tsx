"use client";

import * as React from "react";
import {
  AlertTriangle,
  PauseCircle,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

import type { AdminMember } from "@/lib/api/users";
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
import { AppError } from "@/lib/errors";
import { memberStatusMeta } from "@/components/users/users-utils";

type MemberRiskActionsProps = {
  member?: AdminMember;
  currentAdminUserId?: string;
  activeAdminCount: number;
  onAction: (
    member: AdminMember,
    action: "suspend" | "restore",
  ) => Promise<void>;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof AppError || error instanceof Error) {
    return error.message;
  }

  return "成员状态更新失败，请稍后重试。";
};

export function MemberRiskActions({
  member,
  currentAdminUserId,
  activeAdminCount,
  onAction,
}: MemberRiskActionsProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!member) {
    return (
      <Card
        className="border-border bg-surface shadow-none"
        data-testid="member-risk-actions-empty"
        id="member-risk-actions"
      >
        <CardContent className="p-6 text-sm text-muted-foreground">
          选中成员后，才会显示暂停 / 恢复等高风险动作。
        </CardContent>
      </Card>
    );
  }

  const action = member.status === "active" ? "suspend" : "restore";
  const blockedReason =
    action === "suspend"
      ? member.rolePreset === "admin" && activeAdminCount <= 1
        ? "最后一个 active admin 不可被暂停。"
        : member.id === currentAdminUserId
          ? "当前登录管理员不能暂停自己。"
          : null
      : null;

  const handleConfirm = async () => {
    setPending(true);
    setError(null);

    try {
      await onAction(member, action);
      setOpen(false);
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setPending(false);
    }
  };

  return (
    <Card
      className="border-border bg-surface shadow-none"
      data-testid="member-risk-actions"
      id="member-risk-actions"
    >
      <CardHeader className="gap-2 p-4 sm:p-6">
        <CardTitle className="text-base">风险动作</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          暂停 / 恢复均保留二次确认；失败时保留当前对象，避免误失上下文。
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 p-4 pt-0 sm:p-6 sm:pt-0">
        <Alert variant={action === "suspend" ? "warning" : "success"}>
          <ShieldAlert aria-hidden="true" className="size-4" />
          <AlertTitle>
            {action === "suspend"
              ? "暂停会立即阻止后台访问"
              : "恢复会重新开放后台访问"}
          </AlertTitle>
          <AlertDescription>
            当前对象：{member.displayName}（
            {memberStatusMeta[member.status].label}）
          </AlertDescription>
        </Alert>

        {blockedReason ? (
          <Alert variant="warning">
            <AlertTriangle aria-hidden="true" className="size-4" />
            <AlertTitle>当前不能执行暂停</AlertTitle>
            <AlertDescription>{blockedReason}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            disabled={Boolean(blockedReason)}
            onClick={() => {
              setOpen(true);
              setError(null);
            }}
            type="button"
            variant={action === "suspend" ? "destructive" : "outline"}
          >
            {action === "suspend" ? (
              <PauseCircle aria-hidden="true" className="size-4" />
            ) : (
              <RotateCcw aria-hidden="true" className="size-4" />
            )}
            {action === "suspend" ? "暂停成员" : "恢复成员"}
          </Button>
        </div>

        <AlertDialog
          onOpenChange={(nextOpen) => {
            if (!pending) {
              setOpen(nextOpen);
            }
          }}
          open={open}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {action === "suspend" ? "确认暂停当前成员" : "确认恢复当前成员"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {action === "suspend"
                  ? "暂停后该成员将无法继续登录或执行受保护后台动作。"
                  : "恢复后该成员可重新进入后台；本操作不会引入额外权限。"}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {error ? (
              <Alert variant="destructive">
                <AlertTriangle aria-hidden="true" className="size-4" />
                <AlertTitle>状态更新未完成</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
              <Button
                disabled={pending}
                onClick={() => void handleConfirm()}
                type="button"
                variant={action === "suspend" ? "destructive" : "default"}
              >
                {pending
                  ? "提交中"
                  : action === "suspend"
                    ? "确认暂停"
                    : "确认恢复"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
