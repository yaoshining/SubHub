import { AlertTriangle, CheckCircle2, Clock3, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DiagnosticStatus = "idle" | "loading" | "success" | "empty" | "error";

type SubtitleValidatorDiagnosticSummaryProps = {
  selectedProviderName: string | null;
  searching: boolean;
  resultCount: number;
  status: DiagnosticStatus;
  lastMessage: string | null;
  nextActionHint?: string | null;
  errorCategory?: string | null;
};

const iconByStatus = {
  idle: Search,
  loading: Clock3,
  success: CheckCircle2,
  empty: Search,
  error: AlertTriangle,
} satisfies Record<DiagnosticStatus, typeof Search>;

const labelByStatus: Record<DiagnosticStatus, string> = {
  idle: "等待验证",
  loading: "请求中",
  success: "已返回结果",
  empty: "空结果",
  error: "请求失败",
};

export function SubtitleValidatorDiagnosticSummary({
  selectedProviderName,
  searching,
  resultCount,
  status,
  lastMessage,
  nextActionHint,
  errorCategory,
}: SubtitleValidatorDiagnosticSummaryProps) {
  const Icon = iconByStatus[searching ? "loading" : status];
  const effectiveStatus = searching ? "loading" : status;

  return (
    <Card className="border-border bg-surface shadow-none">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">Diagnostic Snapshot</CardTitle>
          <p className="text-sm text-muted-foreground">
            最近一次动作围绕当前 Provider 的搜索或下载校验上下文展开。
          </p>
        </div>
        <Badge
          variant={effectiveStatus === "error" ? "destructive" : "secondary"}
        >
          {labelByStatus[effectiveStatus]}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-surface-elevated px-4 py-3">
            <p className="text-xs text-muted-foreground">当前 Provider</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {selectedProviderName ?? "尚未选择"}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface-elevated px-4 py-3">
            <p className="text-xs text-muted-foreground">结果数</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {resultCount}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface-elevated px-4 py-3">
            <p className="text-xs text-muted-foreground">当前状态</p>
            <div className="mt-1 flex items-center gap-2 text-sm font-medium text-foreground">
              <Icon className="size-4" />
              <span>{labelByStatus[effectiveStatus]}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-dashed border-border/70 px-4 py-4 text-sm text-muted-foreground">
          <span>
            {lastMessage ??
              "尚未执行验证。选择 Provider 后可直接开始搜索校验，最近一次结果会收敛在这里。"}
          </span>
          {errorCategory ? (
            <span className="text-xs text-foreground/80">
              错误类别：{errorCategory}
            </span>
          ) : null}
          {nextActionHint ? (
            <span className="text-xs text-foreground/80">
              下一步建议：{nextActionHint}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
