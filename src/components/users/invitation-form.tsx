"use client";

import * as React from "react";
import { Shield, UserPlus } from "lucide-react";

import type {
  CreateAdminInvitationRequest,
  CreateAdminInvitationRequestAccessPreset,
} from "@/lib/api/users";
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
import { rolePresetLabel } from "@/components/users/users-utils";

type InvitationFormProps = {
  onSubmit: (input: CreateAdminInvitationRequest) => Promise<void>;
  disabled?: boolean;
};

const roleOptions = [
  { value: "admin", label: rolePresetLabel.admin },
  { value: "operator", label: rolePresetLabel.operator },
] as const;

const accessOptions: {
  value: CreateAdminInvitationRequestAccessPreset;
  label: string;
}[] = [{ value: "admin_console", label: "后台控制台" }];

const getErrorMessage = (error: unknown) => {
  if (error instanceof AppError || error instanceof Error) {
    return error.message;
  }

  return "邀请发送失败，请稍后重试。";
};

const fieldLabelClassName =
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70";

export function InvitationForm({
  onSubmit,
  disabled = false,
}: InvitationFormProps) {
  const [identifier, setIdentifier] = React.useState("");
  const [rolePreset, setRolePreset] =
    React.useState<CreateAdminInvitationRequest["rolePreset"]>("operator");
  const [accessPreset, setAccessPreset] =
    React.useState<CreateAdminInvitationRequestAccessPreset>("admin_console");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      setError("请先填写邀请对象标识（例如邮箱地址）。");
      return;
    }

    setPending(true);
    setError(null);

    try {
      await onSubmit({
        identifier: trimmedIdentifier,
        rolePreset,
        accessPreset,
      });
      setIdentifier("");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setPending(false);
    }
  };

  return (
    <Card
      className="border-border bg-surface shadow-none"
      data-testid="invitation-form"
    >
      <CardHeader className="gap-2 p-4 sm:p-6">
        <CardTitle className="text-base">邀请新成员</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          仅允许选择预设角色与接入范围，不在本页定义权限矩阵或策略编辑。
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 p-4 pt-0 sm:p-6 sm:pt-0">
        <Alert variant="warning">
          <Shield aria-hidden="true" className="size-4" />
          <AlertTitle>策略编辑不在当前范围</AlertTitle>
          <AlertDescription>
            Users 页面只负责后台访问生命周期的最小治理。默认角色与接入范围均为预设候选。
          </AlertDescription>
        </Alert>

        {error ? (
          <Alert variant="destructive">
            <Shield aria-hidden="true" className="size-4" />
            <AlertTitle>邀请未发送</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <label className={fieldLabelClassName} htmlFor="invitation-identifier">
              邀请对象
            </label>
            <Input
              disabled={disabled || pending}
              id="invitation-identifier"
              name="identifier"
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="operator@example.com"
              value={identifier}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className={fieldLabelClassName} htmlFor="invitation-role">
                默认角色
              </label>
              <Select
                disabled={disabled || pending}
                onValueChange={(value) =>
                  setRolePreset(value as CreateAdminInvitationRequest["rolePreset"])
                }
                value={rolePreset}
              >
                <SelectTrigger id="invitation-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <label className={fieldLabelClassName} htmlFor="invitation-access">
                接入范围
              </label>
              <Select
                disabled={disabled || pending}
                onValueChange={(value) =>
                  setAccessPreset(value as CreateAdminInvitationRequestAccessPreset)
                }
                value={accessPreset}
              >
                <SelectTrigger id="invitation-access">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accessOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button disabled={disabled || pending} type="submit">
              <UserPlus aria-hidden="true" className="size-4" />
              {pending ? "正在发送邀请" : "发送邀请"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
