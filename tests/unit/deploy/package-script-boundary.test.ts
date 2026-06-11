import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
) as {
  scripts: Record<string, string>;
};

describe("package script deploy boundary", () => {
  it("不在应用 build / docs 入口中隐式执行数据库 migration 或 bootstrap", () => {
    expect(packageJson.scripts.build).not.toMatch(/db:(migrate|bootstrap)/);
    expect(packageJson.scripts["api:docs"]).not.toMatch(
      /db:(migrate|bootstrap)/,
    );
    expect(packageJson.scripts.dev).not.toMatch(/db:(migrate|bootstrap)/);
  });
});
