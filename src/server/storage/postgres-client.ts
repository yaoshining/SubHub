import postgres, { type Sql } from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";

import {
  type DbUrlEnvSource,
  resolveDbUrls,
  resolveDirectDbUrl,
  resolvePooledDbUrl,
} from "@/lib/db-url";
import { schema } from "./schema";

const pooledRuntimeMaxConnections = 10;
const directRuntimeMaxConnections = 1;

const normalizeDatabaseUrl = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const assertPostgresUrl = (label: string, value: string) => {
  if (!/^postgres(ql)?:\/\//.test(value)) {
    throw new Error(`${label} 必须是 Postgres URL。`);
  }
};

const hasExplicitDatabaseUrlOption = (
  options: Pick<
    PostgresClientOptions,
    "runtimeDatabaseUrl" | "directDatabaseUrl"
  >,
) =>
  Object.prototype.hasOwnProperty.call(options, "runtimeDatabaseUrl") ||
  Object.prototype.hasOwnProperty.call(options, "directDatabaseUrl");

export type PostgresDatabase = PostgresJsDatabase<typeof schema>;

export type PostgresResolvedUrlBoundary = {
  runtimeUrl: string;
  directUrl: string;
};

export type PostgresClientOptions = {
  runtimeDatabaseUrl?: string;
  directDatabaseUrl?: string;
  env?: DbUrlEnvSource;
};

export type PostgresClient = {
  db: PostgresDatabase;
  sql: Sql;
  url: string;
  close: () => Promise<void>;
};

export const resolveRuntimeDatabaseUrl = (
  options: Pick<PostgresClientOptions, "runtimeDatabaseUrl" | "env"> = {},
) => {
  if (Object.prototype.hasOwnProperty.call(options, "runtimeDatabaseUrl")) {
    const url = normalizeDatabaseUrl(options.runtimeDatabaseUrl);

    if (!url) {
      throw new Error("DATABASE_URL 未配置。");
    }

    assertPostgresUrl("DATABASE_URL", url);
    return url;
  }

  const url = resolvePooledDbUrl(options.env);
  assertPostgresUrl("DATABASE_URL", url);
  return url;
};

export const resolveDirectDatabaseUrl = (
  options: Pick<PostgresClientOptions, "directDatabaseUrl" | "env"> = {},
) => {
  if (Object.prototype.hasOwnProperty.call(options, "directDatabaseUrl")) {
    const url = normalizeDatabaseUrl(options.directDatabaseUrl);

    if (!url) {
      throw new Error("DATABASE_URL_UNPOOLED 未配置。");
    }

    assertPostgresUrl("DATABASE_URL_UNPOOLED", url);
    return url;
  }

  const url = resolveDirectDbUrl(options.env);
  assertPostgresUrl("DATABASE_URL_UNPOOLED", url);
  return url;
};

export const resolvePostgresUrlBoundary = (
  options: PostgresClientOptions = {},
): PostgresResolvedUrlBoundary => {
  if (hasExplicitDatabaseUrlOption(options)) {
    return {
      runtimeUrl: resolveRuntimeDatabaseUrl(options),
      directUrl: resolveDirectDatabaseUrl(options),
    };
  }
  const { pooledUrl, directUrl } = resolveDbUrls(options.env);
  assertPostgresUrl("DATABASE_URL", pooledUrl);
  assertPostgresUrl("DATABASE_URL_UNPOOLED", directUrl);
  return { runtimeUrl: pooledUrl, directUrl };
};

const createPostgresSqlClient = (url: string, max: number) =>
  postgres(url, {
    max,
    prepare: false,
  });

export const createRuntimePostgresClient = (
  options: Pick<PostgresClientOptions, "runtimeDatabaseUrl" | "env"> = {},
): PostgresClient => {
  const url = resolveRuntimeDatabaseUrl(options);
  const sql = createPostgresSqlClient(url, pooledRuntimeMaxConnections);

  return {
    db: drizzle({ client: sql, schema }),
    sql,
    url,
    close: () => sql.end({ timeout: 5 }),
  };
};

export const createDirectPostgresClient = (
  options: Pick<PostgresClientOptions, "directDatabaseUrl" | "env"> = {},
): PostgresClient => {
  const url = resolveDirectDatabaseUrl(options);
  const sql = createPostgresSqlClient(url, directRuntimeMaxConnections);

  return {
    db: drizzle({ client: sql, schema }),
    sql,
    url,
    close: () => sql.end({ timeout: 5 }),
  };
};
