import { beforeEach, describe, expect, it, vi } from "vitest";
const {
  directEndMock,
  drizzleMock,
  migrateMock,
  pgliteConstructorMock,
  pgliteDrizzleMock,
  pgliteMigrateMock,
  postgresMock,
  runtimeEndMock,
  transactionMock,
} = vi.hoisted(() => ({
  migrateMock: vi.fn().mockResolvedValue(undefined),
  pgliteMigrateMock: vi.fn().mockResolvedValue(undefined),
  transactionMock: vi.fn(async (callback: (tx: unknown) => unknown) =>
    callback({ tx: "runtime" }),
  ),
  runtimeEndMock: vi.fn().mockResolvedValue(undefined),
  directEndMock: vi.fn().mockResolvedValue(undefined),
  pgliteConstructorMock: vi.fn(
    class MockPGlite {
      close = vi.fn().mockResolvedValue(undefined);

      waitReady = Promise.resolve();
    },
  ),
  pgliteDrizzleMock: vi.fn(({ client }: { client: unknown }) => ({
    $client: client,
    transaction: transactionMock,
  })),
  postgresMock: vi.fn((url: string) => ({
    end: url.includes("runtime") ? runtimeEndMock : directEndMock,
  })),
  drizzleMock: vi.fn(({ client }: { client: unknown }) => ({
    $client: client,
    transaction: transactionMock,
  })),
}));

vi.mock("postgres", () => ({
  default: postgresMock,
}));

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: drizzleMock,
}));

vi.mock("@electric-sql/pglite", () => ({
  PGlite: pgliteConstructorMock,
}));

vi.mock("drizzle-orm/pglite", () => ({
  drizzle: pgliteDrizzleMock,
}));

vi.mock("drizzle-orm/postgres-js/migrator", () => ({
  migrate: migrateMock,
}));

vi.mock("drizzle-orm/pglite/migrator", () => ({
  migrate: pgliteMigrateMock,
}));

describe("Postgres storage client integration boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    postgresMock.mockClear();
    drizzleMock.mockClear();
    migrateMock.mockClear();
    pgliteConstructorMock.mockClear();
    pgliteDrizzleMock.mockClear();
    pgliteMigrateMock.mockClear();
    transactionMock.mockClear();
    runtimeEndMock.mockClear();
    directEndMock.mockClear();
  });

  it("keeps legacy sqlite-style test override on in-memory test storage without touching postgres", async () => {
    const {
      createStorageClient,
      resetStorageDatabasePathForTesting,
      setStorageDatabasePathForTesting,
    } = await import("../../../src/server/storage/client.js");

    setStorageDatabasePathForTesting("/tmp/subhub/test.sqlite");
    const client = createStorageClient();
    await client.migrate();
    await client.transaction(async (db) => db);
    await client.close();

    expect(postgresMock).not.toHaveBeenCalled();
    expect(pgliteConstructorMock).toHaveBeenCalledTimes(1);
    expect(pgliteDrizzleMock).toHaveBeenCalledTimes(1);
    expect(pgliteMigrateMock).toHaveBeenCalledTimes(1);

    resetStorageDatabasePathForTesting();
  });

  it("builds runtime storage from pooled URL and migration from unpooled URL", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://runtime-user@localhost:5432/subhub",
    );
    vi.stubEnv(
      "DATABASE_URL_UNPOOLED",
      "postgresql://direct-user@localhost:5432/subhub",
    );

    const { createStorageClient } =
      await import("../../../src/server/storage/client.js");

    const client = createStorageClient();
    await client.migrate();
    await client.transaction(async (db) => db);
    await client.close();

    expect(postgresMock).toHaveBeenNthCalledWith(
      1,
      "postgresql://runtime-user@localhost:5432/subhub",
      expect.any(Object),
    );
    expect(postgresMock).toHaveBeenNthCalledWith(
      2,
      "postgresql://direct-user@localhost:5432/subhub",
      expect.any(Object),
    );
    expect(migrateMock).toHaveBeenCalledWith(
      expect.objectContaining({ transaction: transactionMock }),
      expect.objectContaining({
        migrationsFolder: "src/server/storage/migrations",
      }),
    );
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(runtimeEndMock).toHaveBeenCalledTimes(1);
    expect(directEndMock).toHaveBeenCalledTimes(1);
  });

  it("supports test override URLs without falling back to sqlite paths", async () => {
    const { createStorageClient } =
      await import("../../../src/server/storage/client.js");

    const client = createStorageClient({
      runtimeDatabaseUrl: "postgresql://runtime-override@localhost:5432/subhub",
      directDatabaseUrl: "postgresql://direct-override@localhost:5432/subhub",
    });

    expect(client.runtimeUrl).toBe(
      "postgresql://runtime-override@localhost:5432/subhub",
    );
    expect(client.directUrl).toBe(
      "postgresql://direct-override@localhost:5432/subhub",
    );
  });

  it("fails fast when runtime URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("DATABASE_URL_UNPOOLED", "");

    const { createStorageClient } =
      await import("../../../src/server/storage/client.js");

    expect(() => createStorageClient()).toThrow("DATABASE_URL 未配置。");
  });
});
