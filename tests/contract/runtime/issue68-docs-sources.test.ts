import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();

const versioningDocPath = "docs/releases/versioning.md";
const decisionDocPath = "docs/decisions/neon-vercel-runtime.md";
const workflowDocPath = "docs/workflows/vercel-neon-environments.md";
const dataModelPath = "specs/002-migrate-neon-vercel/data-model.md";
const quickstartPath = "specs/002-migrate-neon-vercel/quickstart.md";
const releaseContractPath =
  "specs/002-migrate-neon-vercel/contracts/release-cutover-contract.md";
const legacyDatabaseDesignPath =
  "specs/001-mvp-admin-console/database-design.md";

const readDoc = (relativePath: string) =>
  readFile(join(repositoryRoot, relativePath), "utf8");

const resolveDatabaseProductionizationVersion = async () => {
  const versioningDoc = await readDoc(versioningDocPath);
  const match = versioningDoc.match(
    /- `(v\d+\.\d+\.\d+)`：数据库与部署生产化版本/u,
  );

  if (!match) {
    throw new Error(
      "docs/releases/versioning.md 中缺少“数据库与部署生产化版本”的版本真源。",
    );
  }

  return match[1];
};

const previewWhitelist = [
  "preview/*",
  "feature/*",
  "agent/*",
  "copilot/*",
  "fix/*",
  "chore/*",
  "renovate/*",
] as const;

describe("issue #68 文档真源一致性", () => {
  it("要求 decision / workflow / 002 文档明确锚定数据库与部署生产化版本，并关联 #68", async () => {
    const targetVersion = await resolveDatabaseProductionizationVersion();
    const [
      decisionDoc,
      workflowDoc,
      dataModelDoc,
      quickstartDoc,
      releaseContractDoc,
    ] = await Promise.all([
      readDoc(decisionDocPath),
      readDoc(workflowDocPath),
      readDoc(dataModelPath),
      readDoc(quickstartPath),
      readDoc(releaseContractPath),
    ]);

    for (const [path, doc] of [
      [decisionDocPath, decisionDoc],
      [workflowDocPath, workflowDoc],
      [dataModelPath, dataModelDoc],
      [quickstartPath, quickstartDoc],
      [releaseContractPath, releaseContractDoc],
    ] as const) {
      expect(doc, `${path} 应锚定 ${targetVersion}`).toContain(
        `\`${targetVersion}\``,
      );
      expect(doc, `${path} 应关联 #68`).toContain("#68");
    }
  });

  it("要求 001 database-design.md 明确记录 SQLite 已降级 / Postgres 成为正式运行基线", async () => {
    const targetVersion = await resolveDatabaseProductionizationVersion();
    const legacyDatabaseDesign = await readDoc(legacyDatabaseDesignPath);

    expect(legacyDatabaseDesign).toContain(
      `## 0. ${targetVersion} 数据库落地状态`,
    );
    expect(legacyDatabaseDesign).toContain(`\`${targetVersion}\``);
    expect(legacyDatabaseDesign).toContain(
      "Postgres 成为 SubHub 当前 MVP 的正式运行基线",
    );
    expect(legacyDatabaseDesign).toContain(
      "SQLite 已降级为 `001-mvp-admin-console` 阶段的历史实现参考",
    );
  });

  it("要求 decision / workflow 文档与仓库级真源在 Preview 分支白名单口径上一致", async () => {
    const [decisionDoc, workflowDoc] = await Promise.all([
      readDoc(decisionDocPath),
      readDoc(workflowDocPath),
    ]);

    for (const prefix of previewWhitelist) {
      expect(decisionDoc).toContain(`\`${prefix}\``);
      expect(workflowDoc).toContain(`\`${prefix}\``);
    }

    expect(decisionDoc).toContain("非白名单 Preview 分支");
    expect(workflowDoc).toContain("非白名单 Preview 分支");
  });

  it("要求 workflow 文档已收敛为数据库与部署生产化版本的最小 migration / bootstrap runbook", async () => {
    const targetVersion = await resolveDatabaseProductionizationVersion();
    const workflowDoc = await readDoc(workflowDocPath);

    expect(workflowDoc).toContain(
      `${targetVersion} Migration / Bootstrap Runbook`,
    );
    expect(workflowDoc).toContain("scripts/db/migrate.ts");
    expect(workflowDoc).toContain("scripts/db/bootstrap.ts");
    expect(workflowDoc).toContain("scripts/db/seed-dev.ts");
    expect(workflowDoc).toContain("scripts/db/seed-staging.ts");
    expect(workflowDoc).toContain("scripts/db/readiness.ts");
  });

  it("要求 quickstart 已写入 dev / staging dry run 复现记录", async () => {
    const quickstartDoc = await readDoc(quickstartPath);

    expect(quickstartDoc).toContain("## 8. dev / staging dry run 复现记录");
    expect(quickstartDoc).toContain("### 8.1 dev dry run 复现命令");
    expect(quickstartDoc).toContain("### 8.2 staging dry run 复现命令");
    expect(quickstartDoc).toContain("### 8.3 已知阻塞项与边界");
    expect(quickstartDoc).toContain("pnpm db:migrate");
    expect(quickstartDoc).toContain("pnpm db:bootstrap");
    expect(quickstartDoc).toContain("pnpm db:seed:dev");
    expect(quickstartDoc).toContain("pnpm db:seed:staging");
  });

  it("要求 release-cutover-contract 明确数据库与部署生产化版本不以 SQLite 历史数据迁入为前置条件", async () => {
    const targetVersion = await resolveDatabaseProductionizationVersion();
    const releaseContractDoc = await readDoc(releaseContractPath);

    expect(releaseContractDoc).toContain(`## 0. ${targetVersion} 适用范围`);
    expect(releaseContractDoc).toContain(
      `\`${targetVersion}\` 不再以"完成 SQLite 历史数据迁入 Neon"为正式交付前置条件`,
    );
    expect(releaseContractDoc).toContain(
      `\`${targetVersion}\` 的真实 cutover 路径是"greenfield production / staging / dev 初始化"`,
    );
  });

  it("要求 data-model 的 BootstrapState 规则与实现入口保持一致", async () => {
    const dataModelDoc = await readDoc(dataModelPath);

    expect(dataModelDoc).toContain("## BootstrapState");
    expect(dataModelDoc).toContain("`not_applicable` | `pending` | `applied`");
    expect(dataModelDoc).toContain("`migrated` | `required` | `completed`");
    expect(dataModelDoc).toContain(
      "production 必须是 `seedState = not_applicable`",
    );
    expect(dataModelDoc).toContain(
      "当已存在管理员（无论来源于首个初始化还是受控导入）时，后续重复初始化必须被拒绝",
    );
  });
});
