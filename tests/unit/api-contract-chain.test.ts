import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";
import { GET as getOpenApiYaml } from "@/app/api/openapi.yaml/route";
import { subhubApiClient } from "@/lib/api";
import { ErrorCode } from "@/lib/api/generated/model";

const repositoryRoot = process.cwd();

describe("API 契约链路基础", () => {
  it("以 docs/api/openapi.yaml 作为 OpenAPI 真源并声明基础错误与认证结构", async () => {
    const openApi = await readFile(
      join(repositoryRoot, "docs/api/openapi.yaml"),
      "utf8",
    );

    expect(openApi).toContain("openapi: 3.1.0");
    expect(openApi).toContain("title: SubHub API");
    expect(openApi).toContain("AdminSession:");
    expect(openApi).toContain("CallerKeyBearer:");
    expect(openApi).toContain("ErrorResponse:");
    expect(openApi).toContain("SERVICE_NOT_READY");
    expect(openApi).toContain("UPSTREAM_FAILED");
    expect(openApi).toContain("name: Subtitles");
  });

  it("通过 /api/openapi.yaml 向 Scalar 提供同一份 OpenAPI 文件", async () => {
    const response = await getOpenApiYaml();
    const servedOpenApi = await response.text();
    const sourceOpenApi = await readFile(
      join(repositoryRoot, "docs/api/openapi.yaml"),
      "utf8",
    );

    expect(response.headers.get("content-type")).toContain("application/yaml");
    expect(servedOpenApi).toBe(sourceOpenApi);
  });

  it("将 Orval 输出固定到生成目录，并通过手写 fetcher 隔离生成代码", async () => {
    const orvalConfig = await readFile(
      join(repositoryRoot, "orval.config.ts"),
      "utf8",
    );

    expect(orvalConfig).toContain('input: "./docs/api/openapi.yaml"');
    expect(orvalConfig).toContain(
      'target: "./src/lib/api/generated/subhub.ts"',
    );
    expect(orvalConfig).toContain('schemas: "./src/lib/api/generated/model"');
    expect(orvalConfig).toContain('path: "./src/lib/api/client.ts"');
    expect(orvalConfig).toContain('name: "subhubApiClient"');
    expect(typeof subhubApiClient).toBe("function");
  });

  it("保留已生成的基础错误类型，供后续管理端与字幕 API 共用", () => {
    expect(ErrorCode.AUTHENTICATION_REQUIRED).toBe("AUTHENTICATION_REQUIRED");
    expect(ErrorCode.CALLER_KEY_SUSPENDED).toBe("CALLER_KEY_SUSPENDED");
    expect(ErrorCode.PROVIDER_CREDENTIAL_EXHAUSTED).toBe(
      "PROVIDER_CREDENTIAL_EXHAUSTED",
    );
  });

  it("用 api:check 串联 OpenAPI 校验、client 生成与 Scalar 文档构建", () => {
    expect(packageJson.scripts["api:spec"]).toContain("orval --config");
    expect(packageJson.scripts["api:client"]).toContain(
      "--clean src/lib/api/generated",
    );
    expect(packageJson.scripts["api:docs"]).toBe("next build");
    expect(packageJson.scripts["api:check"]).toContain("pnpm api:spec");
    expect(packageJson.scripts["api:check"]).toContain("pnpm api:client");
    expect(packageJson.scripts["api:check"]).toContain("pnpm api:docs");
  });

  it("保持 Scalar 文档构建使用的 Next 类型入口稳定，避免 api:check 产生已跟踪差异", async () => {
    const tsconfig = await readFile(
      join(repositoryRoot, "tsconfig.json"),
      "utf8",
    );

    expect(tsconfig).toContain('".next/types/**/*.ts"');
  });
});
