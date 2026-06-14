import { describe, expect, it } from "vitest";

import { resolveMigrationClientOptions } from "../../../scripts/db/migrate";

describe("db migrate script boundary", () => {
  it("强制 migration 仅使用 unpooled direct URL", () => {
    expect(
      resolveMigrationClientOptions({
        DATABASE_URL_UNPOOLED: "postgresql://direct-user@localhost:5432/subhub",
      }),
    ).toEqual({
      runtimeDatabaseUrl: "postgresql://direct-user@localhost:5432/subhub",
      directDatabaseUrl: "postgresql://direct-user@localhost:5432/subhub",
    });
  });
});
