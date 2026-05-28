"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import type {
  Provider,
  ProviderDetail,
  UpdateProviderRequest,
} from "@/lib/api/providers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

export type ProviderPolicyDraft = Required<
  Pick<
    UpdateProviderRequest,
    | "name"
    | "priority"
    | "weight"
    | "concurrencyLimit"
    | "rotationEnabled"
    | "cooldownSeconds"
  >
> & {
  fallbackProviderId: string | null;
};

export type ProviderPolicyFormProps = {
  provider: ProviderDetail;
  draft: ProviderPolicyDraft;
  fallbackCandidates: Provider[];
  readOnly?: boolean;
  onDraftChange: (draft: ProviderPolicyDraft, fieldLabel: string) => void;
};

const noneFallbackValue = "__none__";

function numberFromInput(value: string, min: number) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return min;
  }
  return Math.max(min, parsed);
}

function Field({
  id,
  label,
  helper,
  children,
}: {
  id: string;
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      {children}
      {helper ? (
        <p className="text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}

type PolicySection = "weight" | "rotation" | "fallback";

function NeedsConfigAlert() {
  return (
    <Alert variant="warning">
      <AlertTriangle aria-hidden="true" className="size-4" />
      <AlertTitle>此项策略尚未设置，将影响自动切换稳定性</AlertTitle>
      <AlertDescription>
        新建实例已完成名称与 API Key
        录入，仍需确认权重、并发、轮换/冷却、失败切换与回退 Provider。
      </AlertDescription>
    </Alert>
  );
}

function PolicyGroups({
  provider,
  draft,
  fallbackCandidates,
  readOnly,
  onDraftChange,
  sections = ["weight", "rotation", "fallback"],
}: ProviderPolicyFormProps & { sections?: PolicySection[] }) {
  const update = <TKey extends keyof ProviderPolicyDraft>(
    key: TKey,
    value: ProviderPolicyDraft[TKey],
    fieldLabel: string,
  ) => onDraftChange({ ...draft, [key]: value }, fieldLabel);
  const showWeight = sections.includes("weight");
  const showRotation = sections.includes("rotation");
  const showFallback = sections.includes("fallback");

  return (
    <div className="grid gap-6">
      {showWeight ? (
        <section className="grid gap-4" id="policy-weight-concurrency">
          <div>
            <h3 className="text-sm font-medium">权重与并发</h3>
            <p className="text-xs text-muted-foreground">
              控制该 Provider 在调度中的优先顺序与同时请求上限。
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="provider-name" label="Provider 名称">
              <Input
                id="provider-name"
                value={draft.name}
                disabled={readOnly}
                onChange={(event) => update("name", event.target.value, "名称")}
              />
            </Field>
            <Field
              id="provider-priority"
              label="优先级"
              helper="数值越高越优先。"
            >
              <Input
                id="provider-priority"
                type="number"
                min={0}
                value={draft.priority}
                disabled={readOnly}
                onChange={(event) =>
                  update(
                    "priority",
                    numberFromInput(event.target.value, 0),
                    "优先级",
                  )
                }
              />
            </Field>
            <Field
              id="provider-weight"
              label="权重"
              helper="用于同级 Provider 的调度分配。"
            >
              <Input
                id="provider-weight"
                type="number"
                min={0}
                value={draft.weight}
                disabled={readOnly}
                onChange={(event) =>
                  update(
                    "weight",
                    numberFromInput(event.target.value, 0),
                    "权重",
                  )
                }
              />
            </Field>
            <Field id="provider-concurrency" label="并发限制">
              <Input
                id="provider-concurrency"
                type="number"
                min={1}
                value={draft.concurrencyLimit}
                disabled={readOnly}
                onChange={(event) =>
                  update(
                    "concurrencyLimit",
                    numberFromInput(event.target.value, 1),
                    "并发限制",
                  )
                }
              />
            </Field>
          </div>
        </section>
      ) : null}

      {showWeight && (showRotation || showFallback) ? <Separator /> : null}

      {showRotation ? (
        <section className="grid gap-4" id="policy-rotation-cooldown">
          <div>
            <h3 className="text-sm font-medium">轮换与冷却</h3>
            <p className="text-xs text-muted-foreground">
              异常或限流后应避免持续命中同一凭据。
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium">启用凭据轮换</p>
              <p className="text-xs text-muted-foreground">
                在多个 active Token 间分散请求压力。
              </p>
            </div>
            <Switch
              aria-label="启用凭据轮换"
              checked={draft.rotationEnabled}
              disabled={readOnly}
              onCheckedChange={(checked) =>
                update("rotationEnabled", checked, "凭据轮换")
              }
            />
          </div>
          <Field id="provider-cooldown" label="冷却窗口（秒）">
            <Input
              id="provider-cooldown"
              type="number"
              min={0}
              value={draft.cooldownSeconds}
              disabled={readOnly}
              onChange={(event) =>
                update(
                  "cooldownSeconds",
                  numberFromInput(event.target.value, 0),
                  "冷却窗口",
                )
              }
            />
          </Field>
        </section>
      ) : null}

      {showRotation && showFallback ? <Separator /> : null}

      {showFallback ? (
        <section className="grid gap-4" id="policy-fallback">
          <div>
            <h3 className="text-sm font-medium">失败切换与回退</h3>
            <p className="text-xs text-muted-foreground">
              当前 Provider 不可服务时，明确应切到哪个备用实例。
            </p>
          </div>
          <Field id="provider-fallback" label="回退 Provider">
            <Select
              value={draft.fallbackProviderId ?? noneFallbackValue}
              disabled={readOnly}
              onValueChange={(value) =>
                update(
                  "fallbackProviderId",
                  value === noneFallbackValue ? null : value,
                  "回退 Provider",
                )
              }
            >
              <SelectTrigger id="provider-fallback">
                <SelectValue placeholder="选择回退 Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={noneFallbackValue}>暂不设置回退</SelectItem>
                {fallbackCandidates
                  .filter((candidate) => candidate.id !== provider.id)
                  .map((candidate) => (
                    <SelectItem
                      key={candidate.id}
                      value={candidate.id}
                      disabled={candidate.availableCredentialCount === 0}
                    >
                      {candidate.name}
                      {candidate.availableCredentialCount === 0
                        ? "（不可用）"
                        : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
        </section>
      ) : null}
    </div>
  );
}

export function ProviderPolicyForm(props: ProviderPolicyFormProps) {
  return (
    <Card
      className="border-border bg-surface shadow-none"
      data-testid="provider-policy-form"
    >
      <CardHeader>
        <CardTitle className="text-base">运行策略</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="grid gap-6 pt-6">
        {props.provider.status === "needs_config" ? <NeedsConfigAlert /> : null}
        <div className="mobile:hidden">
          <PolicyGroups {...props} />
        </div>
        <Accordion
          type="multiple"
          defaultValue={["weight", "rotation", "fallback"]}
          className="hidden mobile:block"
          data-testid="provider-policy-mobile-accordion"
        >
          <AccordionItem value="weight">
            <AccordionTrigger>权重与并发</AccordionTrigger>
            <AccordionContent>
              <PolicyGroups {...props} sections={["weight"]} />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="rotation">
            <AccordionTrigger>轮换与冷却</AccordionTrigger>
            <AccordionContent>
              <PolicyGroups {...props} sections={["rotation"]} />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="fallback">
            <AccordionTrigger>失败切换与回退</AccordionTrigger>
            <AccordionContent>
              <PolicyGroups {...props} sections={["fallback"]} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
