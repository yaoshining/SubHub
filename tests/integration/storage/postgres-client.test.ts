import { beforeEach, describe, expect, it, vi } from "vitest";
const {
  directEndMock,
  drizzleMock,
  migrateMock,
  postgresMock,
  runtimeEndMock,
  transactionMock,
} = vi.hoisted(() => ({
  migrateMock: vi.fn().mockResolvedValue(undefined),
  transactionMock: vi.fn(async (callback: (tx: unknown) => unknown) =>
    callback({ tx: "runtime" }),
  ),
  runtimeEndMock: vi.fn().mockResolvedValue(undefined),
  directEndMock: vi.fn().mockResolvedValue(undefined),
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

vi.mock("drizzle-orm/postgres-js/migrator", () => ({
  migrate: migrateMock,
}));

describe("Postgres storage client integration boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    postgresMock.mockClear();
    drizzleMock.mockClear();
    migrateMock.mockClear();
    transactionMock.mockClear();
    runtimeEndMock.mockClear();
    directEndMock.mockClear();
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

  it("does not expose legacy sqlite-style test override helpers on the production storage client", async () => {
    const storageModule = await import("../../../src/server/storage/client.js");

    expect(storageModule).not.toHaveProperty("setStorageDatabasePathForTesting");
    expect(storageModule).not.toHaveProperty("resetStorageDatabasePathForTesting");
  });
});
