import { describe, expect, it } from "vitest";

import { localRealPostgresTestFiles } from "@/server/storage/local-test-postgres-suite";

describe("local real Postgres test suite", () => {
  it("declares an explicit multi-file suite for pnpm test:db", () => {
    expect(localRealPostgresTestFiles).toEqual([
      "tests/integration/storage/local-test-postgres-baseline.test.ts",
      "tests/integration/storage/admin-user-repository.postgres.test.ts",
      "tests/integration/storage/provider-repository.postgres.test.ts",
      "tests/integration/storage/caller-key-repository.postgres.test.ts",
    ]);
  });
});
