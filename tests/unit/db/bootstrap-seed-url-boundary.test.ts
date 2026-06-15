import { describe, expect, it } from "vitest";

import { resolveBootstrapClientOptions } from "../../../scripts/db/bootstrap";
import { resolveSeedDevClientOptions } from "../../../scripts/db/seed-dev";
import { resolveSeedStagingClientOptions } from "../../../scripts/db/seed-staging";

const pooledUrl = "postgresql://runtime-user@localhost:5432/subhub";
const directUrl = "postgresql://direct-user@localhost:5432/subhub";

describe("bootstrap / seed script URL boundary", () => {
  it("bootstrap 保持 runtime 走 pooled，direct 走 unpooled", () => {
    expect(
      resolveBootstrapClientOptions({
        DATABASE_URL: pooledUrl,
        DATABASE_URL_UNPOOLED: directUrl,
      }),
    ).toEqual({
      runtimeDatabaseUrl: pooledUrl,
      directDatabaseUrl: directUrl,
    });
  });

  it("development seed 不把 runtime 错绑到 unpooled", () => {
    expect(
      resolveSeedDevClientOptions({
        DATABASE_URL: pooledUrl,
        DATABASE_URL_UNPOOLED: directUrl,
      }),
    ).toEqual({
      runtimeDatabaseUrl: pooledUrl,
      directDatabaseUrl: directUrl,
    });
  });

  it("staging seed 不把 runtime 错绑到 unpooled", () => {
    expect(
      resolveSeedStagingClientOptions({
        DATABASE_URL: pooledUrl,
        DATABASE_URL_UNPOOLED: directUrl,
      }),
    ).toEqual({
      runtimeDatabaseUrl: pooledUrl,
      directDatabaseUrl: directUrl,
    });
  });
});
