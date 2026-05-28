"use client";

import { KeyRound } from "lucide-react";

import type { CallerKey } from "@/lib/api/caller-keys";
import { StatusBadge, type AdminStatusTone } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type CallerKeyFilter = "all" | CallerKey["environment"] | CallerKey["status"];

export const callerKeyFilterOptions = [
  { value: "all", label: "全部" },
  { value: "production", label: "生产" },
  { value: "staging", label: "预发" },
  { value: "development", label: "开发" },
  { value: "active", label: "活跃" },
  { value: "suspended", label: "已停用" },
  { value: "rotated", label: "已轮换" },
] as const satisfies ReadonlyArray<{ value: CallerKeyFilter; label: string }>;

const environmentLabels = {
  production: "生产",
  staging: "预发",
  development: "开发",
} as const satisfies Record<CallerKey["environment"], string>;

const statusLabels = {
  active: "活跃",
  suspended: "已停用",
  rotated: "已轮换",
} as const satisfies Record<CallerKey["status"], string>;

const statusTones = {
  active: "success",
  suspended: "destructive",
  rotated: "secondary",
} as const satisfies Record<CallerKey["status"], AdminStatusTone>;

export const getCallerKeyEnvironmentLabel = (environment: CallerKey["environment"]) =>
  environmentLabels[environment];

export const getCallerKeyStatusLabel = (status: CallerKey["status"]) =>
  statusLabels[status];

export function CallerKeyStatusBadge({ status }: { status: CallerKey["status"] }) {
  return <StatusBadge tone={statusTones[status]}>{statusLabels[status]}</StatusBadge>;
}

const formatKeyFragment = (callerKey: CallerKey) => {
  const prefix = callerKey.keyPrefix ?? "subhub_••••";
  const suffix = callerKey.keySuffix ?? "••••••";
  return `${prefix}…${suffix}`;
};

function CallerKeyMobileCard({
  callerKey,
  selected,
  onSelect,
}: {
  callerKey: CallerKey;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={cn(
        "border-border bg-surface shadow-none",
        selected && "border-primary/60 bg-primary/5",
      )}
    >
      <CardContent className="p-4">
        <button
          type="button"
          className="grid w-full gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onSelect}
          aria-pressed={selected}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/30 text-primary">
                <KeyRound aria-hidden="true" className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold">
                  {callerKey.callerName}
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {formatKeyFragment(callerKey)}
                </p>
              </div>
            </div>
            <CallerKeyStatusBadge status={callerKey.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{environmentLabels[callerKey.environment]}</Badge>
            <Badge variant="outline">{callerKey.scope}</Badge>
            <Badge variant="outline">{callerKey.quotaPolicy}</Badge>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}

export type CallerKeyInventoryProps = {
  callerKeys: CallerKey[];
  filteredCallerKeys: CallerKey[];
  selectedCallerKeyId?: string;
  filter: CallerKeyFilter;
  onFilterChange: (filter: CallerKeyFilter) => void;
  onSelectCallerKey: (callerKeyId: string) => void;
};

export function CallerKeyInventory({
  callerKeys,
  filteredCallerKeys,
  selectedCallerKeyId,
  filter,
  onFilterChange,
  onSelectCallerKey,
}: CallerKeyInventoryProps) {
  return (
    <Card className="border-border bg-surface shadow-none" data-testid="caller-key-inventory">
      <CardHeader className="gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Key inventory</CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              仅展示受控片段，筛选不会清空当前选中详情。
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {filteredCallerKeys.length}/{callerKeys.length} 个可见
          </p>
        </div>
        <Tabs
          value={filter}
          onValueChange={(value) => onFilterChange(value as CallerKeyFilter)}
        >
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1 sm:w-auto">
            {callerKeyFilterOptions.map((option) => (
              <TabsTrigger key={option.value} value={option.value} className="text-xs">
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        {filteredCallerKeys.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/20 p-8 text-center">
            <KeyRound aria-hidden="true" className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">当前筛选下没有 Caller Key</p>
            <p className="max-w-sm text-xs leading-5 text-muted-foreground">
              可切换环境或状态筛选；若当前选中对象被筛选隐藏，详情区仍会保留上下文。
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border bg-background desktop:block">
              <Table className="min-w-[54rem]">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-xs">调用方</TableHead>
                    <TableHead className="text-xs">Key</TableHead>
                    <TableHead className="text-xs">环境</TableHead>
                    <TableHead className="text-xs">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCallerKeys.map((callerKey) => {
                    const selected = callerKey.id === selectedCallerKeyId;
                    return (
                      <TableRow
                        key={callerKey.id}
                        className={cn(
                          "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                          selected && "bg-primary/5",
                        )}
                        data-state={selected ? "selected" : undefined}
                        tabIndex={0}
                        aria-selected={selected}
                        onClick={() => onSelectCallerKey(callerKey.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelectCallerKey(callerKey.id);
                          }
                        }}
                      >
                        <TableCell>
                          <div className="max-w-[18rem]">
                            <p className="line-clamp-2 font-medium">{callerKey.callerName}</p>
                            <p className="text-xs text-muted-foreground">
                              {callerKey.scope} · {callerKey.quotaPolicy}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {formatKeyFragment(callerKey)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {environmentLabels[callerKey.environment]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <CallerKeyStatusBadge status={callerKey.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-3 desktop:hidden">
              {filteredCallerKeys.map((callerKey) => (
                <CallerKeyMobileCard
                  key={callerKey.id}
                  callerKey={callerKey}
                  selected={callerKey.id === selectedCallerKeyId}
                  onSelect={() => onSelectCallerKey(callerKey.id)}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
