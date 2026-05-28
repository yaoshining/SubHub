"use client";

import * as React from "react";
import { Check, Copy, Eye, EyeOff, Timer } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type RevealSecretProps = {
  secret: string;
  revealUntil: string;
  disabled?: boolean;
  onExpired?: () => void;
};

const formatRemainingSeconds = (milliseconds: number) =>
  Math.max(0, Math.ceil(milliseconds / 1000));

export function RevealSecret({
  secret,
  revealUntil,
  disabled,
  onExpired,
}: RevealSecretProps) {
  const [visible, setVisible] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const expiredRef = React.useRef(false);
  const expiresAt = React.useMemo(
    () => new Date(revealUntil).getTime(),
    [revealUntil],
  );
  const remainingMs = expiresAt - now;
  const expired = remainingMs <= 0;

  React.useEffect(() => {
    expiredRef.current = false;
    const timeoutId = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timeoutId);
  }, [secret, revealUntil]);

  React.useEffect(() => {
    if (expired) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        onExpired?.();
      }
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [expired, onExpired]);

  React.useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  async function copySecret() {
    if (disabled || expired) {
      return;
    }

    setCopyError(null);
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopyError("复制失败，请确认浏览器允许剪贴板写入。");
    }
  }

  if (expired) {
    return (
      <Alert variant="warning" data-testid="reveal-secret-expired">
        <EyeOff aria-hidden="true" className="size-4" />
        <AlertTitle>明文窗口已结束</AlertTitle>
        <AlertDescription>
          完整 Caller Key
          已从界面移除。后续只能查看受控片段，如需新明文请执行轮换或创建新 Key。
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-3" data-testid="reveal-secret">
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Timer aria-hidden="true" className="mt-0.5 size-4 text-warning" />
          <span>
            明文仅在本次受控窗口内可见，约 {formatRemainingSeconds(remainingMs)}{" "}
            秒后自动隐藏。
          </span>
        </div>
        <div className="flex gap-2 sm:shrink-0">
          <Button
            aria-label={visible ? "隐藏完整 Caller Key" : "显示完整 Caller Key"}
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => void copySecret()}
          >
            {copied ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )}
            {copied ? "已复制" : "复制"}
          </Button>
        </div>
      </div>

      <Textarea
        aria-label="完整 Caller Key 明文"
        className="min-h-28 resize-none font-mono text-xs mobile:min-h-32"
        readOnly
        value={visible ? secret : "••••••••••••••••••••••••••••••••"}
      />
      <p className="text-xs leading-5 text-muted-foreground">
        复制成功反馈不会复述密钥内容；窗口结束后 reveal 与 copy 动作会自动失效。
      </p>
      {copyError ? (
        <p className="text-xs text-destructive" role="alert">
          {copyError}
        </p>
      ) : null}
    </div>
  );
}
