import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const dbMigrateWorkflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/db-migrate.yml"),
  "utf8",
);

const deploySmokeWorkflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/deploy-smoke.yml"),
  "utf8",
);

const extractJobBody = (workflow: string, jobName: string) => {
  // 捕获 jobName 行（含可能的顶层缩进）及其后续缩进行，直到下一个顶层 key 出现。
  const lines = workflow.split("\n");
  const startIndex = lines.findIndex((line) =>
    new RegExp(`^\\s*${jobName}:`).test(line),
  );

  if (startIndex < 0) {
    return "";
  }

  const startIndent = /^\s*/.exec(lines[startIndex] ?? "")?.[0]?.length ?? 0;
  const body: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.length === 0) {
      body.push(line);
      continue;
    }
    const indent = /^\s*/.exec(line)?.[0]?.length ?? 0;
    if (indent <= startIndent) {
      break;
    }
    body.push(line);
  }

  return [lines[startIndex], ...body].join("\n");
};

describe("db-migrate / deploy-smoke workflow 与 #64 readiness gate 边界", () => {
  it("production-migrate 步骤显式消费 #64 readiness gate（--enforce）", () => {
    expect(dbMigrateWorkflow).toMatch(/pnpm db:readiness\b/);
    expect(dbMigrateWorkflow).toMatch(/pnpm db:readiness[^\n]*--enforce\b/);
  });

  it("production-migrate 阶段对 #64 readiness 来源保持显式引用", () => {
    const productionBody = extractJobBody(
      dbMigrateWorkflow,
      "production-migrate",
    );
    expect(productionBody).toMatch(/#64/);
    expect(productionBody).toMatch(/readiness/);
  });

  it("staging-migrate 不会消费 enforce 阻断", () => {
    const stagingBody = extractJobBody(dbMigrateWorkflow, "staging-migrate");
    expect(stagingBody).not.toMatch(/--enforce\b/);
  });

  it("deploy-smoke 注释明确指向 #64 readiness 接入", () => {
    expect(deploySmokeWorkflow).toMatch(/#64/);
    expect(deploySmokeWorkflow).toMatch(/readiness/);
  });
});
