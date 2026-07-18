import { AlertTriangle, Ban, CheckCircle2, CircleOff } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
  SubtitleValidatorDiagnosticSummary,
  SubtitleValidatorDownloadMode,
  SubtitleValidatorDownloadValidationPayload,
  SubtitleValidatorDownloadValidationStatus,
} from "@/lib/api/subtitle-validator";

export type SubtitleValidatorRecentDownloadValidation = Pick<
  SubtitleValidatorDownloadValidationPayload,
  | "status"
  | "message"
  | "downloadMode"
  | "httpStatus"
  | "fileName"
  | "diagnostic"
  | "resultId"
> & {
  completedAt: string;
};

type SubtitleValidatorDownloadStatusProps = {
  validation: SubtitleValidatorRecentDownloadValidation | null;
};

const statusMeta: Record<
  SubtitleValidatorDownloadValidationStatus,
  {
    label: string;
    Icon: typeof CheckCircle2;
    variant: "success" | "warning" | "destructive";
  }
> = {
  success: {
    label: "验证成功",
    Icon: CheckCircle2,
    variant: "success",
  },
  failed: {
    label: "验证失败",
    Icon: AlertTriangle,
    variant: "destructive",
  },
  missing_download: {
    label: "无下载地址",
    Icon: CircleOff,
    variant: "warning",
  },
  unsupported: {
    label: "当前不支持",
    Icon: Ban,
    variant: "warning",
  },
};

const modeLabel: Record<SubtitleValidatorDownloadMode, string> = {
  browser_download: "浏览器下载验证",
  url_check: "URL 检查",
};

function formatCompletedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "刚刚"
    : new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date);
}

export function SubtitleValidatorDownloadStatus({
  validation,
}: SubtitleValidatorDownloadStatusProps) {
  if (!validation) {
    return null;
  }

  const { Icon, label, variant } = statusMeta[validation.status];
  const diagnostic: SubtitleValidatorDiagnosticSummary = validation.diagnostic;

  return (
    <Alert variant={variant}>
      <Icon className="h-4 w-4" />
      <AlertTitle>最近一次下载验证</AlertTitle>
      <AlertDescription className="grid gap-1">
        <p>
          {label} · {modeLabel[validation.downloadMode]} ·{" "}
          {formatCompletedAt(validation.completedAt)}
        </p>
        <p>{validation.message}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {validation.httpStatus ? (
            <span>HTTP {validation.httpStatus}</span>
          ) : null}
          {validation.fileName ? (
            <span>文件：{validation.fileName}</span>
          ) : null}
          {diagnostic.errorCategory ? (
            <span>错误类别：{diagnostic.errorCategory}</span>
          ) : null}
          {diagnostic.nextActionHint ? (
            <span>下一步建议：{diagnostic.nextActionHint}</span>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}
