import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type SubtitleValidatorDownloadStatusProps = {
  message: string | null;
  tone: "success" | "error";
};

export function SubtitleValidatorDownloadStatus({
  message,
  tone,
}: SubtitleValidatorDownloadStatusProps) {
  if (!message) {
    return null;
  }

  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <Alert variant={tone === "error" ? "destructive" : "default"}>
      <Icon className="h-4 w-4" />
      <AlertTitle>最近一次下载验证</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
