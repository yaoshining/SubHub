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

const isPostgresUrl = (value: string) => /^postgres(ql)?:\/\//.test(value);

let testRuntimeDatabaseUrl: string | undefined;
let testDirectDatabaseUrl: string | undefined;

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
    },
    transaction: async (callback) =>
      runtimeClient.db.transaction(async (tx) =>
        callback(tx as StorageDatabase),
      ),
    close: async () => {
      await runtimeClient.close();

      if (directClient) {
        await directClient.close();
      }
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

    return;
  }

  testRuntimeDatabaseUrl = process.env.DATABASE_URL_TEST;
  testDirectDatabaseUrl =
    process.env.DATABASE_URL_TEST_UNPOOLED ?? process.env.DATABASE_URL_TEST;
};

export const resetStorageDatabasePathForTesting = () => {
  singleton = undefined;
  testRuntimeDatabaseUrl = undefined;
  testDirectDatabaseUrl = undefined;
};
