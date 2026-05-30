import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();

const readRepositoryFile = (path: string) =>
  readFile(join(repositoryRoot, path), "utf8");

const extractContractOperations = (contract: string) =>
  Array.from(contract.matchAll(/^### `([A-Z]+) ([^`]+)`$/gm)).map(
    ([, method, path]) => `${method} ${path}`,
  );

const extractContractErrorCodes = (contract: string) => {
  const baselineStart = contract.indexOf("**错误代码基线**:");
  const baselineEnd = contract.indexOf("## 认证与初始化");
  const baseline =
    baselineStart >= 0 && baselineEnd > baselineStart
      ? contract.slice(baselineStart, baselineEnd)
      : contract;

  return Array.from(baseline.matchAll(/^- `([A-Z_]+)`$/gm)).map(
    ([, code]) => code,
  );
};

const collectFiles = async (path: string): Promise<string[]> => {
  const entries = await readdir(join(repositoryRoot, path), {
    withFileTypes: true,
  });

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = `${path}/${entry.name}`;
      if (entry.isDirectory()) {
        return collectFiles(entryPath);
      }

      return [entryPath];
    }),
  );

  return files.flat();
};

describe("OpenAPI / Orval / 手写 API 封装链路一致性", () => {
  it("让 OpenAPI 覆盖契约规划中的全部路径、错误码与 tag 分组", async () => {
    const [contract, openApi] = await Promise.all([
      readRepositoryFile("specs/001-mvp-admin-console/contracts/api-contract.md"),
      readRepositoryFile("docs/api/openapi.yaml"),
    ]);

    expect(extractContractOperations(contract)).toEqual([
      "GET /api/admin/bootstrap/status",
      "POST /api/admin/bootstrap",
      "POST /api/admin/auth/login",
      "POST /api/admin/auth/logout",
      "GET /api/admin/auth/me",
      "GET /api/admin/dashboard/summary",
      "GET /api/admin/settings/status",
      "GET /api/admin/providers",
      "POST /api/admin/providers",
      "GET /api/admin/providers/{providerId}",
      "PATCH /api/admin/providers/{providerId}",
      "POST /api/admin/providers/{providerId}/enable",
      "POST /api/admin/providers/{providerId}/disable",
      "GET /api/admin/providers/{providerId}/credentials",
      "POST /api/admin/providers/{providerId}/credentials",
      "POST /api/admin/providers/{providerId}/credentials/{credentialId}/isolate",
      "POST /api/admin/providers/{providerId}/credentials/{credentialId}/restore",
      "GET /api/admin/caller-keys",
      "POST /api/admin/caller-keys",
      "POST /api/admin/caller-keys/{keyId}/rotate",
      "POST /api/admin/caller-keys/{keyId}/suspend",
      "GET /api/admin/caller-keys/{keyId}/usage",
      "GET /api/admin/users",
      "POST /api/admin/users/invitations",
      "POST /api/admin/users/{userId}/suspend",
      "POST /api/admin/users/{userId}/restore",
      "POST /api/admin/sessions/{sessionId}/remediate",
      "GET /api/subtitles/search",
      "GET /api/subtitles/download",
    ]);

    for (const operation of extractContractOperations(contract)) {
      const [, path] = operation.split(" ", 2);
      expect(openApi).toContain(`  ${path}:`);
    }

    for (const code of extractContractErrorCodes(contract)) {
      expect(openApi).toContain(`        - ${code}`);
    }

    expect(openApi).toContain("- name: Admin Auth");
    expect(openApi).toContain("- name: Providers");
    expect(openApi).toContain("- name: Caller Keys");
    expect(openApi).toContain("- name: Users");
    expect(openApi).toContain("- name: Subtitles");
    expect(openApi).toContain("- name: System");
  });

  it("让 Orval、手写 API 层与 Scalar 入口维持固定约定", async () => {
    const [packageJson, orvalConfig, apiIndex, page, apiReference] =
      await Promise.all([
        readRepositoryFile("package.json"),
        readRepositoryFile("orval.config.ts"),
        readRepositoryFile("src/lib/api/index.ts"),
        readRepositoryFile("src/app/docs/api/page.tsx"),
        readRepositoryFile("src/app/docs/api/api-reference.tsx"),
      ]);

    expect(orvalConfig).toContain('input: "./docs/api/openapi.yaml"');
    expect(orvalConfig).toContain('target: "./src/lib/api/generated/subhub.ts"');
    expect(orvalConfig).toContain('schemas: "./src/lib/api/generated/model"');
    expect(orvalConfig).toContain('path: "./src/lib/api/client.ts"');
    expect(orvalConfig).toContain('name: "subhubApiClient"');

    expect(apiIndex).toContain('export * from "./admin-auth";');
    expect(apiIndex).toContain('export * from "./dashboard";');
    expect(apiIndex).toContain('export * from "./providers";');
    expect(apiIndex).toContain('export * from "./caller-keys";');
    expect(apiIndex).toContain('export * from "./users";');
    expect(apiIndex).toContain('export * from "./settings";');

    expect(page).toContain('@scalar/api-reference-react/style.css');
    expect(page).toContain("return <ApiReference />");
    expect(apiReference).toContain('url: "/api/openapi.yaml"');
    expect(apiReference).toContain('theme: "moon"');
    expect(apiReference).toContain('layout: "modern"');

    expect(packageJson).toContain(
      '"api:check": "corepack pnpm api:spec && corepack pnpm api:client && corepack pnpm api:docs"',
    );
  });

  it("限制 generated client 只通过 src/lib/api 手写封装层向外暴露", async () => {
    const applicationFiles = [
      ...(await collectFiles("src/app")),
      ...(await collectFiles("src/components")),
      ...(await collectFiles("src/server")),
    ].filter((path) => /\.(ts|tsx)$/.test(path));

    for (const path of applicationFiles) {
      const content = await readRepositoryFile(path);
      expect(content).not.toContain("@/lib/api/generated/");
      expect(content).not.toContain("../lib/api/generated/");
      expect(content).not.toContain("./generated/");
    }
  });
});
