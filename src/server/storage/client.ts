import { migrate } from "drizzle-orm/postgres-js/migrator";

import {
  createDirectPostgresClient,
  createRuntimePostgresClient,
  type PostgresDatabase,
  resolveDirectDatabaseUrl,
  resolveRuntimeDatabaseUrl,
  type PostgresClientOptions,
} from "./postgres-client";

export type StorageDatabase = PostgresDatabase;

export type StorageClient = {
  db: StorageDatabase;
  sqlite?: undefined;
  runtimeUrl: string;
  directUrl: string;
  migrate: () => Promise<void>;
  transaction: <T>(
    callback: (db: StorageDatabase) => Promise<T> | T,
  ) => Promise<T>;
  close: () => Promise<void>;
};

export type StorageClientOptions = PostgresClientOptions;

const migrationsFolder = "src/server/storage/migrations";
let singleton: StorageClient | undefined;
const resettableTestTables = [
  "admin_action_results",
  "subtitle_download_requests",
  "subtitle_search_requests",
  "caller_key_rotations",
  "caller_keys",
  "provider_credentials",
  "providers",
  "admin_sessions",
  "admin_invitations",
  "admin_users",
] as const;

const isPostgresUrl = (value: string) => /^postgres(ql)?:\/\//.test(value);

let testRuntimeDatabaseUrl: string | undefined;
let testDirectDatabaseUrl: string | undefined;
let resetTestDataAfterMigrate = false;

export const resolveStorageDatabasePath = (databaseUrl?: string): string =>
  resolveRuntimeDatabaseUrl(databaseUrl);

export const createStorageClient = (
  options: StorageClientOptions = {},
): StorageClient => {
  const runtimeUrl = resolveRuntimeDatabaseUrl(
    options.runtimeDatabaseUrl ?? testRuntimeDatabaseUrl,
  );
  const directUrl = resolveDirectDatabaseUrl(
    options.directDatabaseUrl ?? testDirectDatabaseUrl,
  );
  const runtimeClient = createRuntimePostgresClient({
    runtimeDatabaseUrl: runtimeUrl,
  });
  let directClient: ReturnType<typeof createDirectPostgresClient> | undefined;

  const client: StorageClient = {
    db: runtimeClient.db as StorageDatabase,
    runtimeUrl,
    directUrl,
    migrate: async () => {
      if (!directClient) {
        directClient = createDirectPostgresClient({
          directDatabaseUrl: directUrl,
        });
      }

      await migrate(directClient.db, { migrationsFolder });

      if (resetTestDataAfterMigrate) {
        await directClient.sql.unsafe(
          `TRUNCATE TABLE ${resettableTestTables
            .map((tableName) => `"${tableName}"`)
            .join(", ")} RESTART IDENTITY CASCADE`,
        );
      }
    },
    transaction: async (callback) =>
      runtimeClient.db.transaction(async (tx) =>
        callback(tx as StorageDatabase),
      ),
    close: async () => {
      await Promise.all([
        runtimeClient.close(),
        directClient ? directClient.close() : Promise.resolve(),
      ]);
    },
  };

  return client;
};

export const getStorageClient = (): StorageClient => {
  if (!singleton) {
    singleton = createStorageClient();
  }

  return singleton;
};

export const closeStorageClient = async () => {
  if (!singleton) {
    return;
  }

  await singleton.close();
  singleton = undefined;
};

export const setStorageDatabasePathForTesting = (databaseUrl: string) => {
  singleton = undefined;

  if (isPostgresUrl(databaseUrl)) {
    testRuntimeDatabaseUrl = databaseUrl;
    testDirectDatabaseUrl = databaseUrl;
    resetTestDataAfterMigrate = false;

    return;
  }

  testRuntimeDatabaseUrl = process.env.DATABASE_URL_TEST;
  testDirectDatabaseUrl =
    process.env.DATABASE_URL_TEST_UNPOOLED ?? process.env.DATABASE_URL_TEST;
  resetTestDataAfterMigrate = true;
};

export const resetStorageDatabasePathForTesting = () => {
  singleton = undefined;
  testRuntimeDatabaseUrl = undefined;
  testDirectDatabaseUrl = undefined;
  resetTestDataAfterMigrate = false;
};
