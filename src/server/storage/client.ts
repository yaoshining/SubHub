import { migrate } from "drizzle-orm/postgres-js/migrator";

import {
  createDirectPostgresClient,
  createRuntimePostgresClient,
  resolveDirectDatabaseUrl,
  resolveRuntimeDatabaseUrl,
  type PostgresClientOptions,
} from "./postgres-client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StorageDatabase = any;

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
let testDatabaseUrl: string | undefined;

export const resolveStorageDatabasePath = (databaseUrl?: string): string =>
  resolveRuntimeDatabaseUrl(databaseUrl);

export const createStorageClient = (
  options: StorageClientOptions = {},
): StorageClient => {
  const runtimeUrl = resolveRuntimeDatabaseUrl(
    options.runtimeDatabaseUrl ?? testDatabaseUrl,
  );
  const directUrl = resolveDirectDatabaseUrl(
    options.directDatabaseUrl ?? testDatabaseUrl,
  );
  const runtimeClient = createRuntimePostgresClient({
    runtimeDatabaseUrl: runtimeUrl,
  });
  let directClient = createDirectPostgresClient({
    directDatabaseUrl: directUrl,
  });

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
  testDatabaseUrl = databaseUrl;
};

export const resetStorageDatabasePathForTesting = () => {
  singleton = undefined;
  testDatabaseUrl = undefined;
};
