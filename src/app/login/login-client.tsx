"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, LockKeyhole } from "lucide-react";

import {
  bootstrapInitialAdmin,
  fetchBootstrapStatus,
  fetchCurrentAdmin,
  loginAdminUser,
} from "@/lib/api/admin-auth";
import { AppError } from "@/lib/errors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type LoginClientProps = {
  returnTo: string;
};

type AuthMode = "login" | "bootstrap";
type SubmitState = "idle" | "submitting";

const getErrorMessage = (error: unknown) => {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "请求失败，请稍后重试。";
};

export function LoginClient({ returnTo }: LoginClientProps) {
  const router = useRouter();
  const [mode, setMode] = React.useState<AuthMode>("login");
  const [statusLoading, setStatusLoading] = React.useState(true);
  const [submitState, setSubmitState] = React.useState<SubmitState>("idle");
  const [message, setMessage] = React.useState<{
    tone: "success" | "error";
    title: string;
    body: string;
  } | null>(null);
  const [loginIdentifier, setLoginIdentifier] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");
  const [bootstrapIdentifier, setBootstrapIdentifier] = React.useState("");
  const [bootstrapDisplayName, setBootstrapDisplayName] = React.useState("");
  const [bootstrapPassword, setBootstrapPassword] = React.useState("");
  const [bootstrapPasswordConfirm, setBootstrapPasswordConfirm] =
    React.useState("");

  const loadStatus = React.useCallback(
    async (isMounted: () => boolean) => {
      try {
        await fetchCurrentAdmin();
        if (isMounted()) {
          router.replace(returnTo);
        }
        return;
      } catch {
        // 未登录时继续展示认证入口。
      }

      try {
        const status = await fetchBootstrapStatus();
        if (isMounted()) {
          setMode(status.initialized ? "login" : "bootstrap");
        }
      } catch (error) {
        if (isMounted()) {
          setMessage({
            tone: "error",
            title: "无法确认初始化状态",
            body: getErrorMessage(error),
          });
        }
      } finally {
        if (isMounted()) {
          setStatusLoading(false);
        }
      }
    },
    [returnTo, router],
  );

  React.useEffect(() => {
    let mounted = true;
    const timeoutId = window.setTimeout(() => {
      void loadStatus(() => mounted);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      mounted = false;
    };
  }, [loadStatus]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("submitting");
    setMessage(null);

    try {
      await loginAdminUser({
        identifier: loginIdentifier,
        password: loginPassword,
        deviceLabel: "SubHub Admin Console",
      });
      setLoginPassword("");
      router.replace(returnTo);
    } catch (error) {
      setLoginPassword("");
      setMessage({
        tone: "error",
        title: "登录失败",
        body: getErrorMessage(error),
      });
    } finally {
      setSubmitState("idle");
    }
  }

  async function handleBootstrap(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("submitting");
    setMessage(null);

    if (bootstrapPassword !== bootstrapPasswordConfirm) {
      setBootstrapPassword("");
      setBootstrapPasswordConfirm("");
      setSubmitState("idle");
      setMessage({
        tone: "error",
        title: "无法创建首个管理员",
        body: "两次输入的密码不一致，请重新输入密码。",
      });
      return;
    }

    try {
      await bootstrapInitialAdmin({
        identifier: bootstrapIdentifier,
        displayName: bootstrapDisplayName,
        password: bootstrapPassword,
      });
      setLoginIdentifier(bootstrapIdentifier);
      setBootstrapPassword("");
      setBootstrapPasswordConfirm("");
      setMode("login");
      setMessage({
        tone: "success",
        title: "首个管理员已创建",
        body: "请使用刚创建的管理员标识登录控制台。",
      });
    } catch (error) {
      setBootstrapPassword("");
      setBootstrapPasswordConfirm("");
      setMessage({
        tone: "error",
        title: "初始化失败",
        body: getErrorMessage(error),
      });
    } finally {
      setSubmitState("idle");
    }
  }

  const isSubmitting = submitState === "submitting";
  const isBootstrap = mode === "bootstrap";

  return (
    <main
      className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10 text-foreground sm:px-6"
      data-testid="login-page"
    >
      <section className="grid w-full max-w-5xl gap-6 desktop:grid-cols-[minmax(0,0.9fr)_minmax(24rem,28rem)] desktop:items-center">
        <div className="space-y-5">
          <Badge variant="outline" className="rounded-full">
            SubHub Admin
          </Badge>
          <div className="max-w-xl space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              受控字幕网关的管理员入口
            </h1>
            <p className="text-sm leading-6 text-muted-foreground sm:text-base">
              登录后可配置 Provider、调用方 Key
              与后台访问安全。未认证状态不会展示后台 Sidebar、Header
              或任何运营数据。
            </p>
          </div>
          <div className="rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
            成功后将进入{" "}
            <span className="font-medium text-foreground">{returnTo}</span>。
            若你原本访问的是受保护页面，会优先返回该目标。
          </div>
        </div>

        <Card className="border-border bg-surface shadow-none">
          <CardHeader className="space-y-3">
            <div className="flex size-11 items-center justify-center rounded-lg border bg-background text-primary">
              <LockKeyhole aria-hidden="true" className="size-5" />
            </div>
            <div>
              <CardTitle className="text-xl">
                {isBootstrap ? "创建首个管理员" : "登录控制台"}
              </CardTitle>
              <CardDescription className="mt-2 leading-6">
                {isBootstrap
                  ? "当前实例尚未初始化，请先建立唯一的管理员入口。"
                  : "使用管理员标识和密码进入后台控制台。"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {statusLoading ? (
              <div
                className="space-y-3"
                aria-label="正在确认认证状态"
                role="status"
              >
                <div className="h-10 rounded-md bg-muted" />
                <div className="h-10 rounded-md bg-muted" />
                <div className="h-10 rounded-md bg-muted" />
              </div>
            ) : isBootstrap ? (
              <form className="space-y-4" onSubmit={handleBootstrap}>
                <label className="grid gap-2 text-sm font-medium">
                  管理员标识
                  <Input
                    autoComplete="username"
                    value={bootstrapIdentifier}
                    onChange={(event) =>
                      setBootstrapIdentifier(event.target.value)
                    }
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  显示名称
                  <Input
                    autoComplete="name"
                    value={bootstrapDisplayName}
                    onChange={(event) =>
                      setBootstrapDisplayName(event.target.value)
                    }
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  密码
                  <Input
                    autoComplete="new-password"
                    type="password"
                    value={bootstrapPassword}
                    onChange={(event) =>
                      setBootstrapPassword(event.target.value)
                    }
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  确认密码
                  <Input
                    autoComplete="new-password"
                    type="password"
                    value={bootstrapPasswordConfirm}
                    onChange={(event) =>
                      setBootstrapPasswordConfirm(event.target.value)
                    }
                    required
                  />
                </label>
                <Button
                  className="w-full"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "正在创建..." : "创建首个管理员"}
                </Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleLogin}>
                <label className="grid gap-2 text-sm font-medium">
                  邮箱或用户名
                  <Input
                    autoComplete="username"
                    value={loginIdentifier}
                    onChange={(event) => setLoginIdentifier(event.target.value)}
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  密码
                  <Input
                    autoComplete="current-password"
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    required
                  />
                </label>
                <Button
                  className="w-full"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "正在登录..." : "登录"}
                </Button>
              </form>
            )}

            <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
              SSO 与 2FA 当前未启用；本版本仅开放管理员密码登录。
            </div>

            {message ? (
              <Alert
                variant={message.tone === "success" ? "success" : "destructive"}
              >
                {message.tone === "success" ? (
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                ) : (
                  <AlertCircle aria-hidden="true" className="size-4" />
                )}
                <AlertTitle>{message.title}</AlertTitle>
                <AlertDescription>{message.body}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
