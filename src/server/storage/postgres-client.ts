import postgres, { type Sql } from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { resolveDbUrls, resolveDirectDbUrl, resolvePooledDbUrl } from "@/lib/db-url";
import { schema } from "./schema";

const pooledRuntimeMaxConnections = 10;
const directRuntimeMaxConnections = 1;

const assertPostgresUrl = (label: string, value: string) => {
  if (!/^postgres(ql)?:\/\//.test(value)) {
    throw new Error(`${label} 必须是 Postgres URL。`);
  }
};

export type PostgresDatabase = PostgresJsDatabase<typeof schema>;

export type PostgresResolvedUrlBoundary = {
  runtimeUrl: string;
  directUrl: string;
};

export type PostgresClientOptions = {
  runtimeDatabaseUrl?: string;
  directDatabaseUrl?: string;
};

export type PostgresClient = {
  db: PostgresDatabase;
  sql: Sql;
  url: string;
  close: () => Promise<void>;
};

export const resolveRuntimeDatabaseUrl = (runtimeDatabaseUrl?: string) => {
  const url = runtimeDatabaseUrl ?? resolvePooledDbUrl();
  assertPostgresUrl("pooled database URL", url);
  return url;
};

export const resolveDirectDatabaseUrl = (directDatabaseUrl?: string) => {
  const url = directDatabaseUrl ?? resolveDirectDbUrl();
  assertPostgresUrl("direct database URL", url);
  return url;
};

export const resolvePostgresUrlBoundary = (
  options: PostgresClientOptions = {},
): PostgresResolvedUrlBoundary => {
  if (options.runtimeDatabaseUrl || options.directDatabaseUrl) {
    return {
      runtimeUrl: resolveRuntimeDatabaseUrl(options.runtimeDatabaseUrl),
      directUrl: resolveDirectDatabaseUrl(options.directDatabaseUrl),
    };
  }
  const { pooledUrl, directUrl } = resolveDbUrls();
  assertPostgresUrl("pooled database URL", pooledUrl);
  assertPostgresUrl("direct database URL", directUrl);
  return { runtimeUrl: pooledUrl, directUrl };
};

const createPostgresSqlClient = (url: string, max: number) =>
  postgres(url, {
    max,
    prepare: false,
  });

export const createRuntimePostgresClient = (
  options: Pick<PostgresClientOptions, "runtimeDatabaseUrl"> = {},
): PostgresClient => {
  const url = resolveRuntimeDatabaseUrl(options.runtimeDatabaseUrl);
  const sql = createPostgresSqlClient(url, pooledRuntimeMaxConnections);

  return {
    db: drizzle({ client: sql, schema }),
    sql,
    url,
    close: () => sql.end({ timeout: 5 }),
  };
};

export const createDirectPostgresClient = (
  options: Pick<PostgresClientOptions, "directDatabaseUrl"> = {},
): PostgresClient => {
  const url = resolveDirectDatabaseUrl(options.directDatabaseUrl);
  const sql = createPostgresSqlClient(url, directRuntimeMaxConnections);

  return {
    db: drizzle({ client: sql, schema }),
    sql,
    url,
    close: () => sql.end({ timeout: 5 }),
  };
};
