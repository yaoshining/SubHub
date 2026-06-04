import { beforeEach, describe, expect, it, vi } from "vitest";
const { drizzleMock, postgresMock } = vi.hoisted(() => ({
  postgresMock: vi.fn((url: string, options: unknown) => ({
    end: vi.fn().mockResolvedValue(undefined),
    options,
    url,
  })),
  drizzleMock: vi.fn(({ client }: { client: unknown }) => ({
    $client: client,
  })),
}));

vi.mock("postgres", () => ({
  default: postgresMock,
}));

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: drizzleMock,
}));

import {
  createDirectPostgresClient,
  createRuntimePostgresClient,
  resolvePostgresUrlBoundary,
} from "../../../src/server/storage/postgres-client.js";

describe("Postgres runtime URL boundary", () => {
  beforeEach(() => {
    postgresMock.mockClear();
    drizzleMock.mockClear();
    vi.unstubAllEnvs();
  });

  it("resolves pooled runtime URL and unpooled direct URL from dedicated env vars", () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://runtime-user@localhost:5432/subhub",
    );
    vi.stubEnv(
      "DATABASE_URL_UNPOOLED",
      "postgresql://direct-user@localhost:5432/subhub",
    );

    expect(resolvePostgresUrlBoundary()).toEqual({
      runtimeUrl: "postgresql://runtime-user@localhost:5432/subhub",
      directUrl: "postgresql://direct-user@localhost:5432/subhub",
    });
  });

  it("creates runtime client only from DATABASE_URL", () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://runtime-user@localhost:5432/subhub",
    );
    vi.stubEnv(
      "DATABASE_URL_UNPOOLED",
      "postgresql://direct-user@localhost:5432/subhub",
    );

    createRuntimePostgresClient();

    expect(postgresMock).toHaveBeenCalledWith(
      "postgresql://runtime-user@localhost:5432/subhub",
      expect.objectContaining({ max: 10, prepare: false }),
    );
    expect(drizzleMock).toHaveBeenCalledTimes(1);
  });

  it("creates direct client only from DATABASE_URL_UNPOOLED", () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://runtime-user@localhost:5432/subhub",
    );
    vi.stubEnv(
      "DATABASE_URL_UNPOOLED",
      "postgresql://direct-user@localhost:5432/subhub",
    );

    createDirectPostgresClient();

    expect(postgresMock).toHaveBeenCalledWith(
      "postgresql://direct-user@localhost:5432/subhub",
      expect.objectContaining({ max: 1, prepare: false }),
    );
    expect(drizzleMock).toHaveBeenCalledTimes(1);
  });

  it("fails fast when unpooled migration URL is missing or not postgres", () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://runtime-user@localhost:5432/subhub",
    );
    vi.stubEnv("DATABASE_URL_UNPOOLED", "");

    expect(() => resolvePostgresUrlBoundary()).toThrow(/DATABASE_URL/);
    expect(() =>
      createDirectPostgresClient({
        directDatabaseUrl: "file:.subhub/subhub.sqlite",
      }),
    ).toThrow("必须是 Postgres URL");
  });
});
