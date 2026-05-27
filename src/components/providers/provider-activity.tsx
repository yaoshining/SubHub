"use client";

import * as React from "react";
import { Activity } from "lucide-react";

import type { ProviderDetail } from "@/lib/api/providers";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDateTime,
  formatTokenFragment,
} from "@/components/providers/provider-utils";

export type ProviderActivityProps = {
  provider: ProviderDetail;
};

type ActivityEvent = {
  id: string;
  time: string;
  type: "switch" | "error" | "restore";
  credential: string;
  message: string;
};

function buildEvents(provider: ProviderDetail): ActivityEvent[] {
  const events: ActivityEvent[] = [
    {
      id: `${provider.id}-updated`,
      time: provider.updatedAt,
      type: provider.status === "degraded" ? "error" : "restore",
      credential: "provider",
      message:
        provider.lastErrorSummary ??
        `Provider 策略最近更新，当前状态为 ${provider.status}。`,
    },
  ];

  provider.credentials.forEach((credential) => {
    if (credential.lastErrorAt) {
      events.push({
        id: `${credential.id}-error`,
        time: credential.lastErrorAt,
        type: "error",
        credential: formatTokenFragment(credential),
        message: credential.lastErrorSummary ?? "上游凭据出现异常。",
      });
    }
    if (credential.lastUsedAt) {
      events.push({
        id: `${credential.id}-used`,
        time: credential.lastUsedAt,
        type: "switch",
        credential: formatTokenFragment(credential),
        message: "凭据参与最近一次上游请求。",
      });
    }
  });

  return events.sort(
    (left, right) =>
      new Date(right.time).getTime() - new Date(left.time).getTime(),
  );
}

function EventBadge({ type }: { type: ActivityEvent["type"] }) {
  if (type === "error") {
    return <StatusBadge tone="warning">异常</StatusBadge>;
  }
  if (type === "restore") {
    return <StatusBadge tone="success">恢复</StatusBadge>;
  }
  return <StatusBadge tone="secondary">切换</StatusBadge>;
}

export function ProviderActivity({ provider }: ProviderActivityProps) {
  const [range, setRange] = React.useState("24h");
  const events = buildEvents(provider);

  return (
    <Card
      className="border-border bg-surface shadow-none"
      data-testid="provider-activity"
    >
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">最近行为</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            展示该 Provider 的最近异常、恢复与凭据使用轨迹。
          </p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-8 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">最近 24 小时</SelectItem>
            <SelectItem value="7d">最近 7 天</SelectItem>
            <SelectItem value="30d">最近 30 天</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <Separator />
      <CardContent className="pt-6">
        {events.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table className="min-w-[42rem]">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-xs">时间</TableHead>
                  <TableHead className="text-xs">事件</TableHead>
                  <TableHead className="text-xs">相关凭据</TableHead>
                  <TableHead className="text-xs">说明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-xs">
                      {formatDateTime(event.time)}
                    </TableCell>
                    <TableCell>
                      <EventBadge type={event.type} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {event.credential}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {event.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-8 text-center">
            <Activity
              aria-hidden="true"
              className="size-6 text-muted-foreground"
            />
            <p className="text-sm font-medium">暂无最近行为</p>
            <p className="text-xs leading-5 text-muted-foreground">
              发生凭据切换、异常或恢复后会在此处展示。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
