import path from "node:path";

export function createTestSqlitePath(testName: string) {
  const safeName = testName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return path.join(
    process.cwd(),
    ".data",
    "tests",
    `${safeName || "subhub"}.sqlite`
  );
}
