import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLocalTestEnv } from "../../helpers/env-scenarios";

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
  });

  it("resolves pooled runtime URL and unpooled direct URL from dedicated env vars", () => {
    const env = createLocalTestEnv({
      DATABASE_URL: "postgresql://runtime-user@localhost:5432/subhub",
      DATABASE_URL_UNPOOLED: "postgresql://direct-user@localhost:5432/subhub",
    });

    expect(resolvePostgresUrlBoundary({ env })).toEqual({
      runtimeUrl: "postgresql://runtime-user@localhost:5432/subhub",
      directUrl: "postgresql://direct-user@localhost:5432/subhub",
    });
  });

  it("keeps bootstrap or seed direct URL separate from runtime URL", () => {
    const env = createLocalTestEnv({
      DATABASE_URL: "postgresql://runtime-user@localhost:5432/subhub",
      DATABASE_URL_UNPOOLED: "postgresql://direct-user@localhost:5432/subhub",
    });

    const boundary = resolvePostgresUrlBoundary({ env });

    expect(boundary.runtimeUrl).toBe(
      "postgresql://runtime-user@localhost:5432/subhub",
    );
    expect(boundary.directUrl).toBe(
      "postgresql://direct-user@localhost:5432/subhub",
    );
    expect(boundary.runtimeUrl).not.toBe(boundary.directUrl);
  });

  it("creates runtime client only from DATABASE_URL", () => {
    const env = createLocalTestEnv({
      DATABASE_URL: "postgresql://runtime-user@localhost:5432/subhub",
      DATABASE_URL_UNPOOLED: "postgresql://direct-user@localhost:5432/subhub",
    });

    createRuntimePostgresClient({ env });

    expect(postgresMock).toHaveBeenCalledWith(
      "postgresql://runtime-user@localhost:5432/subhub",
      expect.objectContaining({ max: 10, prepare: false }),
    );
    expect(drizzleMock).toHaveBeenCalledTimes(1);
  });

  it("creates direct client only from DATABASE_URL_UNPOOLED", () => {
    const env = createLocalTestEnv({
      DATABASE_URL: "postgresql://runtime-user@localhost:5432/subhub",
      DATABASE_URL_UNPOOLED: "postgresql://direct-user@localhost:5432/subhub",
    });

    createDirectPostgresClient({ env });

    expect(postgresMock).toHaveBeenCalledWith(
      "postgresql://direct-user@localhost:5432/subhub",
      expect.objectContaining({ max: 1, prepare: false }),
    );
    expect(drizzleMock).toHaveBeenCalledTimes(1);
  });

  it("fails fast when unpooled migration URL is missing or not postgres", () => {
    const env = createLocalTestEnv({
      DATABASE_URL: "postgresql://runtime-user@localhost:5432/subhub",
      DATABASE_URL_UNPOOLED: "",
    });

    expect(() => resolvePostgresUrlBoundary({ env })).toThrow(/DATABASE_URL/);
    expect(() =>
      createDirectPostgresClient({
        directDatabaseUrl: "file:.subhub/subhub.sqlite",
      }),
    ).toThrow("DATABASE_URL_UNPOOLED 必须是 Postgres URL。");
  });

  it("treats empty or whitespace-only runtime/direct URLs as unconfigured", () => {
    expect(() =>
      resolvePostgresUrlBoundary({
        runtimeDatabaseUrl: "",
        directDatabaseUrl: "postgresql://direct-user@localhost:5432/subhub",
      }),
    ).toThrow("DATABASE_URL 未配置。");

    expect(() =>
      resolvePostgresUrlBoundary({
        runtimeDatabaseUrl: "   ",
        directDatabaseUrl: "postgresql://direct-user@localhost:5432/subhub",
      }),
    ).toThrow("DATABASE_URL 未配置。");

    expect(() =>
      resolvePostgresUrlBoundary({
        runtimeDatabaseUrl: "postgresql://runtime-user@localhost:5432/subhub",
        directDatabaseUrl: "   ",
      }),
    ).toThrow("DATABASE_URL_UNPOOLED 未配置。");
  });

  it("treats non-empty invalid runtime/direct URLs as invalid postgres URLs", () => {
    expect(() =>
      resolvePostgresUrlBoundary({
        runtimeDatabaseUrl: "mysql://runtime-user@localhost:5432/subhub",
        directDatabaseUrl: "postgresql://direct-user@localhost:5432/subhub",
      }),
    ).toThrow("DATABASE_URL 必须是 Postgres URL。");

    expect(() =>
      resolvePostgresUrlBoundary({
        runtimeDatabaseUrl: "postgresql://runtime-user@localhost:5432/subhub",
        directDatabaseUrl: "mysql://direct-user@localhost:5432/subhub",
      }),
    ).toThrow("DATABASE_URL_UNPOOLED 必须是 Postgres URL。");
  });
});
